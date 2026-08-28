/**
 * Unit tests — NotebookAccessSettingsService
 *
 * Arbitrage du 2026-08-28 (docs/architecture.md, "Acces administratif et
 * parental au carnet personnel — parametrable par le TI, defaut ferme") :
 * réglages TI d'accès en lecture seule au carnet personnel d'un tiers, table
 * à une seule ligne, valeurs par défaut fermées (`adminAccess = 'none'`,
 * `parentAccessToOwnChild = false`).
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotebookAccessSettingsService } from '../../../src/settings/notebook-access-settings.service';
import {
  NotebookAccessSettings,
  NotebookAdminAccess,
  NOTEBOOK_ACCESS_SETTINGS_SINGLETON_ID,
} from '../../../src/settings/entities/notebook-access-settings.entity';

function buildMockRepository() {
  return {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
  };
}

function buildDefaultSettings(
  overrides: Partial<NotebookAccessSettings> = {},
): NotebookAccessSettings {
  return {
    id: NOTEBOOK_ACCESS_SETTINGS_SINGLETON_ID,
    adminAccess: NotebookAdminAccess.NONE,
    parentAccessToOwnChild: false,
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  } as NotebookAccessSettings;
}

describe('NotebookAccessSettingsService', () => {
  let service: NotebookAccessSettingsService;
  let mockRepository: ReturnType<typeof buildMockRepository>;

  beforeEach(async () => {
    mockRepository = buildMockRepository();
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        NotebookAccessSettingsService,
        { provide: getRepositoryToken(NotebookAccessSettings), useValue: mockRepository },
      ],
    }).compile();

    service = moduleRef.get(NotebookAccessSettingsService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('getSettings()', () => {
    it('renvoie la ligne existante si présente', async () => {
      const existing = buildDefaultSettings({ adminAccess: NotebookAdminAccess.RP });
      mockRepository.findOne.mockResolvedValue(existing);

      const result = await service.getSettings();

      expect(result).toBe(existing);
      expect(mockRepository.create).not.toHaveBeenCalled();
    });

    it('[CRITIQUE] crée la ligne singleton avec les valeurs par défaut FERMÉES si absente', async () => {
      mockRepository.findOne.mockResolvedValue(null);
      const created = buildDefaultSettings();
      mockRepository.create.mockReturnValue(created);
      mockRepository.save.mockResolvedValue(created);

      const result = await service.getSettings();

      expect(mockRepository.create).toHaveBeenCalledWith({ id: NOTEBOOK_ACCESS_SETTINGS_SINGLETON_ID });
      expect(result.adminAccess).toBe(NotebookAdminAccess.NONE);
      expect(result.parentAccessToOwnChild).toBe(false);
    });
  });

  describe('updateSettings()', () => {
    it('modifie uniquement les champs fournis (mise à jour partielle)', async () => {
      const existing = buildDefaultSettings();
      mockRepository.findOne.mockResolvedValue(existing);
      mockRepository.save.mockImplementation(async (s) => s);

      const result = await service.updateSettings({ adminAccess: NotebookAdminAccess.ALL_ADMINS });

      expect(result.adminAccess).toBe(NotebookAdminAccess.ALL_ADMINS);
      expect(result.parentAccessToOwnChild).toBe(false); // inchangé
    });

    it('modifie parentAccessToOwnChild indépendamment de adminAccess', async () => {
      const existing = buildDefaultSettings({ adminAccess: NotebookAdminAccess.RP });
      mockRepository.findOne.mockResolvedValue(existing);
      mockRepository.save.mockImplementation(async (s) => s);

      const result = await service.updateSettings({ parentAccessToOwnChild: true });

      expect(result.parentAccessToOwnChild).toBe(true);
      expect(result.adminAccess).toBe(NotebookAdminAccess.RP); // inchangé
    });
  });
});
