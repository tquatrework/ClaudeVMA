import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

export enum ConsentType {
  RGPD = 'rgpd',
  CGU = 'cgu',
  MARKETING = 'marketing',
}

/**
 * Nature de l'événement inscrit dans le journal `consent_records`.
 *
 * `consent_records` est un journal **append-only** (arbitrage d'architecture du
 * 2026-08-09) : retirer un consentement AJOUTE une ligne `withdrawn`, il n'en
 * efface ni n'en écrase aucune. On doit pouvoir prouver qu'un consentement avait
 * été donné, puis retiré, et quand. Aucune suppression de ligne, jamais.
 */
export enum ConsentAction {
  GRANTED = 'granted',
  WITHDRAWN = 'withdrawn',
}

export const REQUIRED_CONSENTS: ConsentType[] = [ConsentType.RGPD, ConsentType.CGU];

export const ALL_CONSENT_TYPES: ConsentType[] = Object.values(ConsentType);

/**
 * Consentements que l'utilisateur peut retirer lui-même : ceux qui ne sont pas
 * obligatoires. `rgpd` et `cgu` conditionnent le fonctionnement du service —
 * leur retrait ne relève pas d'une case à décocher mais d'une fermeture de
 * compte, parcours distinct (arbitrage du 2026-08-09).
 *
 * Dérivé de `REQUIRED_CONSENTS` plutôt que listé en dur : ajouter un type
 * optionnel le rend retirable sans qu'on ait à y penser, et ajouter un type
 * obligatoire le protège de la même façon.
 */
export const WITHDRAWABLE_CONSENTS: ConsentType[] = ALL_CONSENT_TYPES.filter(
  (consentType) => !REQUIRED_CONSENTS.includes(consentType),
);

export function isWithdrawableConsent(consentType: ConsentType): boolean {
  return WITHDRAWABLE_CONSENTS.includes(consentType);
}

/**
 * Version appliquée quand l'appelant n'en fournit pas explicitement. Constante
 * unique : `POST /consents` et les routes de création de compte enregistrent la
 * même version par défaut, la trace d'un consentement ne devant pas dépendre du
 * chemin par lequel il a été recueilli.
 */
export const DEFAULT_CONSENT_VERSION = '1.0';

/**
 * Une ligne = un ÉVÉNEMENT de consentement (octroi ou retrait), jamais l'état
 * courant. L'état courant d'un type se lit comme le dernier événement enregistré
 * pour ce type (cf. `ConsentRecordingService.findCurrentConsent`).
 */
@Entity('consent_records')
@Index('IDX_consent_records_user_type_recorded_at', ['userId', 'consentType', 'recordedAt'])
export class ConsentRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'consent_type', type: 'enum', enum: ConsentType })
  consentType: ConsentType;

  @Column({
    name: 'action',
    type: 'enum',
    enum: ConsentAction,
    enumName: 'consent_records_action_enum',
    default: ConsentAction.GRANTED,
  })
  action: ConsentAction;

  @Column({ default: DEFAULT_CONSENT_VERSION })
  version: string;

  @Column({ name: 'ip_address', nullable: true })
  ipAddress: string;

  /**
   * Horodatage de l'événement. Nommé `recorded_at` et non `signed_at` : un
   * retrait n'est pas une signature, et une colonne `signed_at` portant la date
   * d'un retrait serait exactement le genre de nom mensonger que la règle « un
   * seul nom par donnée » proscrit.
   */
  @CreateDateColumn({ name: 'recorded_at' })
  recordedAt: Date;
}
