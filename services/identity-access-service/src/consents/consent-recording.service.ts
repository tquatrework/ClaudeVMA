import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import {
  ALL_CONSENT_TYPES,
  ConsentAction,
  ConsentRecord,
  ConsentType,
  DEFAULT_CONSENT_VERSION,
  REQUIRED_CONSENTS,
} from './entities/consent-record.entity';

/** Données d'un événement de consentement à tracer, quelle que soit la route qui le recueille. */
export interface RecordConsentInput {
  userId: string;
  consentType: ConsentType;
  /** Octroi (défaut) ou retrait. Les deux s'AJOUTENT au journal. */
  action?: ConsentAction;
  /** Version du document signé ; `DEFAULT_CONSENT_VERSION` si l'appelant n'en fournit pas. */
  version?: string;
  /** Adresse IP de la requête qui a recueilli l'événement (preuve). */
  ipAddress?: string;
}

/**
 * État courant d'un type de consentement pour un utilisateur, reconstruit à
 * partir du dernier événement du journal.
 */
export interface ConsentState {
  consentType: ConsentType;
  isGranted: boolean;
  /** Dernier événement enregistré pour ce type, `null` si aucun n'existe. */
  lastEvent: ConsentRecord | null;
  /**
   * Dernier OCTROI enregistré pour ce type, `null` si l'utilisateur n'a jamais
   * donné ce consentement. Reste renseigné après un retrait : c'est ce qui
   * permet d'afficher « accepté le X, retiré le Y » sans relire tout le journal.
   */
  lastGrantedEvent: ConsentRecord | null;
}

/**
 * Écriture et lecture de `consent_records` — chemin UNIQUE d'enregistrement d'un
 * consentement dans le service.
 *
 * Trois appelants l'empruntent, et aucun autre :
 *   - `ConsentsService` pour `POST /consents` (re-consentements, changements de
 *     version, consentement facultatif signé après coup) ;
 *   - `ConsentsService` pour `POST /consents/:consentType/withdraw` (retrait) ;
 *   - `AccountsService` pour les consentements recueillis dans le formulaire
 *     d'inscription et transmis dans le corps des routes de création de compte
 *     (arbitrage d'architecture du 2026-08-09 : ces routes doivent EMPRUNTER le
 *     mécanisme existant, pas le contourner ni le dupliquer).
 *
 * Même table, même version par défaut, même capture d'`ipAddress` et de
 * `recordedAt` (`@CreateDateColumn`) dans tous les cas.
 *
 * `consent_records` est un journal APPEND-ONLY : ce service n'expose aucune
 * méthode de suppression ni de mise à jour, volontairement. Un consentement
 * retiré doit rester prouvable.
 *
 * Ce service est volontairement dépourvu de dépendance vers `AccountsService` :
 * il ne porte que l'écriture de la trace. L'effet de bord métier sur le compte
 * (activation une fois les consentements obligatoires signés) reste chez
 * `AccountsService.activateAfterMandatoryConsents`, propriétaire de `User`.
 * C'est aussi ce qui évite un cycle de modules entre AccountsModule et
 * ConsentsModule (cf. ConsentRecordingModule).
 */
@Injectable()
export class ConsentRecordingService {
  constructor(
    @InjectRepository(ConsentRecord) private readonly consentRepo: Repository<ConsentRecord>,
  ) {}

  /**
   * Ajoute un événement de consentement au journal. Accepte l'`EntityManager` de
   * la transaction appelante pour que la trace commite ou échoue avec
   * l'opération qui l'a recueillie (création de compte notamment) — un
   * consentement ne doit jamais survivre à un compte annulé, ni un compte être
   * créé sans sa trace.
   */
  async recordConsent(input: RecordConsentInput, manager?: EntityManager): Promise<ConsentRecord> {
    const consentRepo = this.repositoryFor(manager);
    return consentRepo.save(
      consentRepo.create({
        userId: input.userId,
        consentType: input.consentType,
        action: input.action ?? ConsentAction.GRANTED,
        version: input.version ?? DEFAULT_CONSENT_VERSION,
        ipAddress: input.ipAddress,
      }),
    );
  }

  /**
   * Dernier événement enregistré pour ce type de consentement, ou `null` si
   * l'utilisateur n'en a jamais donné. C'est LUI qui porte l'état courant : un
   * `action: 'withdrawn'` signifie que le consentement n'est plus accordé, même
   * si des lignes `granted` plus anciennes existent toujours.
   */
  async findCurrentConsent(
    userId: string,
    consentType: ConsentType,
    manager?: EntityManager,
  ): Promise<ConsentRecord | null> {
    return this.repositoryFor(manager).findOne({
      where: { userId, consentType },
      order: { recordedAt: 'DESC' },
    });
  }

  /** `true` si le dernier événement de ce type est un octroi. */
  async isConsentGranted(
    userId: string,
    consentType: ConsentType,
    manager?: EntityManager,
  ): Promise<boolean> {
    const currentConsent = await this.findCurrentConsent(userId, consentType, manager);
    return currentConsent?.action === ConsentAction.GRANTED;
  }

  /**
   * Journal complet des événements de consentement d'un utilisateur, du plus
   * ancien au plus récent. Sert la preuve (« donné le X, retiré le Y »), jamais
   * l'affichage d'un état.
   */
  async listConsentHistory(userId: string, manager?: EntityManager): Promise<ConsentRecord[]> {
    return this.repositoryFor(manager).find({ where: { userId }, order: { recordedAt: 'ASC' } });
  }

  /**
   * État courant de CHAQUE type de consentement, y compris ceux que
   * l'utilisateur n'a jamais donnés (`isGranted: false`, `lastEvent: null`).
   * Une seule lecture du journal, replié en mémoire — l'ordre chronologique
   * garantit que le dernier événement rencontré pour un type est le courant.
   */
  async getConsentStates(userId: string, manager?: EntityManager): Promise<ConsentState[]> {
    const consentHistory = await this.listConsentHistory(userId, manager);

    const lastEventByType = new Map<ConsentType, ConsentRecord>();
    const lastGrantedEventByType = new Map<ConsentType, ConsentRecord>();
    for (const consentEvent of consentHistory) {
      lastEventByType.set(consentEvent.consentType, consentEvent);
      if (consentEvent.action === ConsentAction.GRANTED) {
        lastGrantedEventByType.set(consentEvent.consentType, consentEvent);
      }
    }

    return ALL_CONSENT_TYPES.map((consentType) => {
      const lastEvent = lastEventByType.get(consentType) ?? null;
      return {
        consentType,
        isGranted: lastEvent?.action === ConsentAction.GRANTED,
        lastEvent,
        lastGrantedEvent: lastGrantedEventByType.get(consentType) ?? null,
      };
    });
  }

  /**
   * Indique si tous les consentements obligatoires (IAM-FB-003 : RGPD + CGU)
   * sont accordés À CE JOUR. Calculé sur l'état courant et non sur la simple
   * existence d'une ligne : dans un journal append-only, une ligne `granted`
   * suivie d'un `withdrawn` ne vaut pas consentement.
   *
   * Invariance portée par le propriétaire de `ConsentRecord`, jamais recalculée
   * ailleurs.
   */
  async areMandatoryConsentsGranted(userId: string, manager?: EntityManager): Promise<boolean> {
    const consentStates = await this.getConsentStates(userId, manager);
    const grantedConsentTypes = consentStates
      .filter((consentState) => consentState.isGranted)
      .map((consentState) => consentState.consentType);

    return REQUIRED_CONSENTS.every((requiredType) => grantedConsentTypes.includes(requiredType));
  }

  private repositoryFor(manager?: EntityManager): Repository<ConsentRecord> {
    return manager ? manager.getRepository(ConsentRecord) : this.consentRepo;
  }
}
