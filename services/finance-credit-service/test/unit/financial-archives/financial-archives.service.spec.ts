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

  // ---- Access driven by ownership, not by a role allowlist ----
  // Regression guard for the 2026-08-11 defect: a formateur was denied access to their
  // OWN financial archives because their role was missing from an allowlist.

  describe('findAllByOwner — the owner lists their own archives, whatever their role', () => {
    const ownerRoles = [
      UserRole.PARENT_FINANCEUR,
      UserRole.FORMATEUR,
      UserRole.ANIMATEUR_PEDAGOGIQUE,
      UserRole.ELEVE,
    ];

    it.each(ownerRoles)('allows a %s to list their own financial archives', async (role) => {
      mockArchiveRepo.find.mockResolvedValue([buildArchiveItem({ ownerId: 'self-1' })]);

      const result = await service.findAllByOwner('self-1', 'self-1', role);
      expect(result).toHaveLength(1);
      expect(mockArchiveRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { ownerId: 'self-1' } }),
      );
    });

    it.each(ownerRoles)(
      'returns an empty list (not an error) when a %s has no financial event yet',
      async (role) => {
        mockArchiveRepo.find.mockResolvedValue([]);

        const result = await service.findAllByOwner('self-1', 'self-1', role);
        expect(result).toEqual([]);
      },
    );
  });

  describe('findAllByOwner — listing someone else stays restricted', () => {
    it.each([
      UserRole.PARENT_FINANCEUR,
      UserRole.FORMATEUR,
      UserRole.ANIMATEUR_PEDAGOGIQUE,
      UserRole.ELEVE,
    ])('denies a %s access to third party archives', async (role) => {
      await expect(
        service.findAllByOwner('someone-else', 'self-1', role),
      ).rejects.toThrow(ForbiddenException);
      expect(mockArchiveRepo.find).not.toHaveBeenCalled();
    });

    it.each([
      UserRole.ADMINISTRATEUR_FINANCIER,
      UserRole.RESPONSABLE_PEDAGOGIQUE,
      UserRole.TECHNICIEN_INFORMATIQUE,
    ])('still allows a %s to list third party archives', async (role) => {
      mockArchiveRepo.find.mockResolvedValue([buildArchiveItem({ ownerId: 'someone-else' })]);

      const result = await service.findAllByOwner('someone-else', 'admin-1', role);
      expect(result).toHaveLength(1);
    });
  });
});
