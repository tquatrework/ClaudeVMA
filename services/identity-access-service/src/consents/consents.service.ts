import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConsentRecord, ConsentType, REQUIRED_CONSENTS } from './entities/consent-record.entity';
import { User, ValidationStatus } from '../auth/entities/user.entity';
import { CreateConsentDto } from './dto/create-consent.dto';
import { EventsService } from '../events/events.service';

@Injectable()
export class ConsentsService {
  constructor(
    @InjectRepository(ConsentRecord) private readonly consentRepo: Repository<ConsentRecord>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly eventsService: EventsService,
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

    await this.activateIfReady(userId);

    return record;
  }

  async getConsents(userId: string) {
    return this.consentRepo.find({ where: { userId }, order: { signedAt: 'ASC' } });
  }

  /** Activates account once all required consents are present (IAM-FB-003) */
  private async activateIfReady(userId: string): Promise<void> {
    const signedConsentRecords = await this.consentRepo.find({ where: { userId } });
    const signedConsentTypes = signedConsentRecords.map((consentRecord) => consentRecord.consentType);

    const allRequired = REQUIRED_CONSENTS.every((requiredType) => signedConsentTypes.includes(requiredType));
    if (!allRequired) return;

    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user || user.consentSigned) return;

    user.consentSigned = true;
    if (user.validationStatus === ValidationStatus.PENDING) {
      user.validationStatus = ValidationStatus.ACTIVE;
    }
    await this.userRepo.save(user);
  }
}
