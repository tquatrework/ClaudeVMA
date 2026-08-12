import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';

import { RequestScope, TeacherRequestService } from '../../src/teacher-request/teacher-request.service';
import {
  TeacherRequest,
  RequestStatus,
  RequestType,
} from '../../src/teacher-request/entities/teacher-request.entity';
import { TeacherProposal, ProposalStatus } from '../../src/teacher-request/entities/teacher-proposal.entity';
import { Assignment, AssignmentStatus } from '../../src/teacher-request/entities/assignment.entity';
import { TerminationRequest } from '../../src/teacher-request/entities/termination-request.entity';
import { EventsService, TeacherRequestEvent } from '../../src/events/events.service';
import { ProfileServiceClient } from '../../src/teacher-request/clients/profile-service.client';
import { ManualRequestStatus } from '../../src/teacher-request/dto/update-status.dto';
import { RequestContext } from '../../src/common/request-context.decorator';
import { UserRole } from '../../src/common/user-role.enum';

const makeRepo = () => ({
  create: jest.fn((dto) => (Array.isArray(dto) ? dto.map((item) => ({ ...item })) : { ...dto })),
  save: jest.fn((entity) =>
    Promise.resolve(
      Array.isArray(entity)
        ? entity.map((item, index) => ({ id: `uuid-${index + 1}`, ...item }))
        : { id: 'uuid-1', ...entity },
    ),
  ),
  find: jest.fn(() => Promise.resolve([])),
  findOne: jest.fn(() => Promise.resolve(null)),
  remove: jest.fn(() => Promise.resolve()),
});

const makeDataSource = (repoMap: Record<string, ReturnType<typeof makeRepo>>) => ({
  transaction: jest.fn(async (callback: (manager: unknown) => Promise<unknown>) => {
    const manager = {
      getRepository: jest.fn((entity: { name: string }) => repoMap[entity.name] ?? makeRepo()),
    };
    return callback(manager);
  }),
});

const buildContext = (user: { id: string; role: string }): RequestContext => ({
  user: { ...user, loginIdentifier: `${user.id}.login` },
  correlationId: 'corr-test',
  callerAuthorization: 'Bearer jeton',
});

const studentContext = buildContext({ id: 'student-1', role: UserRole.ELEVE });
const parentContext = buildContext({ id: 'parent-1', role: UserRole.PARENT_FINANCEUR });
const rpContext = buildContext({ id: 'rp-1', role: UserRole.RESPONSABLE_PEDAGOGIQUE });
const teacherContext = buildContext({ id: 'teacher-1', role: UserRole.FORMATEUR });
const financeAdminContext = buildContext({ id: 'af-1', role: UserRole.ADMINISTRATEUR_FINANCIER });

const openRequest = (overrides: Partial<TeacherRequest> = {}): TeacherRequest =>
  ({
    id: 'request-1',
    requesterId: 'student-1',
    requesterRole: UserRole.ELEVE,
    studentId: 'student-1',
    description: 'Je voudrais un professeur de maths',
    subject: null,
    level: null,
    sector: null,
    message: null,
    status: RequestStatus.PENDING,
    type: RequestType.SPECIFIC,
    currentPpTeacherId: null,
    selectedTeacherIds: null,
    chosenTeacherId: null,
    closedAt: null,
    createdAt: new Date('2026-08-12T09:00:00.000Z'),
    updatedAt: new Date('2026-08-12T09:00:00.000Z'),
    ...overrides,
  }) as TeacherRequest;

const proposal = (overrides: Partial<TeacherProposal> = {}): TeacherProposal =>
  ({
    id: 'proposal-1',
    requestId: 'request-1',
    teacherId: 'teacher-1',
    message: 'Un eleve de terminale cherche un professeur',
    availabilityNote: null,
    compensationNote: null,
    responseDeadline: null,
    status: ProposalStatus.PENDING,
    respondedAt: null,
    createdAt: new Date('2026-08-12T10:00:00.000Z'),
    updatedAt: new Date('2026-08-12T10:00:00.000Z'),
    ...overrides,
  }) as TeacherProposal;

describe('TeacherRequestService', () => {
  let service: TeacherRequestService;
  let requestRepo: ReturnType<typeof makeRepo>;
  let proposalRepo: ReturnType<typeof makeRepo>;
  let assignmentRepo: ReturnType<typeof makeRepo>;
  let terminationRepo: ReturnType<typeof makeRepo>;
  let events: { record: jest.Mock; requestPublication: jest.Mock };
  let profileServiceClient: {
    resolveDisplayName: jest.Mock;
    getRelations: jest.Mock;
    createTeacherStudentRelation: jest.Mock;
  };

  const linkedParentRelations = {
    viewerId: 'parent-1',
    targetId: 'student-1',
    isSelf: false,
    isAdministrator: false,
    relations: [{ kind: 'finance_owner_of_student' }],
  };
  const unlinkedRelations = {
    viewerId: 'parent-1',
    targetId: 'student-9',
    isSelf: false,
    isAdministrator: false,
    relations: [],
  };
  const administratorRelations = {
    viewerId: 'rp-1',
    targetId: 'student-1',
    isSelf: false,
    isAdministrator: true,
    relations: [],
  };

  beforeEach(async () => {
    requestRepo = makeRepo();
    proposalRepo = makeRepo();
    assignmentRepo = makeRepo();
    terminationRepo = makeRepo();
    events = { record: jest.fn().mockResolvedValue(undefined), requestPublication: jest.fn() };
    profileServiceClient = {
      resolveDisplayName: jest.fn().mockResolvedValue('Alice Dupont'),
      getRelations: jest.fn().mockResolvedValue(linkedParentRelations),
      createTeacherStudentRelation: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TeacherRequestService,
        { provide: getRepositoryToken(TeacherRequest), useValue: requestRepo },
        { provide: getRepositoryToken(TeacherProposal), useValue: proposalRepo },
        { provide: getRepositoryToken(Assignment), useValue: assignmentRepo },
        { provide: getRepositoryToken(TerminationRequest), useValue: terminationRepo },
        { provide: EventsService, useValue: events },
        {
          provide: DataSource,
          useValue: makeDataSource({
            TeacherRequest: requestRepo,
            TeacherProposal: proposalRepo,
            Assignment: assignmentRepo,
            TerminationRequest: terminationRepo,
          }),
        },
        { provide: ProfileServiceClient, useValue: profileServiceClient },
      ],
    }).compile();

    service = module.get(TeacherRequestService);
  });

  // ── Etape 1 : creation ─────────────────────────────────────────────────────

  describe('createRequest', () => {
    it("l'eleve cree une demande pour lui-meme, sans fournir d'identifiant", async () => {
      const created = await service.createRequest({ description: 'Besoin en geometrie' }, studentContext);

      expect(created).toMatchObject({
        studentId: 'student-1',
        requesterId: 'student-1',
        description: 'Besoin en geometrie',
        status: RequestStatus.PENDING,
      });
      expect(profileServiceClient.getRelations).not.toHaveBeenCalled();
    });

    it('enregistre un evenement TeacherRequestCreated dans la transaction', async () => {
      await service.createRequest({ description: 'Besoin en geometrie' }, studentContext);

      expect(events.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventName: TeacherRequestEvent.REQUEST_CREATED,
          correlationId: 'corr-test',
        }),
        expect.anything(),
      );
      expect(events.requestPublication).toHaveBeenCalled();
    });

    it('le parent lie a l\'eleve peut creer la demande', async () => {
      const created = await service.createRequest(
        { description: 'Besoin en algebre', studentId: 'student-1' },
        parentContext,
      );

      expect(created).toMatchObject({ studentId: 'student-1', requesterId: 'parent-1' });
      expect(profileServiceClient.getRelations).toHaveBeenCalledWith(
        'parent-1',
        'student-1',
        UserRole.PARENT_FINANCEUR,
        expect.objectContaining({ correlationId: 'corr-test' }),
      );
    });

    it("un parent sans lien recoit 404, jamais 403 : l'existence de l'eleve n'est pas revelee", async () => {
      profileServiceClient.getRelations.mockResolvedValue(unlinkedRelations);

      await expect(
        service.createRequest({ description: 'Besoin', studentId: 'student-9' }, parentContext),
      ).rejects.toThrow(NotFoundException);
      expect(requestRepo.save).not.toHaveBeenCalled();
    });

    it("un eleve ne peut pas creer de demande pour un autre eleve", async () => {
      await expect(
        service.createRequest({ description: 'Besoin', studentId: 'student-2' }, studentContext),
      ).resolves.toMatchObject({ studentId: 'student-1' });
    });

    it('le RP, administrateur, cree une demande pour un eleve quelconque', async () => {
      profileServiceClient.getRelations.mockResolvedValue(administratorRelations);

      const created = await service.createRequest(
        { description: 'Besoin', studentId: 'student-1' },
        rpContext,
      );

      expect(created).toMatchObject({ requesterId: 'rp-1', studentId: 'student-1' });
    });

    it("un parent qui ne precise aucun eleve recoit une erreur explicite", async () => {
      await expect(service.createRequest({ description: 'Besoin' }, parentContext)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('un formateur ne peut pas creer de demande', async () => {
      await expect(
        service.createRequest({ description: 'Besoin', studentId: 'student-1' }, teacherContext),
      ).rejects.toThrow(ForbiddenException);
    });

    it("l'administrateur financier ne peut pas creer de demande", async () => {
      await expect(
        service.createRequest({ description: 'Besoin', studentId: 'student-1' }, financeAdminContext),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('createPpChangeRequest', () => {
    it('verifie le lien parent↔eleve avant de creer la demande', async () => {
      const created = await service.createPpChangeRequest(
        { studentId: 'student-1', description: 'Le courant ne passe pas' },
        parentContext,
      );

      expect(profileServiceClient.getRelations).toHaveBeenCalled();
      expect(created).toMatchObject({ type: RequestType.PP_CHANGE, studentId: 'student-1' });
    });

    it('refuse un parent delie sans reveler l\'eleve', async () => {
      profileServiceClient.getRelations.mockResolvedValue(unlinkedRelations);

      await expect(
        service.createPpChangeRequest({ studentId: 'student-9', description: 'Motif' }, parentContext),
      ).rejects.toThrow(NotFoundException);
    });

    it('refuse un eleve', async () => {
      await expect(
        service.createPpChangeRequest({ studentId: 'student-1', description: 'Motif' }, studentContext),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ── Etape 2 : lecture ──────────────────────────────────────────────────────

  describe('listRequests', () => {
    it('par defaut, les demandes traitees ne sont pas renvoyees', async () => {
      await service.listRequests(studentContext);

      expect(requestRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ studentId: 'student-1', status: expect.anything() }),
        }),
      );
    });

    it('scope=all ne filtre aucun statut', async () => {
      await service.listRequests(studentContext, RequestScope.ALL);

      expect(requestRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { studentId: 'student-1' } }),
      );
    });

    it('le parent ne voit plus les demandes des eleves dont il a ete delie', async () => {
      requestRepo.find.mockResolvedValue([
        openRequest({ id: 'request-1', studentId: 'student-1', requesterId: 'parent-1' }),
        openRequest({ id: 'request-2', studentId: 'student-9', requesterId: 'parent-1' }),
      ]);
      profileServiceClient.getRelations.mockImplementation(async (_viewerId, targetId: string) =>
        targetId === 'student-1' ? linkedParentRelations : unlinkedRelations,
      );

      const visibleRequests = await service.listRequests(parentContext);

      expect(visibleRequests.map((request) => request.id)).toEqual(['request-1']);
    });

    it('le RP recoit des noms et des compteurs de candidatures, pas des UUID nus', async () => {
      requestRepo.find.mockResolvedValue([openRequest()]);
      proposalRepo.find.mockResolvedValue([
        proposal({ id: 'proposal-1', status: ProposalStatus.ACCEPTED }),
        proposal({ id: 'proposal-2', status: ProposalStatus.PENDING }),
      ]);

      const [firstRequest] = await service.listRequests(rpContext);

      expect(firstRequest.studentName).toBe('Alice Dupont');
      expect(firstRequest.acceptedProposalCount).toBe(1);
      expect(firstRequest.pendingProposalCount).toBe(1);
    });

    it('un role sans droit de lecture est refuse', async () => {
      await expect(service.listRequests(financeAdminContext)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('listProposalsForTeacher', () => {
    it('le formateur voit la description et le nom de l\'eleve', async () => {
      proposalRepo.find.mockResolvedValue([proposal()]);
      requestRepo.find.mockResolvedValue([openRequest({ status: RequestStatus.REDIRECTED })]);

      const [inboxItem] = await service.listProposalsForTeacher(teacherContext);

      expect(inboxItem).toMatchObject({
        requestDescription: 'Je voudrais un professeur de maths',
        studentName: 'Alice Dupont',
        requestStatus: RequestStatus.REDIRECTED,
      });
    });

    it('les propositions des demandes cloturees sortent de la boite de reception', async () => {
      proposalRepo.find.mockResolvedValue([proposal({ status: ProposalStatus.NOT_SELECTED })]);
      requestRepo.find.mockResolvedValue([openRequest({ status: RequestStatus.CLOSED })]);

      await expect(service.listProposalsForTeacher(teacherContext)).resolves.toEqual([]);
      await expect(service.listProposalsForTeacher(teacherContext, RequestScope.CLOSED)).resolves.toHaveLength(1);
    });

    it('une boite vide ne declenche aucune lecture de demandes', async () => {
      proposalRepo.find.mockResolvedValue([]);

      await expect(service.listProposalsForTeacher(teacherContext)).resolves.toEqual([]);
      expect(requestRepo.find).not.toHaveBeenCalled();
    });
  });

  describe('getRequest', () => {
    it("le formateur destinataire d'une proposition lit la demande", async () => {
      requestRepo.findOne.mockResolvedValue(openRequest({ status: RequestStatus.REDIRECTED }));
      proposalRepo.findOne.mockResolvedValue(proposal());

      await expect(service.getRequest('request-1', teacherContext)).resolves.toMatchObject({
        id: 'request-1',
      });
    });

    it('un formateur non sollicite ne sait pas que la demande existe', async () => {
      requestRepo.findOne.mockResolvedValue(openRequest());
      proposalRepo.findOne.mockResolvedValue(null);

      await expect(service.getRequest('request-1', teacherContext)).rejects.toThrow(NotFoundException);
    });

    it('un parent delie perd l\'acces a la demande qu\'il avait creee', async () => {
      requestRepo.findOne.mockResolvedValue(openRequest({ requesterId: 'parent-1' }));
      profileServiceClient.getRelations.mockResolvedValue(unlinkedRelations);

      await expect(service.getRequest('request-1', parentContext)).rejects.toThrow(NotFoundException);
    });

    it('une demande inexistante renvoie 404', async () => {
      requestRepo.findOne.mockResolvedValue(null);

      await expect(service.getRequest('request-1', rpContext)).rejects.toThrow(NotFoundException);
    });
  });

  // ── Etape 3 : propositions ─────────────────────────────────────────────────

  describe('createProposals', () => {
    beforeEach(() => {
      requestRepo.findOne.mockResolvedValue(openRequest());
      proposalRepo.find.mockResolvedValue([]);
    });

    it('envoie la proposition a plusieurs formateurs en une seule fois', async () => {
      const createdProposals = await service.createProposals(
        'request-1',
        { teacherIds: ['teacher-1', 'teacher-2'], message: 'Voici le besoin' },
        rpContext,
      );

      expect(createdProposals).toHaveLength(2);
      expect(events.record).toHaveBeenCalledWith(
        expect.objectContaining({ eventName: TeacherRequestEvent.PROPOSAL_SENT }),
        expect.anything(),
      );
    });

    it('bascule la demande en « transmise »', async () => {
      await service.createProposals('request-1', { teacherIds: ['teacher-1'], message: 'Voici' }, rpContext);

      expect(requestRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: RequestStatus.REDIRECTED }),
      );
    });

    it('refuse de solliciter deux fois le meme formateur sur une demande', async () => {
      proposalRepo.find.mockResolvedValue([proposal({ status: ProposalStatus.PENDING })]);

      await expect(
        service.createProposals('request-1', { teacherIds: ['teacher-1'], message: 'Voici' }, rpContext),
      ).rejects.toThrow(BadRequestException);
    });

    it('un formateur ecarte precedemment peut etre resollicite', async () => {
      proposalRepo.find.mockResolvedValue([proposal({ status: ProposalStatus.DECLINED })]);

      await expect(
        service.createProposals('request-1', { teacherIds: ['teacher-1'], message: 'Voici' }, rpContext),
      ).resolves.toHaveLength(1);
    });

    it('refuse de transmettre une demande cloturee', async () => {
      requestRepo.findOne.mockResolvedValue(openRequest({ status: RequestStatus.CLOSED }));

      await expect(
        service.createProposals('request-1', { teacherIds: ['teacher-1'], message: 'Voici' }, rpContext),
      ).rejects.toThrow(BadRequestException);
    });

    it('refuse un role autre que RP', async () => {
      await expect(
        service.createProposals('request-1', { teacherIds: ['teacher-1'], message: 'Voici' }, teacherContext),
      ).rejects.toThrow(ForbiddenException);
    });

    it('refuse une demande inexistante', async () => {
      requestRepo.findOne.mockResolvedValue(null);

      await expect(
        service.createProposals('request-1', { teacherIds: ['teacher-1'], message: 'Voici' }, rpContext),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('listProposalsOfRequest', () => {
    it('le RP lit les reponses des formateurs, avec leurs noms', async () => {
      requestRepo.findOne.mockResolvedValue(openRequest());
      proposalRepo.find.mockResolvedValue([proposal({ status: ProposalStatus.ACCEPTED })]);

      const [firstProposal] = await service.listProposalsOfRequest('request-1', rpContext);

      expect(firstProposal).toMatchObject({ status: ProposalStatus.ACCEPTED, teacherName: 'Alice Dupont' });
    });

    it("l'eleve ne lit pas les candidatures : la decision appartient au RP", async () => {
      await expect(service.listProposalsOfRequest('request-1', studentContext)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('refuse une demande inexistante', async () => {
      requestRepo.findOne.mockResolvedValue(null);

      await expect(service.listProposalsOfRequest('request-1', rpContext)).rejects.toThrow(NotFoundException);
    });
  });

  // ── Etape 4 : reponse du formateur ─────────────────────────────────────────

  describe('acceptProposal', () => {
    beforeEach(() => {
      proposalRepo.findOne.mockResolvedValue(proposal());
      requestRepo.findOne.mockResolvedValue(openRequest({ status: RequestStatus.REDIRECTED }));
    });

    it("l'acceptation enregistre une candidature et AUCUNE affectation", async () => {
      const accepted = await service.acceptProposal('proposal-1', teacherContext);

      expect(accepted.status).toBe(ProposalStatus.ACCEPTED);
      expect(accepted.respondedAt).toBeInstanceOf(Date);
      expect(assignmentRepo.save).not.toHaveBeenCalled();
      expect(requestRepo.save).not.toHaveBeenCalled();
    });

    it('emet TeacherProposalAccepted', async () => {
      await service.acceptProposal('proposal-1', teacherContext);

      expect(events.record).toHaveBeenCalledWith(
        expect.objectContaining({ eventName: TeacherRequestEvent.PROPOSAL_ACCEPTED }),
        expect.anything(),
      );
    });

    it('une proposition adressee a un autre formateur reste invisible (404)', async () => {
      proposalRepo.findOne.mockResolvedValue(proposal({ teacherId: 'teacher-9' }));

      await expect(service.acceptProposal('proposal-1', teacherContext)).rejects.toThrow(NotFoundException);
    });

    it('on ne repond pas deux fois a la meme proposition', async () => {
      proposalRepo.findOne.mockResolvedValue(proposal({ status: ProposalStatus.ACCEPTED }));

      await expect(service.acceptProposal('proposal-1', teacherContext)).rejects.toThrow(BadRequestException);
    });

    it('on ne repond plus a une demande cloturee', async () => {
      requestRepo.findOne.mockResolvedValue(openRequest({ status: RequestStatus.CLOSED }));

      await expect(service.acceptProposal('proposal-1', teacherContext)).rejects.toThrow(BadRequestException);
    });

    it('seul un formateur repond a une proposition', async () => {
      await expect(service.acceptProposal('proposal-1', rpContext)).rejects.toThrow(ForbiddenException);
    });

    it('une proposition inexistante renvoie 404', async () => {
      proposalRepo.findOne.mockResolvedValue(null);

      await expect(service.acceptProposal('proposal-1', teacherContext)).rejects.toThrow(NotFoundException);
    });
  });

  describe('declineProposal', () => {
    it('« refusee » signifie que le formateur a refuse', async () => {
      proposalRepo.findOne.mockResolvedValue(proposal());
      requestRepo.findOne.mockResolvedValue(openRequest({ status: RequestStatus.REDIRECTED }));

      const declined = await service.declineProposal('proposal-1', teacherContext);

      expect(declined.status).toBe(ProposalStatus.DECLINED);
      expect(events.record).toHaveBeenCalledWith(
        expect.objectContaining({ eventName: TeacherRequestEvent.PROPOSAL_DECLINED }),
        expect.anything(),
      );
    });
  });

  // ── Etapes 5 et 6 : validation du RP ───────────────────────────────────────

  describe('validateCandidate', () => {
    beforeEach(() => {
      requestRepo.findOne.mockResolvedValue(openRequest({ status: RequestStatus.REDIRECTED }));
      proposalRepo.findOne.mockResolvedValue(proposal({ status: ProposalStatus.ACCEPTED }));
      proposalRepo.find.mockResolvedValue([
        proposal({ id: 'proposal-1', status: ProposalStatus.ACCEPTED, teacherId: 'teacher-1' }),
        proposal({ id: 'proposal-2', status: ProposalStatus.ACCEPTED, teacherId: 'teacher-2' }),
        proposal({ id: 'proposal-3', status: ProposalStatus.PENDING, teacherId: 'teacher-3' }),
      ]);
    });

    it('cree le lien eleve↔formateur dans profile-service', async () => {
      await service.validateCandidate('request-1', { proposalId: 'proposal-1' }, rpContext);

      expect(profileServiceClient.createTeacherStudentRelation).toHaveBeenCalledWith(
        { teacherId: 'teacher-1', studentId: 'student-1', isPrincipalTeacher: false },
        expect.objectContaining({ correlationId: 'corr-test' }),
      );
    });

    it('transmet la designation de professeur principal', async () => {
      await service.validateCandidate(
        'request-1',
        { proposalId: 'proposal-1', isPrincipalTeacher: true },
        rpContext,
      );

      expect(profileServiceClient.createTeacherStudentRelation).toHaveBeenCalledWith(
        expect.objectContaining({ isPrincipalTeacher: true }),
        expect.anything(),
      );
    });

    it('cloture la demande et retient le formateur', async () => {
      const closed = await service.validateCandidate('request-1', { proposalId: 'proposal-1' }, rpContext);

      expect(closed).toMatchObject({ status: RequestStatus.CLOSED, chosenTeacherId: 'teacher-1' });
      expect(closed.closedAt).toBeInstanceOf(Date);
    });

    it('les autres candidats deviennent « non retenus », les silencieux « caduques »', async () => {
      await service.validateCandidate('request-1', { proposalId: 'proposal-1' }, rpContext);

      expect(proposalRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'proposal-2', status: ProposalStatus.NOT_SELECTED }),
      );
      expect(proposalRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'proposal-3', status: ProposalStatus.EXPIRED }),
      );
      expect(proposalRepo.save).not.toHaveBeenCalledWith(
        expect.objectContaining({ id: 'proposal-1', status: ProposalStatus.NOT_SELECTED }),
      );
    });

    it('emet TeacherAssigned et TeacherRequestClosed', async () => {
      await service.validateCandidate('request-1', { proposalId: 'proposal-1' }, rpContext);

      const emittedEventNames = events.record.mock.calls.map(([input]) => input.eventName);
      expect(emittedEventNames).toContain(TeacherRequestEvent.TEACHER_ASSIGNED);
      expect(emittedEventNames).toContain(TeacherRequestEvent.REQUEST_CLOSED);
    });

    it('ne cloture rien si profile-service refuse de creer le lien', async () => {
      profileServiceClient.createTeacherStudentRelation.mockRejectedValue(new Error('injoignable'));

      await expect(
        service.validateCandidate('request-1', { proposalId: 'proposal-1' }, rpContext),
      ).rejects.toThrow();
      expect(requestRepo.save).not.toHaveBeenCalled();
    });

    it('remonte le conflit de lien au RP au lieu de lui afficher un succes', async () => {
      profileServiceClient.createTeacherStudentRelation.mockRejectedValue(
        new ConflictException('Un lien existe deja entre cet eleve et ce formateur, avec un statut different.'),
      );

      await expect(
        service.validateCandidate('request-1', { proposalId: 'proposal-1' }, rpContext),
      ).rejects.toThrow(ConflictException);
      expect(requestRepo.save).not.toHaveBeenCalled();
      expect(proposalRepo.save).not.toHaveBeenCalled();
    });

    it('un rejeu reussi de profile-service cloture bien la demande', async () => {
      // profile-service repond `200` sur un lien identique deja present : le
      // client resout, la validation du RP doit aller jusqu'au bout.
      profileServiceClient.createTeacherStudentRelation.mockResolvedValue(undefined);

      const closed = await service.validateCandidate('request-1', { proposalId: 'proposal-1' }, rpContext);

      expect(closed.status).toBe(RequestStatus.CLOSED);
    });

    it("refuse un formateur qui n'a pas accepte", async () => {
      proposalRepo.findOne.mockResolvedValue(proposal({ status: ProposalStatus.PENDING }));

      await expect(
        service.validateCandidate('request-1', { proposalId: 'proposal-1' }, rpContext),
      ).rejects.toThrow(BadRequestException);
      expect(profileServiceClient.createTeacherStudentRelation).not.toHaveBeenCalled();
    });

    it("refuse une proposition qui ne concerne pas cette demande", async () => {
      proposalRepo.findOne.mockResolvedValue(
        proposal({ requestId: 'request-9', status: ProposalStatus.ACCEPTED }),
      );

      await expect(
        service.validateCandidate('request-1', { proposalId: 'proposal-1' }, rpContext),
      ).rejects.toThrow(BadRequestException);
    });

    it('refuse une demande deja cloturee', async () => {
      requestRepo.findOne.mockResolvedValue(openRequest({ status: RequestStatus.CLOSED }));

      await expect(
        service.validateCandidate('request-1', { proposalId: 'proposal-1' }, rpContext),
      ).rejects.toThrow(BadRequestException);
    });

    it("l'eleve ne valide pas : la decision appartient au RP", async () => {
      await expect(
        service.validateCandidate('request-1', { proposalId: 'proposal-1' }, studentContext),
      ).rejects.toThrow(ForbiddenException);
    });

    it('refuse une proposition inexistante', async () => {
      proposalRepo.findOne.mockResolvedValue(null);

      await expect(
        service.validateCandidate('request-1', { proposalId: 'proposal-1' }, rpContext),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── Cloture manuelle ───────────────────────────────────────────────────────

  describe('updateRequestStatus', () => {
    it('le RP renonce a une demande en cours', async () => {
      requestRepo.findOne.mockResolvedValue(openRequest());
      proposalRepo.find.mockResolvedValue([]);

      const updated = await service.updateRequestStatus('request-1', ManualRequestStatus.CANCELLED, rpContext);

      expect(updated.status).toBe(RequestStatus.CANCELLED);
    });

    it('les propositions en attente deviennent caduques quand la demande se referme', async () => {
      requestRepo.findOne.mockResolvedValue(openRequest({ status: RequestStatus.REDIRECTED }));
      proposalRepo.find.mockResolvedValue([
        proposal({ id: 'proposal-1', status: ProposalStatus.PENDING }),
        proposal({ id: 'proposal-2', status: ProposalStatus.ACCEPTED }),
      ]);

      await service.updateRequestStatus('request-1', ManualRequestStatus.DECLINED, rpContext);

      expect(proposalRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'proposal-1', status: ProposalStatus.EXPIRED }),
      );
      expect(proposalRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'proposal-2', status: ProposalStatus.NOT_SELECTED }),
      );
    });

    it('« closed » a la main est refuse sur une demande en cours', async () => {
      requestRepo.findOne.mockResolvedValue(openRequest({ status: RequestStatus.REDIRECTED }));

      await expect(
        service.updateRequestStatus('request-1', ManualRequestStatus.CLOSED, rpContext),
      ).rejects.toThrow(BadRequestException);
    });

    it('« closed » debloque une demande heritee restee en « assigned »', async () => {
      requestRepo.findOne.mockResolvedValue(openRequest({ status: RequestStatus.ASSIGNED }));
      proposalRepo.find.mockResolvedValue([]);

      const updated = await service.updateRequestStatus('request-1', ManualRequestStatus.CLOSED, rpContext);

      expect(updated.status).toBe(RequestStatus.CLOSED);
    });

    it('une demande deja cloturee ne bouge plus', async () => {
      requestRepo.findOne.mockResolvedValue(openRequest({ status: RequestStatus.CANCELLED }));

      await expect(
        service.updateRequestStatus('request-1', ManualRequestStatus.DECLINED, rpContext),
      ).rejects.toThrow(BadRequestException);
    });

    it('reserve au RP', async () => {
      await expect(
        service.updateRequestStatus('request-1', ManualRequestStatus.CANCELLED, studentContext),
      ).rejects.toThrow(ForbiddenException);
    });

    it('demande inexistante', async () => {
      requestRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateRequestStatus('request-1', ManualRequestStatus.CANCELLED, rpContext),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteRequest', () => {
    it('le RP supprime une demande et l\'evenement est trace', async () => {
      requestRepo.findOne.mockResolvedValue(openRequest());

      await service.deleteRequest('request-1', rpContext);

      expect(requestRepo.remove).toHaveBeenCalled();
      expect(events.record).toHaveBeenCalledWith(
        expect.objectContaining({ eventName: TeacherRequestEvent.REQUEST_DELETED }),
      );
    });

    it('reserve au RP', async () => {
      await expect(service.deleteRequest('request-1', studentContext)).rejects.toThrow(ForbiddenException);
    });

    it('demande inexistante', async () => {
      requestRepo.findOne.mockResolvedValue(null);

      await expect(service.deleteRequest('request-1', rpContext)).rejects.toThrow(NotFoundException);
    });
  });

  // ── Heritage ───────────────────────────────────────────────────────────────

  describe('affectations heritees', () => {
    const activeAssignment = {
      id: 'assignment-1',
      studentId: 'student-1',
      teacherId: 'teacher-1',
      proposalId: 'proposal-1',
      requestId: 'request-1',
      isMainTeacher: false,
      status: AssignmentStatus.ACTIVE,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Assignment;

    it('le RP designe le professeur principal', async () => {
      assignmentRepo.findOne.mockResolvedValue(activeAssignment);

      const updated = await service.setMainTeacher('assignment-1', rpContext);

      expect(updated.isMainTeacher).toBe(true);
    });

    it('une affectation inactive refuse la designation', async () => {
      assignmentRepo.findOne.mockResolvedValue({
        ...activeAssignment,
        status: AssignmentStatus.TERMINATED,
      });

      await expect(service.setMainTeacher('assignment-1', rpContext)).rejects.toThrow(BadRequestException);
    });

    it("un eleve ne designe pas le professeur principal d'un autre", async () => {
      assignmentRepo.findOne.mockResolvedValue({ ...activeAssignment, studentId: 'student-9' });

      await expect(service.setMainTeacher('assignment-1', studentContext)).rejects.toThrow(NotFoundException);
    });

    it("le formateur demande l'arret avec preavis", async () => {
      assignmentRepo.findOne.mockResolvedValue(activeAssignment);

      const termination = await service.createTermination(
        'assignment-1',
        { noticeDate: '2026-09-01' },
        teacherContext,
      );

      expect(termination).toMatchObject({ assignmentId: 'assignment-1', teacherId: 'teacher-1' });
      expect(events.record).toHaveBeenCalledWith(
        expect.objectContaining({ eventName: TeacherRequestEvent.STOP_REQUESTED }),
        expect.anything(),
      );
    });

    it("un formateur etranger a l'affectation ne sait pas qu'elle existe", async () => {
      assignmentRepo.findOne.mockResolvedValue({ ...activeAssignment, teacherId: 'teacher-9' });

      await expect(
        service.createTermination('assignment-1', { noticeDate: '2026-09-01' }, teacherContext),
      ).rejects.toThrow(NotFoundException);
    });

    it("l'alias /collaborations applique exactement les memes regles", async () => {
      assignmentRepo.findOne.mockResolvedValue(activeAssignment);

      await expect(
        service.createCollaborationStopRequest('assignment-1', { noticeDate: '2026-09-01' }, teacherContext),
      ).resolves.toMatchObject({ assignmentId: 'assignment-1' });
    });
  });
});
