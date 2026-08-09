import { ApiProperty } from '@nestjs/swagger';
import { ConsentAction, ConsentRecord, ConsentType } from '../entities/consent-record.entity';

/**
 * Un événement du journal `consent_records`, exposé par `GET /consents/history`.
 *
 * L'adresse IP est capturée comme preuve mais n'est jamais renvoyée : elle n'a
 * pas à circuler vers le navigateur pour que l'utilisateur relise son historique.
 */
export class ConsentEventDto {
  @ApiProperty({ description: 'Journal entry identifier' })
  id: string;

  @ApiProperty({ enum: ConsentType, description: 'Consent type' })
  consentType: ConsentType;

  @ApiProperty({
    enum: ConsentAction,
    description: "'granted' when the consent was given, 'withdrawn' when it was revoked",
  })
  action: ConsentAction;

  @ApiProperty({ example: '1.0', description: 'Version of the document at the time of the event' })
  version: string;

  @ApiProperty({ type: String, format: 'date-time', description: 'When the event was recorded' })
  recordedAt: Date;

  static fromConsentRecord(consentRecord: ConsentRecord): ConsentEventDto {
    return {
      id: consentRecord.id,
      consentType: consentRecord.consentType,
      action: consentRecord.action,
      version: consentRecord.version,
      recordedAt: consentRecord.recordedAt,
    };
  }
}
