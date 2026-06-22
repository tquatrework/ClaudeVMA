import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ParentLinkRequestsService } from '../../../src/parent-link-requests/parent-link-requests.service';
import {
  ParentLinkRequest,
  ParentLinkRequestStatus,
} from '../../../src/parent-link-requests/entities/parent-link-request.entity';
import { StudentPedagogicalProfile } from '../../../src/profiles/entities/student-pedagogical-profile.entity';
import { FinanceOwnerStudentLink } from '../../../src/relations/entities/finance-owner-student-link.entity';
import { UserRole } from '../../../src/common/enums/user-role.enum';
import { Actor } from '../../../src/profiles/profiles.service';

const makeActor = (role: UserRole, id = 'actor-uuid'): Actor => ({ id, role });

const makeRequest = (overrides: Partial<ParentLinkRequest> = {}): ParentLinkRequest => ({
  id: 'request-uuid',
  parentId: 'parent-uuid',
  studentId: 'student-uuid',
  status: ParentLinkRequestStatus.PENDING,
  requestedAt: new Date(),
  processedAt: null,
  processedBy: null,
  ...overrides,
});

describe('ParentLinkRequestsService', () => {
  let service: ParentLinkRequestsService;
  let requestRepo: any;
  let studentPedaRepo: any;
  let financeLinkRepo: any;
  let configService: any;

  beforeEach(async () => {
    requestRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockImplementation((dto) => ({ ...dto })),
      save: jest.fn().mockImplementation(async (entity) => ({
        id: 'request-uuid',
        requestedAt: new Date(),
        ...entity,
      })),
    };

    studentPedaRepo = {
      findOne: jest.fn().mockResolvedValue({ userId: 'student-uuid' }),
    };

    financeLinkRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((dto) => ({ ...dto })),
      save: jest.fn().mockImplementation(async (entity) => ({
        id: 'link-uuid',
        createdAt: new Date(),
        ...entity,
      })),
    };

    configService = {
      get: jest.fn().mockReturnValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ParentLinkRequestsService,
        { provide: getRepositoryToken(ParentLinkRequest), useValue: requestRepo },
        { provide: getRepositoryToken(StudentPedagogicalProfile), useValue: studentPedaRepo },
        { provide: getRepositoryToken(FinanceOwnerStudentLink), useValue: financeLinkRepo },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<ParentLinkRequestsService>(ParentLinkRequestsService);
  });

  // ---------------------------------------------------------------------------
  // createRequest
  // ---------------------------------------------------------------------------
  describe('createRequest', () => {
    const dto = { studentId: 'student-uuid' };

    it('parent_financeur can submit a request for an existing student', async () => {
      const actor = makeActor(UserRole.PARENT_FINANCEUR, 'parent-uuid');
      const result = await service.createRequest(dto, actor);
      expect(result).toHaveProperty('parentId', 'parent-uuid');
      expect(result).toHaveProperty('studentId', 'student-uuid');
      expect(result).toHaveProperty('status', ParentLinkRequestStatus.PENDING);
    });

    it('throws 403 for non-parent_financeur roles', async () => {
      const actor = makeActor(UserRole.ELEVE);
      await expect(service.createRequest(dto, actor)).rejects.toThrow(ForbiddenException);
    });

    it('throws 403 for responsable_pedagogique', async () => {
      const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE);
      await expect(service.createRequest(dto, actor)).rejects.toThrow(ForbiddenException);
    });

    it('throws 400 when student profile does not exist', async () => {
      studentPedaRepo.findOne.mockResolvedValue(null);
      const actor = makeActor(UserRole.PARENT_FINANCEUR);
      await expect(service.createRequest(dto, actor)).rejects.toThrow(BadRequestException);
    });

    it('throws 409 when a pending request already exists for this pair', async () => {
      requestRepo.findOne.mockResolvedValue(makeRequest());
      const actor = makeActor(UserRole.PARENT_FINANCEUR, 'parent-uuid');
      await expect(service.createRequest(dto, actor)).rejects.toThrow(ConflictException);
    });

    it('creates a new request when no pending request exists', async () => {
      requestRepo.findOne.mockResolvedValue(null);
      const actor = makeActor(UserRole.PARENT_FINANCEUR, 'parent-uuid');
      await service.createRequest(dto, actor);
      expect(requestRepo.save).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // listRequests
  // ---------------------------------------------------------------------------
  describe('listRequests', () => {
    it('parent_financeur sees only their own requests', async () => {
      requestRepo.find.mockResolvedValue([makeRequest({ parentId: 'parent-uuid' })]);
      const actor = makeActor(UserRole.PARENT_FINANCEUR, 'parent-uuid');
      const result = await service.listRequests(actor);
      expect(requestRepo.find).toHaveBeenCalledWith({
        where: { parentId: 'parent-uuid' },
        order: { requestedAt: 'DESC' },
      });
      expect(result).toHaveLength(1);
    });

    it('eleve sees only requests targeting them', async () => {
      requestRepo.find.mockResolvedValue([makeRequest({ studentId: 'student-uuid' })]);
      const actor = makeActor(UserRole.ELEVE, 'student-uuid');
      const result = await service.listRequests(actor);
      expect(requestRepo.find).toHaveBeenCalledWith({
        where: { studentId: 'student-uuid' },
        order: { requestedAt: 'DESC' },
      });
      expect(result).toHaveLength(1);
    });

    it('responsable_pedagogique sees all requests', async () => {
      requestRepo.find.mockResolvedValue([makeRequest(), makeRequest({ id: 'other-uuid' })]);
      const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE);
      const result = await service.listRequests(actor);
      expect(requestRepo.find).toHaveBeenCalledWith({ order: { requestedAt: 'DESC' } });
      expect(result).toHaveLength(2);
    });

    it('technicien_informatique sees all requests', async () => {
      requestRepo.find.mockResolvedValue([makeRequest()]);
      const actor = makeActor(UserRole.TECHNICIEN_INFORMATIQUE);
      await service.listRequests(actor);
      expect(requestRepo.find).toHaveBeenCalledWith({ order: { requestedAt: 'DESC' } });
    });

    it('throws 403 for formateur', async () => {
      const actor = makeActor(UserRole.FORMATEUR);
      await expect(service.listRequests(actor)).rejects.toThrow(ForbiddenException);
    });

    it('throws 403 for administrateur_financier', async () => {
      const actor = makeActor(UserRole.ADMINISTRATEUR_FINANCIER);
      await expect(service.listRequests(actor)).rejects.toThrow(ForbiddenException);
    });
  });

  // ---------------------------------------------------------------------------
  // approveRequest
  // ---------------------------------------------------------------------------
  describe('approveRequest', () => {
    it('targeted élève can approve a request targeting them', async () => {
      const pendingRequest = makeRequest({ studentId: 'student-uuid' });
      requestRepo.findOne.mockResolvedValue(pendingRequest);

      const actor = makeActor(UserRole.ELEVE, 'student-uuid');
      const result = await service.approveRequest('request-uuid', actor);

      expect(result).toHaveProperty('status', ParentLinkRequestStatus.APPROVED);
      expect(result).toHaveProperty('processedBy', 'student-uuid');
      expect(financeLinkRepo.save).toHaveBeenCalled();
    });

    it('RP can approve any request', async () => {
      const pendingRequest = makeRequest();
      requestRepo.findOne.mockResolvedValue(pendingRequest);

      const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE);
      const result = await service.approveRequest('request-uuid', actor);

      expect(result).toHaveProperty('status', ParentLinkRequestStatus.APPROVED);
    });

    it('TI can approve any request', async () => {
      const pendingRequest = makeRequest();
      requestRepo.findOne.mockResolvedValue(pendingRequest);

      const actor = makeActor(UserRole.TECHNICIEN_INFORMATIQUE);
      const result = await service.approveRequest('request-uuid', actor);

      expect(result).toHaveProperty('status', ParentLinkRequestStatus.APPROVED);
    });

    it('throws 403 when élève is not the targeted student', async () => {
      const pendingRequest = makeRequest({ studentId: 'other-student-uuid' });
      requestRepo.findOne.mockResolvedValue(pendingRequest);

      const actor = makeActor(UserRole.ELEVE, 'student-uuid');
      await expect(service.approveRequest('request-uuid', actor)).rejects.toThrow(ForbiddenException);
    });

    it('throws 403 for parent_financeur', async () => {
      requestRepo.findOne.mockResolvedValue(makeRequest());
      const actor = makeActor(UserRole.PARENT_FINANCEUR);
      await expect(service.approveRequest('request-uuid', actor)).rejects.toThrow(ForbiddenException);
    });

    it('throws 404 when request does not exist', async () => {
      requestRepo.findOne.mockResolvedValue(null);
      const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE);
      await expect(service.approveRequest('nonexistent-uuid', actor)).rejects.toThrow(NotFoundException);
    });

    it('throws 409 when request is already approved', async () => {
      requestRepo.findOne.mockResolvedValue(makeRequest({ status: ParentLinkRequestStatus.APPROVED }));
      const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE);
      await expect(service.approveRequest('request-uuid', actor)).rejects.toThrow(ConflictException);
    });

    it('throws 409 when request is already rejected', async () => {
      requestRepo.findOne.mockResolvedValue(makeRequest({ status: ParentLinkRequestStatus.REJECTED }));
      const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE);
      await expect(service.approveRequest('request-uuid', actor)).rejects.toThrow(ConflictException);
    });

    it('does not create a duplicate finance link if one already exists', async () => {
      requestRepo.findOne.mockResolvedValue(makeRequest());
      financeLinkRepo.findOne.mockResolvedValue({ id: 'existing-link' });

      const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE);
      await service.approveRequest('request-uuid', actor);

      expect(financeLinkRepo.save).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // rejectRequest
  // ---------------------------------------------------------------------------
  describe('rejectRequest', () => {
    it('targeted élève can reject a request targeting them', async () => {
      const pendingRequest = makeRequest({ studentId: 'student-uuid' });
      requestRepo.findOne.mockResolvedValue(pendingRequest);

      const actor = makeActor(UserRole.ELEVE, 'student-uuid');
      const result = await service.rejectRequest('request-uuid', actor);

      expect(result).toHaveProperty('status', ParentLinkRequestStatus.REJECTED);
      expect(result).toHaveProperty('processedBy', 'student-uuid');
      expect(financeLinkRepo.save).not.toHaveBeenCalled();
    });

    it('RP can reject any request', async () => {
      requestRepo.findOne.mockResolvedValue(makeRequest());
      const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE);
      const result = await service.rejectRequest('request-uuid', actor);
      expect(result).toHaveProperty('status', ParentLinkRequestStatus.REJECTED);
    });

    it('TI can reject any request', async () => {
      requestRepo.findOne.mockResolvedValue(makeRequest());
      const actor = makeActor(UserRole.TECHNICIEN_INFORMATIQUE);
      const result = await service.rejectRequest('request-uuid', actor);
      expect(result).toHaveProperty('status', ParentLinkRequestStatus.REJECTED);
    });

    it('throws 403 when élève is not the targeted student', async () => {
      requestRepo.findOne.mockResolvedValue(makeRequest({ studentId: 'other-student-uuid' }));
      const actor = makeActor(UserRole.ELEVE, 'student-uuid');
      await expect(service.rejectRequest('request-uuid', actor)).rejects.toThrow(ForbiddenException);
    });

    it('throws 403 for parent_financeur', async () => {
      requestRepo.findOne.mockResolvedValue(makeRequest());
      const actor = makeActor(UserRole.PARENT_FINANCEUR);
      await expect(service.rejectRequest('request-uuid', actor)).rejects.toThrow(ForbiddenException);
    });

    it('throws 404 when request does not exist', async () => {
      requestRepo.findOne.mockResolvedValue(null);
      const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE);
      await expect(service.rejectRequest('nonexistent-uuid', actor)).rejects.toThrow(NotFoundException);
    });

    it('throws 409 when request is already processed', async () => {
      requestRepo.findOne.mockResolvedValue(makeRequest({ status: ParentLinkRequestStatus.APPROVED }));
      const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE);
      await expect(service.rejectRequest('request-uuid', actor)).rejects.toThrow(ConflictException);
    });

    it('does not create any finance link on rejection', async () => {
      requestRepo.findOne.mockResolvedValue(makeRequest());
      const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE);
      await service.rejectRequest('request-uuid', actor);
      expect(financeLinkRepo.save).not.toHaveBeenCalled();
    });
  });
});
