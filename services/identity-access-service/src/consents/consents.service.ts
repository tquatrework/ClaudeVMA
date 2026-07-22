import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConsentRecord, REQUIRED_CONSENTS } from './entities/consent-record.entity';
import { CreateConsentDto } from './dto/create-consent.dto';
import { EventsService } from '../events/events.service';
import { AccountsService } from '../accounts/accounts.service';

@Injectable()
export class ConsentsService {
  constructor(
    @InjectRepository(ConsentRecord) private readonly consentRepo: Repository<ConsentRecord>,
    private readonly eventsService: EventsService,
    private readonly accountsService: AccountsService,
  ) {}

  async signConsent(userId: string, dto: CreateConsentDto, ipAddress?: string) {
    const existing = await this.consentRepo.findOne({
      where: { userId, consentType: dto.consentType },
    });
    if (existing) throw new ConflictException(`Consent ${dto.consentType} already signed`);

    const record = await this.consentRepo.save(
      this.consentRepo.create({
        userId,
        consentType: dto.consentType,
        version: dto.version ?? '1.0',
        ipAddress,
      }),
    );

    this.eventsService.publish('ConsentSigned', {
      userId,
      consentType: dto.consentType,
      version: record.version,
    });

    await this.activateAccountIfReady(userId);

    return record;
  }

  async getConsents(userId: string) {
    return this.consentRepo.find({ where: { userId }, order: { signedAt: 'ASC' } });
  }

  /**
   * Vérifie si tous les consentements obligatoires (IAM-FB-003) sont signés.
   * ConsentsService reste seul responsable de cette invariance (il possède
   * ConsentRecord) ; l'effet sur le compte (User, possédé par AccountsModule)
   * est délégué à AccountsService.
   */
  private async activateAccountIfReady(userId: string): Promise<void> {
    const signedConsentRecords = await this.consentRepo.find({ where: { userId } });
    const signedConsentTypes = signedConsentRecords.map((consentRecord) => consentRecord.consentType);

    const allRequired = REQUIRED_CONSENTS.every((requiredType) => signedConsentTypes.includes(requiredType));
    if (!allRequired) return;

    await this.accountsService.activateAfterMandatoryConsents(userId);
  }
}
