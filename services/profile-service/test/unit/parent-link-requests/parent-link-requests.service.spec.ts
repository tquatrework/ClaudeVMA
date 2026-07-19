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
  ParentLinkRequestDirection,
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
  direction: ParentLinkRequestDirection.PARENT_INITIATED,
  requestedAt: new Date(),
  processedAt: null,
  processedBy: null,
  ...overrides,
});

const makeIdentityResponse = (overrides: Partial<{ userId: string; role: string }> = {}) => ({
  userId: 'student-uuid',
  role: 'eleve',
  ...overrides,
});


describe('ParentLinkRequestsService', () => {
  let service: ParentLinkRequestsService;
  let requestRepo: any;
  let studentPedaRepo: any;
  let financeLinkRepo: any;
  let configService: any;

  const mockFetchSuccess = (responseData: object, status = 200) => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: jest.fn().mockResolvedValue(responseData),
    } as unknown as Response);
  };

  const mockFetchNotFound = () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: jest.fn().mockResolvedValue({ message: 'Identifiant élève introuvable' }),
    } as unknown as Response);
  };

  const mockFetchNetworkError = () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));
  };


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

    // Réinitialiser fetch par défaut : retourne un compte élève valide
    mockFetchSuccess(makeIdentityResponse());
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // createRequest
  // ---------------------------------------------------------------------------
  describe('createRequest', () => {
    const dto = { studentLoginIdentifier: 'eleve.dupont.2024' };

    it('parent_financeur peut soumettre une demande pour un élève existant', async () => {
      const actor = makeActor(UserRole.PARENT_FINANCEUR, 'parent-uuid');
      const result = await service.createRequest(dto, actor);
      expect(result).toHaveProperty('parentId', 'parent-uuid');
      expect(result).toHaveProperty('studentId', 'student-uuid');
      expect(result).toHaveProperty('status', ParentLinkRequestStatus.PENDING);
    });

    it('lève 403 pour un rôle non parent_financeur (eleve)', async () => {
      const actor = makeActor(UserRole.ELEVE);
      await expect(service.createRequest(dto, actor)).rejects.toThrow(ForbiddenException);
    });

    it('lève 403 pour un responsable_pedagogique', async () => {
      const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE);
      await expect(service.createRequest(dto, actor)).rejects.toThrow(ForbiddenException);
    });

    it('lève 404 quand identity-access-service retourne 404 pour le loginIdentifier', async () => {
      mockFetchNotFound();
      const actor = makeActor(UserRole.PARENT_FINANCEUR);
      await expect(service.createRequest(dto, actor)).rejects.toThrow(NotFoundException);
    });

    it('lève 400 quand le compte trouvé n\'est pas de rôle eleve', async () => {
      mockFetchSuccess(makeIdentityResponse({ role: 'formateur' }));
      const actor = makeActor(UserRole.PARENT_FINANCEUR);
      await expect(service.createRequest(dto, actor)).rejects.toThrow(BadRequestException);
    });

    it('lève 400 quand le profil pédagogique élève est absent en base', async () => {
      studentPedaRepo.findOne.mockResolvedValue(null);
      const actor = makeActor(UserRole.PARENT_FINANCEUR);
      await expect(service.createRequest(dto, actor)).rejects.toThrow(BadRequestException);
    });

    it('lève 409 quand une demande en attente existe déjà pour cette paire', async () => {
      requestRepo.findOne.mockResolvedValue(makeRequest());
      const actor = makeActor(UserRole.PARENT_FINANCEUR, 'parent-uuid');
      await expect(service.createRequest(dto, actor)).rejects.toThrow(ConflictException);
    });

    it('crée une nouvelle demande quand aucune demande en attente n\'existe', async () => {
      requestRepo.findOne.mockResolvedValue(null);
      const actor = makeActor(UserRole.PARENT_FINANCEUR, 'parent-uuid');
      await service.createRequest(dto, actor);
      expect(requestRepo.save).toHaveBeenCalled();
    });

    it('lève 400 en cas d\'erreur réseau vers identity-access-service', async () => {
      mockFetchNetworkError();
      const actor = makeActor(UserRole.PARENT_FINANCEUR);
      await expect(service.createRequest(dto, actor)).rejects.toThrow(BadRequestException);
    });

    it('appelle identity-access-service avec le bon loginIdentifier encodé', async () => {
      const actor = makeActor(UserRole.PARENT_FINANCEUR, 'parent-uuid');
      await service.createRequest(dto, actor);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('eleve.dupont.2024'),
        expect.objectContaining({ method: 'GET' }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // listRequests
  // ---------------------------------------------------------------------------
  describe('listRequests', () => {
    it('parent_financeur ne voit que ses propres demandes', async () => {
      requestRepo.find.mockResolvedValue([makeRequest({ parentId: 'parent-uuid' })]);
      const actor = makeActor(UserRole.PARENT_FINANCEUR, 'parent-uuid');
      const result = await service.listRequests(actor);
      expect(requestRepo.find).toHaveBeenCalledWith({
        where: { parentId: 'parent-uuid' },
        order: { requestedAt: 'DESC' },
      });
      expect(result).toHaveLength(1);
    });

    it('eleve ne voit que les demandes qui le ciblent', async () => {
      requestRepo.find.mockResolvedValue([makeRequest({ studentId: 'student-uuid' })]);
      const actor = makeActor(UserRole.ELEVE, 'student-uuid');
      const result = await service.listRequests(actor);
      expect(requestRepo.find).toHaveBeenCalledWith({
        where: { studentId: 'student-uuid' },
        order: { requestedAt: 'DESC' },
      });
      expect(result).toHaveLength(1);
    });

    it('responsable_pedagogique voit toutes les demandes', async () => {
      requestRepo.find.mockResolvedValue([makeRequest(), makeRequest({ id: 'other-uuid' })]);
      const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE);
      const result = await service.listRequests(actor);
      expect(requestRepo.find).toHaveBeenCalledWith({ order: { requestedAt: 'DESC' } });
      expect(result).toHaveLength(2);
    });

    it('technicien_informatique voit toutes les demandes', async () => {
      requestRepo.find.mockResolvedValue([makeRequest()]);
      const actor = makeActor(UserRole.TECHNICIEN_INFORMATIQUE);
      await service.listRequests(actor);
      expect(requestRepo.find).toHaveBeenCalledWith({ order: { requestedAt: 'DESC' } });
    });

    it('lève 403 pour le rôle formateur', async () => {
      const actor = makeActor(UserRole.FORMATEUR);
      await expect(service.listRequests(actor)).rejects.toThrow(ForbiddenException);
    });

    it('lève 403 pour le rôle administrateur_financier', async () => {
      const actor = makeActor(UserRole.ADMINISTRATEUR_FINANCIER);
      await expect(service.listRequests(actor)).rejects.toThrow(ForbiddenException);
    });
  });

  // ---------------------------------------------------------------------------
  // approveRequest
  // ---------------------------------------------------------------------------
  describe('approveRequest', () => {
    it("l'élève ciblé peut approuver une demande qui le cible", async () => {
      const pendingRequest = makeRequest({ studentId: 'student-uuid' });
      requestRepo.findOne.mockResolvedValue(pendingRequest);

      const actor = makeActor(UserRole.ELEVE, 'student-uuid');
      const result = await service.approveRequest('request-uuid', actor);

      expect(result).toHaveProperty('status', ParentLinkRequestStatus.APPROVED);
      expect(result).toHaveProperty('processedBy', 'student-uuid');
      expect(financeLinkRepo.save).toHaveBeenCalled();
    });

    it('le RP peut approuver n\'importe quelle demande', async () => {
      const pendingRequest = makeRequest();
      requestRepo.findOne.mockResolvedValue(pendingRequest);

      const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE);
      const result = await service.approveRequest('request-uuid', actor);

      expect(result).toHaveProperty('status', ParentLinkRequestStatus.APPROVED);
    });

    it('le TI peut approuver n\'importe quelle demande', async () => {
      const pendingRequest = makeRequest();
      requestRepo.findOne.mockResolvedValue(pendingRequest);

      const actor = makeActor(UserRole.TECHNICIEN_INFORMATIQUE);
      const result = await service.approveRequest('request-uuid', actor);

      expect(result).toHaveProperty('status', ParentLinkRequestStatus.APPROVED);
    });

    it("lève 403 quand l'élève n'est pas l'élève ciblé", async () => {
      const pendingRequest = makeRequest({ studentId: 'other-student-uuid' });
      requestRepo.findOne.mockResolvedValue(pendingRequest);

      const actor = makeActor(UserRole.ELEVE, 'student-uuid');
      await expect(service.approveRequest('request-uuid', actor)).rejects.toThrow(ForbiddenException);
    });

    it('lève 403 pour le rôle parent_financeur sur une demande parent_initiated', async () => {
      requestRepo.findOne.mockResolvedValue(makeRequest({ direction: ParentLinkRequestDirection.PARENT_INITIATED }));
      const actor = makeActor(UserRole.PARENT_FINANCEUR);
      await expect(service.approveRequest('request-uuid', actor)).rejects.toThrow(ForbiddenException);
    });

    it('lève 404 quand la demande est introuvable', async () => {
      requestRepo.findOne.mockResolvedValue(null);
      const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE);
      await expect(service.approveRequest('nonexistent-uuid', actor)).rejects.toThrow(NotFoundException);
    });

    it('lève 409 quand la demande est déjà approuvée', async () => {
      requestRepo.findOne.mockResolvedValue(makeRequest({ status: ParentLinkRequestStatus.APPROVED }));
      const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE);
      await expect(service.approveRequest('request-uuid', actor)).rejects.toThrow(ConflictException);
    });

    it('lève 409 quand la demande est déjà rejetée', async () => {
      requestRepo.findOne.mockResolvedValue(makeRequest({ status: ParentLinkRequestStatus.REJECTED }));
      const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE);
      await expect(service.approveRequest('request-uuid', actor)).rejects.toThrow(ConflictException);
    });

    it('ne crée pas de doublon de lien financier si un lien existe déjà', async () => {
      requestRepo.findOne.mockResolvedValue(makeRequest());
      financeLinkRepo.findOne.mockResolvedValue({ id: 'existing-link' });

      const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE);
      await service.approveRequest('request-uuid', actor);

      expect(financeLinkRepo.save).not.toHaveBeenCalled();
    });

    it('le parent ciblé peut approuver une demande student_initiated', async () => {
      const studentInitiatedRequest = makeRequest({
        direction: ParentLinkRequestDirection.STUDENT_INITIATED,
        parentId: 'parent-uuid',
      });
      requestRepo.findOne.mockResolvedValue(studentInitiatedRequest);

      const actor = makeActor(UserRole.PARENT_FINANCEUR, 'parent-uuid');
      const result = await service.approveRequest('request-uuid', actor);

      expect(result).toHaveProperty('status', ParentLinkRequestStatus.APPROVED);
      expect(result).toHaveProperty('processedBy', 'parent-uuid');
      expect(financeLinkRepo.save).toHaveBeenCalled();
    });

    it('lève 403 quand le parent n\'est pas le parent ciblé (student_initiated)', async () => {
      const studentInitiatedRequest = makeRequest({
        direction: ParentLinkRequestDirection.STUDENT_INITIATED,
        parentId: 'other-parent-uuid',
      });
      requestRepo.findOne.mockResolvedValue(studentInitiatedRequest);

      const actor = makeActor(UserRole.PARENT_FINANCEUR, 'parent-uuid');
      await expect(service.approveRequest('request-uuid', actor)).rejects.toThrow(ForbiddenException);
    });

    it('lève 403 quand l\'élève tente d\'approuver une demande student_initiated', async () => {
      const studentInitiatedRequest = makeRequest({
        direction: ParentLinkRequestDirection.STUDENT_INITIATED,
        studentId: 'student-uuid',
      });
      requestRepo.findOne.mockResolvedValue(studentInitiatedRequest);

      const actor = makeActor(UserRole.ELEVE, 'student-uuid');
      await expect(service.approveRequest('request-uuid', actor)).rejects.toThrow(ForbiddenException);
    });
  });

  // ---------------------------------------------------------------------------
  // rejectRequest
  // ---------------------------------------------------------------------------
  describe('rejectRequest', () => {
    it("l'élève ciblé peut rejeter une demande qui le cible", async () => {
      const pendingRequest = makeRequest({ studentId: 'student-uuid' });
      requestRepo.findOne.mockResolvedValue(pendingRequest);

      const actor = makeActor(UserRole.ELEVE, 'student-uuid');
      const result = await service.rejectRequest('request-uuid', actor);

      expect(result).toHaveProperty('status', ParentLinkRequestStatus.REJECTED);
      expect(result).toHaveProperty('processedBy', 'student-uuid');
      expect(financeLinkRepo.save).not.toHaveBeenCalled();
    });

    it('le RP peut rejeter n\'importe quelle demande', async () => {
      requestRepo.findOne.mockResolvedValue(makeRequest());
      const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE);
      const result = await service.rejectRequest('request-uuid', actor);
      expect(result).toHaveProperty('status', ParentLinkRequestStatus.REJECTED);
    });

    it('le TI peut rejeter n\'importe quelle demande', async () => {
      requestRepo.findOne.mockResolvedValue(makeRequest());
      const actor = makeActor(UserRole.TECHNICIEN_INFORMATIQUE);
      const result = await service.rejectRequest('request-uuid', actor);
      expect(result).toHaveProperty('status', ParentLinkRequestStatus.REJECTED);
    });

    it("lève 403 quand l'élève n'est pas l'élève ciblé", async () => {
      requestRepo.findOne.mockResolvedValue(makeRequest({ studentId: 'other-student-uuid' }));
      const actor = makeActor(UserRole.ELEVE, 'student-uuid');
      await expect(service.rejectRequest('request-uuid', actor)).rejects.toThrow(ForbiddenException);
    });

    it('lève 403 pour le rôle parent_financeur sur une demande parent_initiated', async () => {
      requestRepo.findOne.mockResolvedValue(makeRequest({ direction: ParentLinkRequestDirection.PARENT_INITIATED }));
      const actor = makeActor(UserRole.PARENT_FINANCEUR);
      await expect(service.rejectRequest('request-uuid', actor)).rejects.toThrow(ForbiddenException);
    });

    it('lève 404 quand la demande est introuvable', async () => {
      requestRepo.findOne.mockResolvedValue(null);
      const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE);
      await expect(service.rejectRequest('nonexistent-uuid', actor)).rejects.toThrow(NotFoundException);
    });

    it('lève 409 quand la demande est déjà traitée', async () => {
      requestRepo.findOne.mockResolvedValue(makeRequest({ status: ParentLinkRequestStatus.APPROVED }));
      const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE);
      await expect(service.rejectRequest('request-uuid', actor)).rejects.toThrow(ConflictException);
    });

    it('ne crée aucun lien financier lors d\'un rejet', async () => {
      requestRepo.findOne.mockResolvedValue(makeRequest());
      const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE);
      await service.rejectRequest('request-uuid', actor);
      expect(financeLinkRepo.save).not.toHaveBeenCalled();
    });

    it('le parent ciblé peut rejeter une demande student_initiated', async () => {
      const studentInitiatedRequest = makeRequest({
        direction: ParentLinkRequestDirection.STUDENT_INITIATED,
        parentId: 'parent-uuid',
      });
      requestRepo.findOne.mockResolvedValue(studentInitiatedRequest);

      const actor = makeActor(UserRole.PARENT_FINANCEUR, 'parent-uuid');
      const result = await service.rejectRequest('request-uuid', actor);

      expect(result).toHaveProperty('status', ParentLinkRequestStatus.REJECTED);
      expect(financeLinkRepo.save).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // createStudentInitiatedRequest
  // ---------------------------------------------------------------------------
  describe('createStudentInitiatedRequest', () => {
    const studentInitiatedDto = { parentLoginIdentifier: 'parent.dupont.2024' };
    const parentIdentityResponse = { userId: 'parent-uuid', role: 'parent_financeur' };

    beforeEach(() => {
      mockFetchSuccess(parentIdentityResponse);
    });

    it('un élève peut initier une demande de rattachement vers un parent', async () => {
      const actor = makeActor(UserRole.ELEVE, 'student-uuid');
      const result = await service.createStudentInitiatedRequest(studentInitiatedDto, actor);

      expect(result).toHaveProperty('studentId', 'student-uuid');
      expect(result).toHaveProperty('parentId', 'parent-uuid');
      expect(result).toHaveProperty('status', ParentLinkRequestStatus.PENDING);
      expect(result).toHaveProperty('direction', ParentLinkRequestDirection.STUDENT_INITIATED);
    });

    it('lève 403 pour un rôle non élève (parent_financeur)', async () => {
      const actor = makeActor(UserRole.PARENT_FINANCEUR);
      await expect(service.createStudentInitiatedRequest(studentInitiatedDto, actor)).rejects.toThrow(ForbiddenException);
    });

    it('lève 403 pour un rôle non élève (responsable_pedagogique)', async () => {
      const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE);
      await expect(service.createStudentInitiatedRequest(studentInitiatedDto, actor)).rejects.toThrow(ForbiddenException);
    });

    it('lève 404 quand identity-access-service retourne 404 pour le loginIdentifier parent', async () => {
      mockFetchNotFound();
      const actor = makeActor(UserRole.ELEVE, 'student-uuid');
      await expect(service.createStudentInitiatedRequest(studentInitiatedDto, actor)).rejects.toThrow(NotFoundException);
    });

    it('lève 400 quand le compte trouvé n\'est pas de rôle parent_financeur', async () => {
      mockFetchSuccess({ userId: 'other-uuid', role: 'formateur' });
      const actor = makeActor(UserRole.ELEVE, 'student-uuid');
      await expect(service.createStudentInitiatedRequest(studentInitiatedDto, actor)).rejects.toThrow(BadRequestException);
    });

    it('lève 409 quand une demande en attente existe déjà pour cette paire', async () => {
      requestRepo.findOne.mockResolvedValue(makeRequest({
        direction: ParentLinkRequestDirection.STUDENT_INITIATED,
      }));
      const actor = makeActor(UserRole.ELEVE, 'student-uuid');
      await expect(service.createStudentInitiatedRequest(studentInitiatedDto, actor)).rejects.toThrow(ConflictException);
    });

    it('lève 400 en cas d\'erreur réseau vers identity-access-service', async () => {
      mockFetchNetworkError();
      const actor = makeActor(UserRole.ELEVE, 'student-uuid');
      await expect(service.createStudentInitiatedRequest(studentInitiatedDto, actor)).rejects.toThrow(BadRequestException);
    });

    it('appelle identity-access-service avec le bon loginIdentifier parent encodé', async () => {
      const actor = makeActor(UserRole.ELEVE, 'student-uuid');
      await service.createStudentInitiatedRequest(studentInitiatedDto, actor);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('parent.dupont.2024'),
        expect.objectContaining({ method: 'GET' }),
      );
    });
  });
});
