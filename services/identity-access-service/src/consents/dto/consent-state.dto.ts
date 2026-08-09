import { ApiProperty } from '@nestjs/swagger';
import {
  ConsentAction,
  ConsentType,
  isWithdrawableConsent,
  REQUIRED_CONSENTS,
} from '../entities/consent-record.entity';
import { ConsentState } from '../consent-recording.service';

/**
 * État courant d'un consentement, tel qu'un écran doit l'afficher.
 *
 * `never_granted` et `withdrawn` sont distingués : « jamais donné » et « donné
 * puis retiré » ne se racontent pas de la même façon à l'utilisateur, et seule
 * la seconde a une date de retrait à montrer.
 */
export enum ConsentStatus {
  GRANTED = 'granted',
  WITHDRAWN = 'withdrawn',
  NEVER_GRANTED = 'never_granted',
}

/**
 * Réponse de `GET /consents` : un élément par type de consentement existant,
 * TOUJOURS les trois, y compris ceux que l'utilisateur n'a jamais donnés.
 *
 * Les lignes brutes de `consent_records` ne sont volontairement pas exposées
 * ici : le journal contient plusieurs événements par type et un écran qui
 * afficherait « Signé » sur la foi d'une ligne `granted` mentirait sur un
 * consentement retiré depuis (arbitrage du 2026-08-09). L'historique complet
 * reste disponible sur `GET /consents/history` pour la preuve.
 */
export class ConsentStateDto {
  @ApiProperty({ enum: ConsentType, description: 'Consent type' })
  consentType: ConsentType;

  @ApiProperty({
    enum: ConsentStatus,
    description:
      "Current status, derived from the last journal event: 'granted', 'withdrawn' (granted then withdrawn) or 'never_granted'.",
  })
  status: ConsentStatus;

  @ApiProperty({
    description: "Shorthand for status === 'granted'. The only field an access check should read.",
  })
  isGranted: boolean;

  @ApiProperty({
    description:
      'Mandatory consents (rgpd, cgu) condition the use of the service and cannot be withdrawn here.',
  })
  isMandatory: boolean;

  @ApiProperty({
    description:
      'Whether POST /consents/{consentType}/withdraw is allowed for this type. False for mandatory consents.',
  })
  isWithdrawable: boolean;

  @ApiProperty({
    nullable: true,
    example: '1.0',
    description: 'Version carried by the last event, null when the consent was never granted.',
  })
  version: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    format: 'date-time',
    description: 'Timestamp of the last grant, kept after a withdrawal. Null when never granted.',
  })
  grantedAt: Date | null;

  @ApiProperty({
    nullable: true,
    type: String,
    format: 'date-time',
    description: 'Timestamp of the withdrawal currently in force. Null unless status is withdrawn.',
  })
  withdrawnAt: Date | null;

  @ApiProperty({
    nullable: true,
    type: String,
    format: 'date-time',
    description: 'Timestamp of the last event of any kind. Null when never granted.',
  })
  updatedAt: Date | null;

  static fromConsentState(consentState: ConsentState): ConsentStateDto {
    const { consentType, lastEvent, lastGrantedEvent } = consentState;

    const status = !lastEvent
      ? ConsentStatus.NEVER_GRANTED
      : lastEvent.action === ConsentAction.GRANTED
        ? ConsentStatus.GRANTED
        : ConsentStatus.WITHDRAWN;

    return {
      consentType,
      status,
      isGranted: status === ConsentStatus.GRANTED,
      isMandatory: REQUIRED_CONSENTS.includes(consentType),
      isWithdrawable: isWithdrawableConsent(consentType),
      version: lastEvent?.version ?? null,
      grantedAt: lastGrantedEvent?.recordedAt ?? null,
      withdrawnAt: status === ConsentStatus.WITHDRAWN ? (lastEvent?.recordedAt ?? null) : null,
      updatedAt: lastEvent?.recordedAt ?? null,
    };
  }
}
