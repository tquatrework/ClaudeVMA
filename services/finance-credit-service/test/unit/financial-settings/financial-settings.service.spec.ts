import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException } from '@nestjs/common';
import { FinancialSettingsService } from '../../../src/financial-settings/financial-settings.service';
import { RewardSetting } from '../../../src/financial-settings/entities/reward-setting.entity';
import { FinancialArchiveItem, ArchiveItemType } from '../../../src/financial-archives/entities/financial-archive-item.entity';
import { FinancialPointLedger } from '../../../src/payments/entities/financial-point-ledger.entity';
import { Payment } from '../../../src/payments/entities/payment.entity';
import { EventsService } from '../../../src/events/events.service';
import { UserRole } from '../../../src/common/enums/user-role.enum';

const mockRewardSettingRepo = {
  find: jest.fn(),
  findOne: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
};

const mockArchiveRepo = {
  createQueryBuilder: jest.fn(),
};

const mockLedgerRepo = {};
const mockPaymentRepo = {};
const mockEventsService = { publish: jest.fn() };

const buildRewardSetting = (overrides: Partial<RewardSetting> = {}): RewardSetting => ({
  id: 'setting-1',
  settingKey: 'inscription_price_cents',
  label: 'Prix inscription (centimes)',
  value: 9900,
  description: 'Montant en centimes pour une inscription standard',
  updatedBy: null,
  correlationId: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  ...overrides,
});

const buildArchiveItem = (overrides: Partial<FinancialArchiveItem> = {}): FinancialArchiveItem => ({
  id: 'archive-1',
  ownerId: 'owner-1',
  itemType: ArchiveItemType.PAYMENT,
  referenceId: 'payment-1',
  label: 'inscription — €99.00',
  amountCents: 9900,
  balanceSnapshot: null,
  correlationId: null,
  occurredAt: new Date('2026-01-15'),
  ...overrides,
});

describe('FinancialSettingsService', () => {
  let service: FinancialSettingsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FinancialSettingsService,
        { provide: getRepositoryToken(RewardSetting), useValue: mockRewardSettingRepo },
        { provide: getRepositoryToken(FinancialArchiveItem), useValue: mockArchiveRepo },
        { provide: getRepositoryToken(FinancialPointLedger), useValue: mockLedgerRepo },
        { provide: getRepositoryToken(Payment), useValue: mockPaymentRepo },
        { provide: EventsService, useValue: mockEventsService },
      ],
    }).compile();

    service = module.get<FinancialSettingsService>(FinancialSettingsService);
    jest.clearAllMocks();
  });

  // ---- findAllSettings ----

  describe('findAllSettings', () => {
    it('returns all settings when requester is AF', async () => {
      const settings = [buildRewardSetting()];
      mockRewardSettingRepo.find.mockResolvedValue(settings);

      const result = await service.findAllSettings(UserRole.ADMINISTRATEUR_FINANCIER);
      expect(result).toHaveLength(1);
      expect(mockRewardSettingRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ order: { settingKey: 'ASC' } }),
      );
    });

    it('throws ForbiddenException when requester is not AF', async () => {
      await expect(
        service.findAllSettings(UserRole.RESPONSABLE_PEDAGOGIQUE),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when requester is an eleve', async () => {
      await expect(service.findAllSettings(UserRole.ELEVE)).rejects.toThrow(ForbiddenException);
    });
  });

  // ---- upsertSettings ----

  describe('upsertSettings', () => {
    it('creates new settings and publishes RewardSettingUpdated event', async () => {
      const newSetting = buildRewardSetting();
      mockRewardSettingRepo.findOne.mockResolvedValue(null); // not existing
      mockRewardSettingRepo.create.mockReturnValue(newSetting);
      mockRewardSettingRepo.save.mockResolvedValue(newSetting);

      const result = await service.upsertSettings(
        {
          settings: [
            {
              settingKey: 'inscription_price_cents',
              label: 'Prix inscription (centimes)',
              value: 9900,
            },
          ],
        },
        'af-user',
        UserRole.ADMINISTRATEUR_FINANCIER,
      );

      expect(result).toHaveLength(1);
      expect(mockRewardSettingRepo.save).toHaveBeenCalledTimes(1);
      expect(mockEventsService.publish).toHaveBeenCalledWith(
        'RewardSettingUpdated',
        expect.objectContaining({ updatedBy: 'af-user', settingsCount: 1 }),
        undefined,
      );
    });

    it('updates existing settings when setting key already exists', async () => {
      const existingSetting = buildRewardSetting({ value: 9900 });
      const updatedSetting = { ...existingSetting, value: 12000 };
      mockRewardSettingRepo.findOne.mockResolvedValue(existingSetting);
      mockRewardSettingRepo.save.mockResolvedValue(updatedSetting);

      const result = await service.upsertSettings(
        {
          settings: [
            {
              settingKey: 'inscription_price_cents',
              label: 'Prix inscription (centimes)',
              value: 12000,
            },
          ],
        },
        'af-user',
        UserRole.ADMINISTRATEUR_FINANCIER,
      );

      expect(result[0].value).toBe(12000);
      expect(mockRewardSettingRepo.create).not.toHaveBeenCalled();
    });

    it('handles multiple settings in one call', async () => {
      const setting1 = buildRewardSetting();
      const setting2 = buildRewardSetting({
        id: 'setting-2',
        settingKey: 'points_per_euro',
        label: 'Points par euro',
        value: 1,
      });

      mockRewardSettingRepo.findOne.mockResolvedValue(null);
      mockRewardSettingRepo.create
        .mockReturnValueOnce(setting1)
        .mockReturnValueOnce(setting2);
      mockRewardSettingRepo.save
        .mockResolvedValueOnce(setting1)
        .mockResolvedValueOnce(setting2);

      const result = await service.upsertSettings(
        {
          settings: [
            { settingKey: 'inscription_price_cents', label: 'Prix inscription', value: 9900 },
            { settingKey: 'points_per_euro', label: 'Points par euro', value: 1 },
          ],
        },
        'af-user',
        UserRole.ADMINISTRATEUR_FINANCIER,
      );

      expect(result).toHaveLength(2);
      expect(mockEventsService.publish).toHaveBeenCalledWith(
        'RewardSettingUpdated',
        expect.objectContaining({ settingsCount: 2 }),
        undefined,
      );
    });

    it('throws ForbiddenException when requester is not AF', async () => {
      await expect(
        service.upsertSettings(
          { settings: [{ settingKey: 'key', label: 'Label', value: 100 }] },
          'rp-user',
          UserRole.RESPONSABLE_PEDAGOGIQUE,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ---- getFinanceEvents ----

  describe('getFinanceEvents', () => {
    it('returns finance events when requester is AF', async () => {
      const archiveItems = [buildArchiveItem(), buildArchiveItem({ id: 'archive-2' })];
      const mockQueryBuilder = {
        orderBy: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(archiveItems),
      };
      mockArchiveRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.getFinanceEvents(UserRole.ADMINISTRATEUR_FINANCIER);
      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('eventType');
      expect(result[0]).toHaveProperty('ownerId');
      expect(result[0]).toHaveProperty('amountCents');
    });

    it('filters by ownerId when provided', async () => {
      const archiveItems = [buildArchiveItem()];
      const mockQueryBuilder = {
        orderBy: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(archiveItems),
      };
      mockArchiveRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.getFinanceEvents(
        UserRole.ADMINISTRATEUR_FINANCIER,
        'owner-1',
      );

      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'archive.ownerId = :ownerId',
        { ownerId: 'owner-1' },
      );
      expect(result).toHaveLength(1);
    });

    it('throws ForbiddenException when requester is not AF', async () => {
      await expect(
        service.getFinanceEvents(UserRole.FORMATEUR),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
