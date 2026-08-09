import { Injectable, ConflictException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { ConsentRecord } from './entities/consent-record.entity';
import { CreateConsentDto } from './dto/create-consent.dto';
import { ConsentRecordingService } from './consent-recording.service';
import { EventsService } from '../events/events.service';
import { AccountsService } from '../accounts/accounts.service';

@Injectable()
export class ConsentsService {
  constructor(
    private readonly consentRecordingService: ConsentRecordingService,
    private readonly eventsService: EventsService,
    private readonly accountsService: AccountsService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  /**
   * Enregistre un consentement et, le cas échéant, active le compte (IAM-FB-003).
   * Les deux écritures (ConsentRecord via ConsentRecordingService + User délégué
   * à AccountsService) sont atomiques via DataSource.transaction ; l'événement
   * métier n'est publié qu'après le commit.
   *
   * Cette route reste nécessaire après l'inscription : re-consentement,
   * changement de version d'un document, et consentement facultatif
   * (`marketing`) signé plus tard.
   */
  async signConsent(userId: string, dto: CreateConsentDto, ipAddress?: string): Promise<ConsentRecord> {
    const existing = await this.consentRecordingService.findSignedConsent(userId, dto.consentType);
    if (existing) throw new ConflictException(`Consent ${dto.consentType} already signed`);

    const record = await this.dataSource.transaction(async (manager) => {
      const savedRecord = await this.consentRecordingService.recordConsent(
        {
          userId,
          consentType: dto.consentType,
          version: dto.version,
          ipAddress,
        },
        manager,
      );

      await this.activateAccountIfReady(userId, manager);

      return savedRecord;
    });

    this.eventsService.publish('ConsentSigned', {
      userId,
      consentType: dto.consentType,
      version: record.version,
    });

    return record;
  }

  async getConsents(userId: string): Promise<ConsentRecord[]> {
    return this.consentRecordingService.listSignedConsents(userId);
  }

  /**
   * Vérifie si tous les consentements obligatoires (IAM-FB-003) sont signés.
   * L'invariance appartient au propriétaire de ConsentRecord
   * (ConsentRecordingService) ; l'effet sur le compte (User, possédé par
   * AccountsModule) est délégué à AccountsService, dans la même transaction.
   */
  private async activateAccountIfReady(userId: string, manager: EntityManager): Promise<void> {
    const allRequiredSigned = await this.consentRecordingService.areMandatoryConsentsSigned(userId, manager);
    if (!allRequiredSigned) return;

    await this.accountsService.activateAfterMandatoryConsents(userId, manager);
  }
}
