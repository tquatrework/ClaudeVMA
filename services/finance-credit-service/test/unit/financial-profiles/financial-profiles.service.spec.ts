import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { FinancialProfilesService } from '../../../src/financial-profiles/financial-profiles.service';
import {
  FinancialProfile,
  FinancialProfileType,
  PaymentMethod,
} from '../../../src/financial-profiles/entities/financial-profile.entity';
import { UserRole } from '../../../src/common/enums/user-role.enum';

const mockProfileRepo = {
  findOne: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
};

const buildProfile = (overrides: Partial<FinancialProfile> = {}): FinancialProfile => ({
  id: 'profile-1',
  ownerId: 'owner-1',
  profileType: FinancialProfileType.LIMITE,
  pointsBalance: 0,
  fundingEndDate: null,
  paymentMethod: null,
  paymentReference: null,
  correlationId: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  ...overrides,
});

describe('FinancialProfilesService', () => {
  let service: FinancialProfilesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FinancialProfilesService,
        { provide: getRepositoryToken(FinancialProfile), useValue: mockProfileRepo },
      ],
    }).compile();

    service = module.get<FinancialProfilesService>(FinancialProfilesService);
    jest.clearAllMocks();
  });

  // ---- findByOwnerId ----

  describe('findByOwnerId', () => {
    it('returns profile when requester is the owner', async () => {
      const profile = buildProfile();
      mockProfileRepo.findOne.mockResolvedValue(profile);

      const result = await service.findByOwnerId('owner-1', 'owner-1', UserRole.PARENT_FINANCEUR);
      expect(result).toEqual(profile);
    });

    it('returns profile when requester is AF', async () => {
      const profile = buildProfile();
      mockProfileRepo.findOne.mockResolvedValue(profile);

      const result = await service.findByOwnerId('owner-1', 'af-user', UserRole.ADMINISTRATEUR_FINANCIER);
      expect(result).toEqual(profile);
    });

    it('returns profile when requester is RP', async () => {
      const profile = buildProfile();
      mockProfileRepo.findOne.mockResolvedValue(profile);

      const result = await service.findByOwnerId('owner-1', 'rp-user', UserRole.RESPONSABLE_PEDAGOGIQUE);
      expect(result).toEqual(profile);
    });

    it('throws NotFoundException when profile does not exist', async () => {
      mockProfileRepo.findOne.mockResolvedValue(null);

      await expect(
        service.findByOwnerId('unknown-owner', 'unknown-owner', UserRole.PARENT_FINANCEUR),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when requester is not the owner and not privileged', async () => {
      const profile = buildProfile();
      mockProfileRepo.findOne.mockResolvedValue(profile);

      await expect(
        service.findByOwnerId('owner-1', 'other-user', UserRole.ELEVE),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when formateur tries to read another user profile', async () => {
      const profile = buildProfile();
      mockProfileRepo.findOne.mockResolvedValue(profile);

      await expect(
        service.findByOwnerId('owner-1', 'teacher-1', UserRole.FORMATEUR),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ---- update ----

  describe('update', () => {
    it('owner can update their own payment method', async () => {
      const profile = buildProfile();
      const updatedProfile = { ...profile, paymentMethod: PaymentMethod.PAYPAL };
      mockProfileRepo.findOne.mockResolvedValue(profile);
      mockProfileRepo.save.mockResolvedValue(updatedProfile);

      const result = await service.update(
        'owner-1',
        { paymentMethod: PaymentMethod.PAYPAL },
        'owner-1',
        UserRole.PARENT_FINANCEUR,
      );
      expect(result.paymentMethod).toBe(PaymentMethod.PAYPAL);
    });

    it('AF can update payment parameters on behalf of owner', async () => {
      const profile = buildProfile();
      const updatedProfile = { ...profile, fundingEndDate: '2027-06-30' };
      mockProfileRepo.findOne.mockResolvedValue(profile);
      mockProfileRepo.save.mockResolvedValue(updatedProfile);

      const result = await service.update(
        'owner-1',
        { fundingEndDate: '2027-06-30' },
        'af-user',
        UserRole.ADMINISTRATEUR_FINANCIER,
      );
      expect(result.fundingEndDate).toBe('2027-06-30');
    });

    it('throws NotFoundException when profile does not exist', async () => {
      mockProfileRepo.findOne.mockResolvedValue(null);

      await expect(
        service.update('owner-1', { paymentMethod: PaymentMethod.CB }, 'owner-1', UserRole.PARENT_FINANCEUR),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when RP tries to update (not a write role)', async () => {
      const profile = buildProfile();
      mockProfileRepo.findOne.mockResolvedValue(profile);

      await expect(
        service.update('owner-1', { paymentMethod: PaymentMethod.CB }, 'rp-user', UserRole.RESPONSABLE_PEDAGOGIQUE),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when a different owner tries to update', async () => {
      const profile = buildProfile();
      mockProfileRepo.findOne.mockResolvedValue(profile);

      await expect(
        service.update('owner-1', { paymentMethod: PaymentMethod.CB }, 'other-user', UserRole.PARENT_FINANCEUR),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ---- createOrUpgradeToMembre ----

  describe('createOrUpgradeToMembre', () => {
    it('creates a new profile with MEMBRE type when none exists', async () => {
      const createdProfile = buildProfile({ profileType: FinancialProfileType.MEMBRE });
      mockProfileRepo.findOne.mockResolvedValue(null);
      mockProfileRepo.create.mockReturnValue(createdProfile);
      mockProfileRepo.save.mockResolvedValue(createdProfile);

      const result = await service.createOrUpgradeToMembre('owner-1');
      expect(result.profileType).toBe(FinancialProfileType.MEMBRE);
    });

    it('upgrades existing LIMITE profile to MEMBRE', async () => {
      const existingProfile = buildProfile({ profileType: FinancialProfileType.LIMITE });
      const upgradedProfile = { ...existingProfile, profileType: FinancialProfileType.MEMBRE };
      mockProfileRepo.findOne.mockResolvedValue(existingProfile);
      mockProfileRepo.save.mockResolvedValue(upgradedProfile);

      const result = await service.createOrUpgradeToMembre('owner-1', 'corr-123');
      expect(result.profileType).toBe(FinancialProfileType.MEMBRE);
    });
  });

  // ---- updatePointsBalance ----

  describe('updatePointsBalance', () => {
    it('updates the points balance on an existing profile', async () => {
      const profile = buildProfile({ pointsBalance: 50 });
      const updatedProfile = { ...profile, pointsBalance: 150 };
      mockProfileRepo.findOne.mockResolvedValue(profile);
      mockProfileRepo.save.mockResolvedValue(updatedProfile);

      await service.updatePointsBalance('owner-1', 150);
      expect(mockProfileRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ pointsBalance: 150 }),
      );
    });

    it('throws NotFoundException when profile does not exist', async () => {
      mockProfileRepo.findOne.mockResolvedValue(null);

      await expect(service.updatePointsBalance('unknown-owner', 100)).rejects.toThrow(NotFoundException);
    });
  });
});
