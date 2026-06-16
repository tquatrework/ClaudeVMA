import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException } from '@nestjs/common';
import { FinancialArchivesService } from '../../../src/financial-archives/financial-archives.service';
import {
  FinancialArchiveItem,
  ArchiveItemType,
} from '../../../src/financial-archives/entities/financial-archive-item.entity';
import { UserRole } from '../../../src/common/enums/user-role.enum';

const mockArchiveRepo = {
  find: jest.fn(),
};

const buildArchiveItem = (overrides: Partial<FinancialArchiveItem> = {}): FinancialArchiveItem => ({
  id: 'archive-1',
  ownerId: 'owner-1',
  itemType: ArchiveItemType.PAYMENT,
  referenceId: 'payment-1',
  label: 'inscription — €99.00 — Facture VM-20260116-PAYMENT1',
  amountCents: 9900,
  balanceSnapshot: null,
  correlationId: null,
  occurredAt: new Date('2026-01-15'),
  ...overrides,
});

describe('FinancialArchivesService', () => {
  let service: FinancialArchivesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FinancialArchivesService,
        { provide: getRepositoryToken(FinancialArchiveItem), useValue: mockArchiveRepo },
      ],
    }).compile();

    service = module.get<FinancialArchivesService>(FinancialArchivesService);
    jest.clearAllMocks();
  });

  // ---- findAllByOwner ----

  describe('findAllByOwner', () => {
    it('returns archive items when requester is the owner', async () => {
      const items = [buildArchiveItem(), buildArchiveItem({ id: 'archive-2' })];
      mockArchiveRepo.find.mockResolvedValue(items);

      const result = await service.findAllByOwner('owner-1', 'owner-1', UserRole.PARENT_FINANCEUR);
      expect(result).toHaveLength(2);
      expect(mockArchiveRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { ownerId: 'owner-1' } }),
      );
    });

    it('returns archive items when requester is AF', async () => {
      const items = [buildArchiveItem()];
      mockArchiveRepo.find.mockResolvedValue(items);

      const result = await service.findAllByOwner('owner-1', 'af-user', UserRole.ADMINISTRATEUR_FINANCIER);
      expect(result).toHaveLength(1);
    });

    it('returns archive items when requester is RP', async () => {
      const items = [buildArchiveItem()];
      mockArchiveRepo.find.mockResolvedValue(items);

      const result = await service.findAllByOwner('owner-1', 'rp-user', UserRole.RESPONSABLE_PEDAGOGIQUE);
      expect(result).toHaveLength(1);
    });

    it('returns archive items when requester is TI', async () => {
      const items = [buildArchiveItem()];
      mockArchiveRepo.find.mockResolvedValue(items);

      const result = await service.findAllByOwner('owner-1', 'ti-user', UserRole.TECHNICIEN_INFORMATIQUE);
      expect(result).toHaveLength(1);
    });

    it('returns empty array when owner has no archive items', async () => {
      mockArchiveRepo.find.mockResolvedValue([]);

      const result = await service.findAllByOwner('owner-1', 'owner-1', UserRole.PARENT_FINANCEUR);
      expect(result).toHaveLength(0);
    });

    it('throws ForbiddenException when requester is a different user without privilege', async () => {
      await expect(
        service.findAllByOwner('owner-1', 'other-user', UserRole.ELEVE),
      ).rejects.toThrow(ForbiddenException);
      expect(mockArchiveRepo.find).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when formateur tries to access another user archives', async () => {
      await expect(
        service.findAllByOwner('owner-1', 'teacher-1', UserRole.FORMATEUR),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
