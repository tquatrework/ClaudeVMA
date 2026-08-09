import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import {
  ConsentRecord,
  ConsentType,
  DEFAULT_CONSENT_VERSION,
  REQUIRED_CONSENTS,
} from './entities/consent-record.entity';

/** Données d'un consentement à tracer, quelle que soit la route qui le recueille. */
export interface RecordConsentInput {
  userId: string;
  consentType: ConsentType;
  /** Version du document signé ; `DEFAULT_CONSENT_VERSION` si l'appelant n'en fournit pas. */
  version?: string;
  /** Adresse IP de la requête qui a recueilli le consentement (preuve). */
  ipAddress?: string;
}

/**
 * Écriture et lecture de `consent_records` — chemin UNIQUE d'enregistrement d'un
 * consentement dans le service.
 *
 * Deux appelants l'empruntent, et aucun autre :
 *   - `ConsentsService` pour `POST /consents` (re-consentements, changements de
 *     version, consentement facultatif signé après coup) ;
 *   - `AccountsService` pour les consentements recueillis dans le formulaire
 *     d'inscription et transmis dans le corps des routes de création de compte
 *     (arbitrage d'architecture du 2026-08-09 : ces routes doivent EMPRUNTER le
 *     mécanisme existant, pas le contourner ni le dupliquer).
 *
 * Même table, même version par défaut, même capture d'`ipAddress` et de
 * `signedAt` (`@CreateDateColumn`) dans les deux cas.
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
   * Enregistre un consentement. Accepte l'`EntityManager` de la transaction
   * appelante pour que la trace commite ou échoue avec l'opération qui l'a
   * recueillie (création de compte notamment) — un consentement ne doit jamais
   * survivre à un compte annulé, ni un compte être créé sans sa trace.
   */
  async recordConsent(input: RecordConsentInput, manager?: EntityManager): Promise<ConsentRecord> {
    const consentRepo = this.repositoryFor(manager);
    return consentRepo.save(
      consentRepo.create({
        userId: input.userId,
        consentType: input.consentType,
        version: input.version ?? DEFAULT_CONSENT_VERSION,
        ipAddress: input.ipAddress,
      }),
    );
  }

  /** Retourne le consentement déjà signé de ce type, ou `null`. */
  async findSignedConsent(
    userId: string,
    consentType: ConsentType,
    manager?: EntityManager,
  ): Promise<ConsentRecord | null> {
    return this.repositoryFor(manager).findOne({ where: { userId, consentType } });
  }

  /** Liste les consentements signés par un utilisateur, du plus ancien au plus récent. */
  async listSignedConsents(userId: string, manager?: EntityManager): Promise<ConsentRecord[]> {
    return this.repositoryFor(manager).find({ where: { userId }, order: { signedAt: 'ASC' } });
  }

  /**
   * Indique si tous les consentements obligatoires (IAM-FB-003 : RGPD + CGU) sont
   * signés. Invariance portée par le propriétaire de `ConsentRecord`, jamais
   * recalculée ailleurs.
   */
  async areMandatoryConsentsSigned(userId: string, manager?: EntityManager): Promise<boolean> {
    const signedConsents = await this.listSignedConsents(userId, manager);
    const signedConsentTypes = signedConsents.map((consentRecord) => consentRecord.consentType);
    return REQUIRED_CONSENTS.every((requiredType) => signedConsentTypes.includes(requiredType));
  }

  private repositoryFor(manager?: EntityManager): Repository<ConsentRecord> {
    return manager ? manager.getRepository(ConsentRecord) : this.consentRepo;
  }
}
