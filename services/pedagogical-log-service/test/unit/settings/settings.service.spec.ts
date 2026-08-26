/**
 * Unit tests — PedagogicalLogSettingsService
 *
 * Arbitrage du 2026-08-26, point 6/7/9 : réglages TI des pièces jointes,
 * table à une seule ligne, valeurs par défaut (activé, 100 000 o par
 * fichier, 5 000 000 o par entrée).
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { PedagogicalLogSettingsService } from '../../../src/settings/settings.service';
import {
  PedagogicalLogSettings,
  PEDAGOGICAL_LOG_SETTINGS_SINGLETON_ID,
} from '../../../src/settings/entities/pedagogical-log-settings.entity';

function buildMockRepository() {
  return {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
  };
}

function buildDefaultSettings(overrides: Partial<PedagogicalLogSettings> = {}): PedagogicalLogSettings {
  return {
    id: PEDAGOGICAL_LOG_SETTINGS_SINGLETON_ID,
    attachmentsEnabled: true,
    maxFileBytes: 100000,
    maxTotalBytesPerEntry: 5000000,
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  } as PedagogicalLogSettings;
}

describe('PedagogicalLogSettingsService', () => {
  let service: PedagogicalLogSettingsService;
  let mockRepository: ReturnType<typeof buildMockRepository>;

  beforeEach(async () => {
    mockRepository = buildMockRepository();
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        PedagogicalLogSettingsService,
        { provide: getRepositoryToken(PedagogicalLogSettings), useValue: mockRepository },
      ],
    }).compile();

    service = moduleRef.get(PedagogicalLogSettingsService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('getSettings()', () => {
    it('renvoie la ligne existante si présente', async () => {
      const existing = buildDefaultSettings({ maxFileBytes: 200000 });
      mockRepository.findOne.mockResolvedValue(existing);

      const result = await service.getSettings();

      expect(result).toBe(existing);
      expect(mockRepository.create).not.toHaveBeenCalled();
    });

    it('[CRITIQUE] crée la ligne singleton avec les valeurs par défaut si absente', async () => {
      mockRepository.findOne.mockResolvedValue(null);
      const created = buildDefaultSettings();
      mockRepository.create.mockReturnValue(created);
      mockRepository.save.mockResolvedValue(created);

      const result = await service.getSettings();

      expect(mockRepository.create).toHaveBeenCalledWith({ id: PEDAGOGICAL_LOG_SETTINGS_SINGLETON_ID });
      expect(result.attachmentsEnabled).toBe(true);
      expect(result.maxFileBytes).toBe(100000);
      expect(result.maxTotalBytesPerEntry).toBe(5000000);
    });
  });

  describe('updateSettings()', () => {
    it('modifie uniquement les champs fournis (mise à jour partielle)', async () => {
      const existing = buildDefaultSettings();
      mockRepository.findOne.mockResolvedValue(existing);
      mockRepository.save.mockImplementation(async (s) => s);

      const result = await service.updateSettings({ attachmentsEnabled: false });

      expect(result.attachmentsEnabled).toBe(false);
      expect(result.maxFileBytes).toBe(100000); // inchangé
    });

    it('[CRITIQUE] refuse un plafond par fichier supérieur au plafond total → BadRequestException', async () => {
      const existing = buildDefaultSettings();
      mockRepository.findOne.mockResolvedValue(existing);

      await expect(
        service.updateSettings({ maxFileBytes: 10000000 }),
      ).rejects.toThrow(BadRequestException);
      expect(mockRepository.save).not.toHaveBeenCalled();
    });

    it('accepte un plafond par fichier égal au plafond total', async () => {
      const existing = buildDefaultSettings();
      mockRepository.findOne.mockResolvedValue(existing);
      mockRepository.save.mockImplementation(async (s) => s);

      const result = await service.updateSettings({
        maxFileBytes: 5000000,
        maxTotalBytesPerEntry: 5000000,
      });

      expect(result.maxFileBytes).toBe(5000000);
    });
  });
});
