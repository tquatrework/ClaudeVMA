import {
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RewardSetting } from './entities/reward-setting.entity';
import { FinancialArchiveItem } from '../financial-archives/entities/financial-archive-item.entity';
import { FinancialPointLedger } from '../payments/entities/financial-point-ledger.entity';
import { Payment } from '../payments/entities/payment.entity';
import { EventsService } from '../events/events.service';
import { UserRole } from '../common/enums/user-role.enum';
import { UpdateRewardSettingsDto, RewardSettingItemDto } from './dto/update-reward-settings.dto';

export interface FinanceEventItem {
  id: string;
  eventType: string;
  ownerId: string;
  label: string;
  amountCents: number | null;
  occurredAt: Date;
}

@Injectable()
export class FinancialSettingsService {
  constructor(
    @InjectRepository(RewardSetting)
    private readonly rewardSettingRepo: Repository<RewardSetting>,
    @InjectRepository(FinancialArchiveItem)
    private readonly archiveRepo: Repository<FinancialArchiveItem>,
    @InjectRepository(FinancialPointLedger)
    private readonly ledgerRepo: Repository<FinancialPointLedger>,
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    private readonly eventsService: EventsService,
  ) {}

  /**
   * Retrieve all current reward settings.
   * Readable by AF only.
   */
  async findAllSettings(requesterRole: string): Promise<RewardSetting[]> {
    this.assertIsAF(requesterRole);
    return this.rewardSettingRepo.find({ order: { settingKey: 'ASC' } });
  }

  /**
   * Upsert reward settings (create if not exist, update if exists).
   * FIN-FB-003: only AF can modify the reward settings.
   * Publishes RewardSettingUpdated event after each update.
   */
  async upsertSettings(
    dto: UpdateRewardSettingsDto,
    requesterId: string,
    requesterRole: string,
    correlationId?: string,
  ): Promise<RewardSetting[]> {
    this.assertIsAF(requesterRole);

    const effectiveCorrelationId = dto.correlationId ?? correlationId ?? null;
    const savedSettings: RewardSetting[] = [];

    for (const settingDto of dto.settings) {
      const savedSetting = await this.upsertSingleSetting(
        settingDto,
        requesterId,
        effectiveCorrelationId,
      );
      savedSettings.push(savedSetting);
    }

    this.eventsService.publish(
      'RewardSettingUpdated',
      {
        updatedBy: requesterId,
        settingsCount: savedSettings.length,
        settingKeys: savedSettings.map((s) => s.settingKey),
      },
      effectiveCorrelationId ?? undefined,
    );

    return savedSettings;
  }

  /**
   * Get all financial events for the AF interface.
   * Provides a filterable view of all payments, ledger entries and archive items.
   * FIN-FB-003: only AF can access this aggregate view.
   */
  async getFinanceEvents(
    requesterRole: string,
    ownerId?: string,
  ): Promise<FinanceEventItem[]> {
    this.assertIsAF(requesterRole);

    const archiveQuery = this.archiveRepo
      .createQueryBuilder('archive')
      .orderBy('archive.occurredAt', 'DESC');

    if (ownerId) {
      archiveQuery.where('archive.ownerId = :ownerId', { ownerId });
    }

    const archiveItems = await archiveQuery.getMany();

    return archiveItems.map((item) => ({
      id: item.id,
      eventType: item.itemType,
      ownerId: item.ownerId,
      label: item.label,
      amountCents: item.amountCents,
      occurredAt: item.occurredAt,
    }));
  }

  // ---- Private helpers ----

  private async upsertSingleSetting(
    settingDto: RewardSettingItemDto,
    requesterId: string,
    correlationId: string | null,
  ): Promise<RewardSetting> {
    const existingSetting = await this.rewardSettingRepo.findOne({
      where: { settingKey: settingDto.settingKey },
    });

    if (existingSetting) {
      return this.rewardSettingRepo.save({
        ...existingSetting,
        label: settingDto.label,
        value: settingDto.value,
        description: settingDto.description ?? existingSetting.description,
        updatedBy: requesterId,
        correlationId,
      });
    }

    return this.rewardSettingRepo.save(
      this.rewardSettingRepo.create({
        settingKey: settingDto.settingKey,
        label: settingDto.label,
        value: settingDto.value,
        description: settingDto.description ?? null,
        updatedBy: requesterId,
        correlationId,
      }),
    );
  }

  private assertIsAF(requesterRole: string): void {
    if (requesterRole !== UserRole.ADMINISTRATEUR_FINANCIER) {
      throw new ForbiddenException('Only AF (AdministrateurFinancier) can access financial settings');
    }
  }
}
