import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { DelegationsService } from '../../src/delegations/delegations.service';
import { DelegatedAccessRequest, DelegationStatus } from '../../src/delegations/entities/delegated-access-request.entity';
import { UserRole } from '../../src/auth/entities/user.entity';
import { EventsService } from '../../src/events/events.service';
import { AccountsService } from '../../src/accounts/accounts.service';
import { buildTransactionalDataSourceMock } from './helpers/mock-transactional-data-source';

const makeActor = (overrides: Partial<{ id: string; role: UserRole }> = {}) => ({
  id: 'actor-uuid',
  role: UserRole.RESPONSABLE_PEDAGOGIQUE,
  ...overrides,
});

describe('DelegationsService', () => {
  let service: DelegationsService;
  let delegationRepo: any;
  let eventsService: EventsService;
  let accountsService: { accountExists: jest.Mock; recordAudit: jest.Mock };

  beforeEach(async () => {
    delegationRepo = {
      create: jest.fn().mockImplementation((entity) => entity),
      save: jest.fn().mockImplementation(async (entity) => ({ id: 'delegation-uuid', ...entity })),
      find: jest.fn().mockResolvedValue([]),
    };

    accountsService = {
      accountExists: jest.fn().mockResolvedValue(true),
      recordAudit: jest.fn().mockResolvedValue(undefined),
    };

    const dataSourceMock = buildTransactionalDataSourceMock([[DelegatedAccessRequest, delegationRepo]]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DelegationsService,
        { provide: getRepositoryToken(DelegatedAccessRequest), useValue: delegationRepo },
        { provide: EventsService, useValue: { publish: jest.fn() } },
        { provide: AccountsService, useValue: accountsService },
        { provide: DataSource, useValue: dataSourceMock },
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
      const rpActor = makeActor({ role: UserRole.RESPONSABLE_PEDAGOGIQUE });
      const result = await service.createDelegation(dto, rpActor);

      expect(result).toHaveProperty('id');
      expect(result.status).toBe(DelegationStatus.PENDING);
      expect(accountsService.recordAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'DELEGATION_CREATED', targetUserId: 'target-uuid' }),
        expect.anything(),
      );
      expect(eventsService.publish).toHaveBeenCalledWith('DelegatedAccessGranted', expect.any(Object));
    });

    it('creates a delegation request for TI actor', async () => {
      const tiActor = makeActor({ id: 'ti-uuid', role: UserRole.TECHNICIEN_INFORMATIQUE });
      const result = await service.createDelegation(dto, tiActor);

      expect(result.actorId).toBe('ti-uuid');
    });

    it('throws 403 when a non-RP/TI actor tries to create a delegation', async () => {
      const eleveActor = makeActor({ role: UserRole.ELEVE });
      await expect(service.createDelegation(dto, eleveActor)).rejects.toThrow(ForbiddenException);
    });

    it('throws 404 when target user does not exist', async () => {
      accountsService.accountExists.mockResolvedValue(false);
      const rpActor = makeActor({ role: UserRole.RESPONSABLE_PEDAGOGIQUE });
      await expect(
        service.createDelegation({ ...dto, targetUserId: 'ghost-uuid' }, rpActor),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('listDelegations', () => {
    it('returns delegation list for RP actor', async () => {
      const delegations = [{ id: 'delegation-uuid', actorId: 'actor-uuid' }];
      delegationRepo.find.mockResolvedValue(delegations);
      const rpActor = makeActor({ role: UserRole.RESPONSABLE_PEDAGOGIQUE });

      const result = await service.listDelegations(rpActor);
      expect(result).toEqual(delegations);
    });

    it('throws 403 when a non-RP/TI actor lists delegations', async () => {
      const eleveActor = makeActor({ role: UserRole.ELEVE });
      await expect(service.listDelegations(eleveActor)).rejects.toThrow(ForbiddenException);
    });
  });
});
