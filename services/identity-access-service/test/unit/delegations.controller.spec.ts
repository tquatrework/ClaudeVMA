import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { DelegationsController } from '../../src/delegations/delegations.controller';
import { DelegationsService } from '../../src/delegations/delegations.service';
import { DelegationStatus } from '../../src/delegations/entities/delegated-access-request.entity';
import { UserRole, ValidationStatus } from '../../src/auth/entities/user.entity';

const makeActor = (role: UserRole, id = 'actor-uuid') => ({
  id,
  email: 'actor@test.com',
  role,
  validationStatus: ValidationStatus.ACTIVE,
  consentSigned: true,
  isActive: true,
});

const makeDelegation = (overrides = {}) => ({
  id: 'delegation-uuid',
  actorId: 'actor-uuid',
  targetUserId: 'target-uuid',
  actionDescription: 'Modification du profil administratif',
  reason: 'Blocage signalé par utilisateur',
  status: DelegationStatus.PENDING,
  consentedAt: null,
  createdAt: new Date(),
  ...overrides,
});

const mockDelegationsService = {
  createDelegation: jest.fn(),
  listDelegations: jest.fn(),
};

describe('DelegationsController', () => {
  let controller: DelegationsController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DelegationsController],
      providers: [{ provide: DelegationsService, useValue: mockDelegationsService }],
    }).compile();

    controller = module.get<DelegationsController>(DelegationsController);
  });

  // ── POST /delegations ────────────────────────────────────────────────────────

  describe('POST /delegations — createDelegation', () => {
    const delegationDto = {
      targetUserId: 'target-uuid',
      actionDescription: 'Modification du profil administratif',
      reason: 'Blocage signalé par utilisateur',
    };

    it('creates a delegation request for an RP actor', async () => {
      const delegation = makeDelegation();
      mockDelegationsService.createDelegation.mockResolvedValue(delegation);

      const rpRequest = { user: makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE) };
      const result = await controller.createDelegation(delegationDto, rpRequest);

      expect(result).toEqual(delegation);
      expect(mockDelegationsService.createDelegation).toHaveBeenCalledWith(delegationDto, rpRequest.user);
    });

    it('creates a delegation request for a TI actor', async () => {
      const delegation = makeDelegation({ actorId: 'ti-uuid' });
      mockDelegationsService.createDelegation.mockResolvedValue(delegation);

      const tiRequest = { user: makeActor(UserRole.TECHNICIEN_INFORMATIQUE, 'ti-uuid') };
      const result = await controller.createDelegation(delegationDto, tiRequest);

      expect(result.actorId).toBe('ti-uuid');
    });

    it('propagates 403 when a non-RP/TI actor tries to create a delegation', async () => {
      mockDelegationsService.createDelegation.mockRejectedValue(
        new ForbiddenException('Only RP or TI can create delegation requests'),
      );
      const eleveRequest = { user: makeActor(UserRole.ELEVE) };

      await expect(controller.createDelegation(delegationDto, eleveRequest)).rejects.toThrow(ForbiddenException);
    });

    it('propagates 404 when the target user does not exist', async () => {
      mockDelegationsService.createDelegation.mockRejectedValue(
        new NotFoundException('Target account ghost-uuid not found'),
      );
      const rpRequest = { user: makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE) };

      await expect(
        controller.createDelegation({ ...delegationDto, targetUserId: 'ghost-uuid' }, rpRequest),
      ).rejects.toThrow(NotFoundException);
    });

    it('returns delegation with PENDING status on creation', async () => {
      const delegation = makeDelegation({ status: DelegationStatus.PENDING });
      mockDelegationsService.createDelegation.mockResolvedValue(delegation);

      const rpRequest = { user: makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE) };
      const result = await controller.createDelegation(delegationDto, rpRequest);

      expect(result.status).toBe(DelegationStatus.PENDING);
    });
  });

  // ── GET /delegations ─────────────────────────────────────────────────────────

  describe('GET /delegations — listDelegations', () => {
    it('returns delegation list for an RP actor', async () => {
      const delegations = [makeDelegation()];
      mockDelegationsService.listDelegations.mockResolvedValue(delegations);

      const rpRequest = { user: makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE) };
      const result = await controller.listDelegations(rpRequest);

      expect(result).toEqual(delegations);
      expect(mockDelegationsService.listDelegations).toHaveBeenCalledWith(rpRequest.user);
    });

    it('returns delegation list for a TI actor', async () => {
      const delegations = [makeDelegation({ actorId: 'ti-uuid' })];
      mockDelegationsService.listDelegations.mockResolvedValue(delegations);

      const tiRequest = { user: makeActor(UserRole.TECHNICIEN_INFORMATIQUE, 'ti-uuid') };
      const result = await controller.listDelegations(tiRequest);

      expect(result).toHaveLength(1);
    });

    it('returns an empty list when actor has no delegations', async () => {
      mockDelegationsService.listDelegations.mockResolvedValue([]);

      const rpRequest = { user: makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE) };
      const result = await controller.listDelegations(rpRequest);

      expect(result).toEqual([]);
    });

    it('propagates 403 when a non-RP/TI actor tries to list delegations', async () => {
      mockDelegationsService.listDelegations.mockRejectedValue(
        new ForbiddenException('Only RP or TI can list delegation requests'),
      );
      const eleveRequest = { user: makeActor(UserRole.ELEVE) };

      await expect(controller.listDelegations(eleveRequest)).rejects.toThrow(ForbiddenException);
    });
  });
});
