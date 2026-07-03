import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { DelegationsService } from '../../src/delegations/delegations.service';
import { DelegatedAccessRequest, DelegationStatus } from '../../src/delegations/entities/delegated-access-request.entity';
import { User, UserRole, ValidationStatus } from '../../src/auth/entities/user.entity';
import { AuditLog } from '../../src/accounts/entities/audit-log.entity';
import { EventsService } from '../../src/events/events.service';

const makeUser = (overrides: Partial<User> = {}): User => ({
  id: 'actor-uuid',
  loginIdentifier: 'actor.user',
  email: 'actor@test.com',
  passwordHash: 'hash',
  role: UserRole.RESPONSABLE_PEDAGOGIQUE,
  validationStatus: ValidationStatus.ACTIVE,
  consentSigned: true,
  firstName: null,
  lastName: null,
  phone: null,
  isActive: true,
  emailVerified: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const targetUser = makeUser({ id: 'target-uuid', email: 'target@test.com', role: UserRole.ELEVE });

describe('DelegationsService', () => {
  let service: DelegationsService;
  let delegationRepo: any;
  let userRepo: any;
  let auditRepo: any;
  let eventsService: EventsService;

  beforeEach(async () => {
    delegationRepo = {
      create: jest.fn().mockImplementation((entity) => entity),
      save: jest.fn().mockImplementation(async (entity) => ({ id: 'delegation-uuid', ...entity })),
      find: jest.fn().mockResolvedValue([]),
    };

    userRepo = {
      findOne: jest.fn().mockResolvedValue(targetUser),
    };

    auditRepo = {
      create: jest.fn().mockImplementation((entity) => entity),
      save: jest.fn().mockResolvedValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DelegationsService,
        { provide: getRepositoryToken(DelegatedAccessRequest), useValue: delegationRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(AuditLog), useValue: auditRepo },
        { provide: EventsService, useValue: { publish: jest.fn() } },
      ],
    }).compile();

    service = module.get<DelegationsService>(DelegationsService);
    eventsService = module.get<EventsService>(EventsService);
  });

  describe('createDelegation', () => {
    const dto = {
      targetUserId: 'target-uuid',
      actionDescription: 'Modification du profil administratif',
      reason: 'Blocage signalé par utilisateur',
    };

    it('creates a delegation request for RP actor and audit-logs it', async () => {
      const rpActor = makeUser({ role: UserRole.RESPONSABLE_PEDAGOGIQUE });
      const result = await service.createDelegation(dto, rpActor);

      expect(result).toHaveProperty('id');
      expect(result.status).toBe(DelegationStatus.PENDING);
      expect(auditRepo.save).toHaveBeenCalled();
      expect(eventsService.publish).toHaveBeenCalledWith('DelegatedAccessGranted', expect.any(Object));
    });

    it('creates a delegation request for TI actor', async () => {
      const tiActor = makeUser({ id: 'ti-uuid', role: UserRole.TECHNICIEN_INFORMATIQUE });
      const result = await service.createDelegation(dto, tiActor);

      expect(result.actorId).toBe('ti-uuid');
    });

    it('throws 403 when a non-RP/TI actor tries to create a delegation', async () => {
      const eleveActor = makeUser({ role: UserRole.ELEVE });
      await expect(service.createDelegation(dto, eleveActor)).rejects.toThrow(ForbiddenException);
    });

    it('throws 404 when target user does not exist', async () => {
      userRepo.findOne.mockResolvedValue(null);
      const rpActor = makeUser({ role: UserRole.RESPONSABLE_PEDAGOGIQUE });
      await expect(
        service.createDelegation({ ...dto, targetUserId: 'ghost-uuid' }, rpActor),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('listDelegations', () => {
    it('returns delegation list for RP actor', async () => {
      const delegations = [{ id: 'delegation-uuid', actorId: 'actor-uuid' }];
      delegationRepo.find.mockResolvedValue(delegations);
      const rpActor = makeUser({ role: UserRole.RESPONSABLE_PEDAGOGIQUE });

      const result = await service.listDelegations(rpActor);
      expect(result).toEqual(delegations);
    });

    it('throws 403 when a non-RP/TI actor lists delegations', async () => {
      const eleveActor = makeUser({ role: UserRole.ELEVE });
      await expect(service.listDelegations(eleveActor)).rejects.toThrow(ForbiddenException);
    });
  });
});
