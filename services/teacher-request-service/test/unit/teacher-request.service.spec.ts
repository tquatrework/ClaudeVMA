import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { TeacherRequestService } from '../../src/teacher-request/teacher-request.service';
import { TeacherRequest, RequestStatus, RequestType } from '../../src/teacher-request/entities/teacher-request.entity';
import { TeacherProposal, ProposalStatus } from '../../src/teacher-request/entities/teacher-proposal.entity';
import { Assignment, AssignmentStatus } from '../../src/teacher-request/entities/assignment.entity';
import { TerminationRequest } from '../../src/teacher-request/entities/termination-request.entity';
import { EventsService } from '../../src/teacher-request/events.service';
import { UserRole } from '../../src/common/user-role.enum';

const makeRepo = () => ({
  create: jest.fn((dto) => ({ ...dto })),
  save: jest.fn((entity) => Promise.resolve({ id: 'uuid-1', ...entity })),
  find: jest.fn(() => Promise.resolve([])),
  findOne: jest.fn(),
  remove: jest.fn(() => Promise.resolve()),
});

/** Build a DataSource mock whose transaction() executes the callback with a manager
 *  that delegates getRepository() calls to the provided repo map. */
const makeDataSource = (repoMap: Record<string, ReturnType<typeof makeRepo>>) => ({
  transaction: jest.fn(async (callback: (manager: unknown) => Promise<unknown>) => {
    const manager = {
      getRepository: jest.fn((entity: { name: string }) => repoMap[entity.name] ?? makeRepo()),
    };
    return callback(manager);
  }),
});

const studentUser = { id: 'student-1', role: UserRole.ELEVE, loginIdentifier: 'student.one' };
const parentUser = { id: 'parent-1', role: UserRole.PARENT_FINANCEUR, loginIdentifier: 'parent.one' };
const rpUser = { id: 'rp-1', role: UserRole.RESPONSABLE_PEDAGOGIQUE, loginIdentifier: 'rp.one' };
const teacherUser = { id: 'teacher-1', role: UserRole.FORMATEUR, loginIdentifier: 'teacher.one' };
const adminFinUser = { id: 'admin-fin-1', role: UserRole.ADMINISTRATEUR_FINANCIER, loginIdentifier: 'admin.fin.one' };

describe('TeacherRequestService', () => {
  let service: TeacherRequestService;
  let requestRepo: ReturnType<typeof makeRepo>;
  let proposalRepo: ReturnType<typeof makeRepo>;
  let assignmentRepo: ReturnType<typeof makeRepo>;
  let terminationRepo: ReturnType<typeof makeRepo>;
  let dataSource: ReturnType<typeof makeDataSource>;
  let eventsService: { emit: jest.Mock };

  beforeEach(async () => {
    requestRepo = makeRepo();
    proposalRepo = makeRepo();
    assignmentRepo = makeRepo();
    terminationRepo = makeRepo();
    dataSource = makeDataSource({
      TeacherRequest: requestRepo,
      TeacherProposal: proposalRepo,
      Assignment: assignmentRepo,
      TerminationRequest: terminationRepo,
    });
    eventsService = { emit: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TeacherRequestService,
        { provide: getRepositoryToken(TeacherRequest), useValue: requestRepo },
        { provide: getRepositoryToken(TeacherProposal), useValue: proposalRepo },
        { provide: getRepositoryToken(Assignment), useValue: assignmentRepo },
        { provide: getRepositoryToken(TerminationRequest), useValue: terminationRepo },
        { provide: EventsService, useValue: eventsService },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get(TeacherRequestService);
  });

  // ── createRequest ──────────────────────────────────────────────────────────

  describe('createRequest', () => {
    it('eleve creates request — studentId defaults to their own id', async () => {
      const dto = { subject: 'Algèbre', level: 'Terminale' };
      const result = await service.createRequest(dto, studentUser);
      expect(requestRepo.save).toHaveBeenCalled();
      expect(result).toMatchObject({ studentId: 'student-1', requesterId: 'student-1', subject: 'Algèbre' });
    });

    it('parent_financeur creates request with explicit studentId', async () => {
      const dto = { subject: 'Géométrie', studentId: 'student-2' };
      const result = await service.createRequest(dto, parentUser);
      expect(result).toMatchObject({ studentId: 'student-2', requesterId: 'parent-1' });
    });

    it('parent_financeur without studentId throws BadRequestException', async () => {
      await expect(service.createRequest({ subject: 'Calcul' }, parentUser))
        .rejects.toThrow(BadRequestException);
    });

    it('responsable_pedagogique can create a teacher request on behalf of a student', async () => {
      const dto = { subject: 'Algèbre', studentId: 'student-1' };
      const result = await service.createRequest(dto, rpUser);
      expect(requestRepo.save).toHaveBeenCalled();
      expect(result).toMatchObject({ studentId: 'student-1', requesterId: 'rp-1' });
    });

    it('responsable_pedagogique without studentId throws BadRequestException', async () => {
      await expect(service.createRequest({ subject: 'Test' }, rpUser))
        .rejects.toThrow(BadRequestException);
    });

    it('formateur cannot create a teacher request', async () => {
      await expect(service.createRequest({ subject: 'Test' }, teacherUser))
        .rejects.toThrow(ForbiddenException);
    });

    it('administrateur_financier cannot create a teacher request', async () => {
      await expect(service.createRequest({ subject: 'Test' }, adminFinUser))
        .rejects.toThrow(ForbiddenException);
    });
  });

  // ── listRequests ───────────────────────────────────────────────────────────

  describe('listRequests', () => {
    it('eleve queries by studentId', async () => {
      await service.listRequests(studentUser);
      expect(requestRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { studentId: 'student-1' } }),
      );
    });

    it('parent_financeur queries by requesterId', async () => {
      await service.listRequests(parentUser);
      expect(requestRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { requesterId: 'parent-1' } }),
      );
    });

    it('responsable_pedagogique sees all requests', async () => {
      await service.listRequests(rpUser);
      expect(requestRepo.find).toHaveBeenCalledWith(expect.objectContaining({ order: { createdAt: 'DESC' } }));
    });

    it('formateur sees only their own proposals (TRQ-FB-001)', async () => {
      await service.listRequests(teacherUser);
      expect(proposalRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { teacherId: 'teacher-1' } }),
      );
      expect(requestRepo.find).not.toHaveBeenCalled();
    });

    it('administrateur_financier throws ForbiddenException', async () => {
      await expect(service.listRequests(adminFinUser))
        .rejects.toThrow(ForbiddenException);
    });
  });

  // ── getRequest ─────────────────────────────────────────────────────────────

  describe('getRequest', () => {
    it('responsable_pedagogique can access any request', async () => {
      requestRepo.findOne.mockResolvedValue({ id: 'req-1', studentId: 'student-99', requesterId: 'other-user' });
      const result = await service.getRequest('req-1', rpUser);
      expect(result).toMatchObject({ id: 'req-1' });
    });

    it('eleve can access their own request', async () => {
      requestRepo.findOne.mockResolvedValue({ id: 'req-1', studentId: 'student-1', requesterId: 'student-1' });
      const result = await service.getRequest('req-1', studentUser);
      expect(result).toMatchObject({ id: 'req-1' });
    });

    it("eleve cannot access another student's request", async () => {
      requestRepo.findOne.mockResolvedValue({ id: 'req-1', studentId: 'student-99', requesterId: 'other-user' });
      await expect(service.getRequest('req-1', studentUser)).rejects.toThrow(ForbiddenException);
    });

    it('unknown requestId throws NotFoundException', async () => {
      requestRepo.findOne.mockResolvedValue(null);
      await expect(service.getRequest('bad-id', rpUser)).rejects.toThrow(NotFoundException);
    });
  });

  // ── updateRequestStatus ────────────────────────────────────────────────────

  describe('updateRequestStatus', () => {
    beforeEach(() => {
      requestRepo.findOne.mockResolvedValue({ id: 'req-1', status: RequestStatus.PENDING });
    });

    it('responsable_pedagogique can transition pending → accepted', async () => {
      const result = await service.updateRequestStatus('req-1', RequestStatus.ACCEPTED, rpUser);
      expect(result).toMatchObject({ status: RequestStatus.ACCEPTED });
    });

    it('responsable_pedagogique can transition pending → declined', async () => {
      const result = await service.updateRequestStatus('req-1', RequestStatus.DECLINED, rpUser);
      expect(result).toMatchObject({ status: RequestStatus.DECLINED });
    });

    it('responsable_pedagogique can transition pending → cancelled', async () => {
      const result = await service.updateRequestStatus('req-1', RequestStatus.CANCELLED, rpUser);
      expect(result).toMatchObject({ status: RequestStatus.CANCELLED });
    });

    it('formateur cannot update request status', async () => {
      await expect(service.updateRequestStatus('req-1', RequestStatus.ACCEPTED, teacherUser))
        .rejects.toThrow(ForbiddenException);
    });

    it('parent cannot update request status', async () => {
      await expect(service.updateRequestStatus('req-1', RequestStatus.ACCEPTED, parentUser))
        .rejects.toThrow(ForbiddenException);
    });

    it('already-accepted request cannot be re-accepted (invalid transition)', async () => {
      requestRepo.findOne.mockResolvedValue({ id: 'req-1', status: RequestStatus.ACCEPTED });
      await expect(service.updateRequestStatus('req-1', RequestStatus.ACCEPTED, rpUser))
        .rejects.toThrow(BadRequestException);
    });

    it('unknown requestId throws NotFoundException', async () => {
      requestRepo.findOne.mockResolvedValue(null);
      await expect(service.updateRequestStatus('bad-id', RequestStatus.ACCEPTED, rpUser))
        .rejects.toThrow(NotFoundException);
    });
  });

  // ── deleteRequest ──────────────────────────────────────────────────────────

  describe('deleteRequest', () => {
    beforeEach(() => {
      requestRepo.findOne.mockResolvedValue({ id: 'req-1', status: RequestStatus.PENDING });
    });

    it('responsable_pedagogique can delete any request', async () => {
      await service.deleteRequest('req-1', rpUser);
      expect(requestRepo.remove).toHaveBeenCalled();
    });

    it('formateur cannot delete a request', async () => {
      await expect(service.deleteRequest('req-1', teacherUser)).rejects.toThrow(ForbiddenException);
    });

    it('parent cannot delete a request', async () => {
      await expect(service.deleteRequest('req-1', parentUser)).rejects.toThrow(ForbiddenException);
    });

    it('unknown requestId throws NotFoundException', async () => {
      requestRepo.findOne.mockResolvedValue(null);
      await expect(service.deleteRequest('bad-id', rpUser)).rejects.toThrow(NotFoundException);
    });
  });

  // ── createProposal ─────────────────────────────────────────────────────────

  describe('createProposal', () => {
    beforeEach(() => {
      requestRepo.findOne.mockResolvedValue({ id: 'req-1', status: RequestStatus.PENDING });
    });

    it('responsable_pedagogique redirects a pending request to a teacher', async () => {
      const result = await service.createProposal('req-1', { teacherId: 'teacher-1' }, rpUser);
      expect(result).toMatchObject({ requestId: 'req-1', teacherId: 'teacher-1' });
      expect(requestRepo.save).toHaveBeenCalledWith(expect.objectContaining({ status: RequestStatus.REDIRECTED }));
    });

    it('formateur cannot create proposals', async () => {
      await expect(service.createProposal('req-1', { teacherId: 'teacher-1' }, teacherUser))
        .rejects.toThrow(ForbiddenException);
    });

    it('unknown requestId throws NotFoundException', async () => {
      requestRepo.findOne.mockResolvedValue(null);
      await expect(service.createProposal('bad-id', { teacherId: 'teacher-1' }, rpUser))
        .rejects.toThrow(NotFoundException);
    });

    it('already-assigned request cannot be redirected', async () => {
      requestRepo.findOne.mockResolvedValue({ id: 'req-1', status: RequestStatus.ASSIGNED });
      await expect(service.createProposal('req-1', { teacherId: 'teacher-1' }, rpUser))
        .rejects.toThrow(BadRequestException);
    });
  });

  // ── acceptProposal ─────────────────────────────────────────────────────────

  describe('acceptProposal', () => {
    beforeEach(() => {
      proposalRepo.findOne.mockResolvedValue({
        id: 'prop-1',
        teacherId: 'teacher-1',
        requestId: 'req-1',
        status: ProposalStatus.PENDING,
      });
      requestRepo.findOne.mockResolvedValue({ id: 'req-1', studentId: 'student-1', status: RequestStatus.REDIRECTED });
    });

    it('formateur accepts their own proposal — creates assignment', async () => {
      const result = await service.acceptProposal('prop-1', teacherUser);
      expect(result).toMatchObject({ studentId: 'student-1', teacherId: 'teacher-1' });
      expect(assignmentRepo.save).toHaveBeenCalled();
    });

    it("formateur cannot accept another teacher's proposal (TRQ-FB-001)", async () => {
      const otherTeacher = { id: 'teacher-2', role: UserRole.FORMATEUR, loginIdentifier: 'teacher.two' };
      await expect(service.acceptProposal('prop-1', otherTeacher))
        .rejects.toThrow(ForbiddenException);
    });

    it('eleve cannot accept a proposal', async () => {
      await expect(service.acceptProposal('prop-1', studentUser))
        .rejects.toThrow(ForbiddenException);
    });

    it('already-accepted proposal throws BadRequestException', async () => {
      proposalRepo.findOne.mockResolvedValue({
        id: 'prop-1', teacherId: 'teacher-1', requestId: 'req-1', status: ProposalStatus.ACCEPTED,
      });
      await expect(service.acceptProposal('prop-1', teacherUser))
        .rejects.toThrow(BadRequestException);
    });
  });

  // ── setMainTeacher ─────────────────────────────────────────────────────────

  describe('setMainTeacher', () => {
    beforeEach(() => {
      assignmentRepo.findOne.mockResolvedValue({
        id: 'asgn-1',
        studentId: 'student-1',
        teacherId: 'teacher-1',
        status: AssignmentStatus.ACTIVE,
        isMainTeacher: false,
      });
    });

    it('responsable_pedagogique can set main teacher on any active assignment', async () => {
      const result = await service.setMainTeacher('asgn-1', rpUser);
      expect(result).toMatchObject({ isMainTeacher: true });
    });

    it('eleve can set main teacher for their own assignment', async () => {
      const result = await service.setMainTeacher('asgn-1', studentUser);
      expect(result).toMatchObject({ isMainTeacher: true });
    });

    it("eleve cannot set main teacher on another student's assignment (TRQ-FB-003)", async () => {
      assignmentRepo.findOne.mockResolvedValue({
        id: 'asgn-1', studentId: 'student-99', teacherId: 'teacher-1', status: AssignmentStatus.ACTIVE,
      });
      await expect(service.setMainTeacher('asgn-1', studentUser))
        .rejects.toThrow(ForbiddenException);
    });

    it('formateur cannot set main teacher', async () => {
      await expect(service.setMainTeacher('asgn-1', teacherUser))
        .rejects.toThrow(ForbiddenException);
    });

    it('inactive assignment throws BadRequestException (TRQ-FB-003)', async () => {
      assignmentRepo.findOne.mockResolvedValue({
        id: 'asgn-1', studentId: 'student-1', teacherId: 'teacher-1', status: AssignmentStatus.TERMINATED,
      });
      await expect(service.setMainTeacher('asgn-1', rpUser))
        .rejects.toThrow(BadRequestException);
    });
  });

  // ── createTermination ──────────────────────────────────────────────────────

  describe('createTermination', () => {
    beforeEach(() => {
      assignmentRepo.findOne.mockResolvedValue({
        id: 'asgn-1',
        studentId: 'student-1',
        teacherId: 'teacher-1',
        status: AssignmentStatus.ACTIVE,
      });
    });

    it('formateur requests termination with notice date', async () => {
      const dto = { noticeDate: '2026-09-01', reason: 'Personal reasons' };
      await service.createTermination('asgn-1', dto, teacherUser);
      expect(terminationRepo.save).toHaveBeenCalled();
      expect(assignmentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: AssignmentStatus.TERMINATION_REQUESTED }),
      );
    });

    it("formateur cannot terminate another teacher's assignment", async () => {
      assignmentRepo.findOne.mockResolvedValue({
        id: 'asgn-1', studentId: 'student-1', teacherId: 'teacher-99', status: AssignmentStatus.ACTIVE,
      });
      await expect(service.createTermination('asgn-1', { noticeDate: '2026-09-01' }, teacherUser))
        .rejects.toThrow(ForbiddenException);
    });

    it('responsable_pedagogique cannot request termination', async () => {
      await expect(service.createTermination('asgn-1', { noticeDate: '2026-09-01' }, rpUser))
        .rejects.toThrow(ForbiddenException);
    });

    it('already-terminated assignment throws BadRequestException (TRQ-FB-002)', async () => {
      assignmentRepo.findOne.mockResolvedValue({
        id: 'asgn-1', studentId: 'student-1', teacherId: 'teacher-1', status: AssignmentStatus.TERMINATED,
      });
      await expect(service.createTermination('asgn-1', { noticeDate: '2026-09-01' }, teacherUser))
        .rejects.toThrow(BadRequestException);
    });
  });

  // ── createPpChangeRequest ──────────────────────────────────────────────────

  describe('createPpChangeRequest', () => {
    const ppChangeDto = {
      studentId: 'student-1',
      currentPpTeacherId: 'teacher-old',
      subject: 'Mathématiques avancées',
      message: 'Le professeur actuel ne convient plus',
    };

    it('parent_financeur can request a PP change', async () => {
      const result = await service.createPpChangeRequest(ppChangeDto, parentUser);
      expect(requestRepo.save).toHaveBeenCalled();
      expect(result).toMatchObject({
        studentId: 'student-1',
        requesterId: 'parent-1',
        type: RequestType.PP_CHANGE,
        currentPpTeacherId: 'teacher-old',
      });
    });

    it('eleve cannot request a PP change (functionality 002)', async () => {
      await expect(service.createPpChangeRequest(ppChangeDto, studentUser))
        .rejects.toThrow(ForbiddenException);
    });

    it('responsable_pedagogique cannot request a PP change', async () => {
      await expect(service.createPpChangeRequest(ppChangeDto, rpUser))
        .rejects.toThrow(ForbiddenException);
    });

    it('formateur cannot request a PP change', async () => {
      await expect(service.createPpChangeRequest(ppChangeDto, teacherUser))
        .rejects.toThrow(ForbiddenException);
    });

    it('emits TeacherRequestCreated event with PP_CHANGE type', async () => {
      const eventsEmit = jest.spyOn(
        (service as any).events,
        'emit',
      );
      await service.createPpChangeRequest(ppChangeDto, parentUser);
      expect(eventsEmit).toHaveBeenCalledWith(
        'TeacherRequestCreated',
        expect.objectContaining({ type: RequestType.PP_CHANGE }),
      );
    });
  });

  // ── declineProposal ────────────────────────────────────────────────────────

  describe('declineProposal', () => {
    beforeEach(() => {
      proposalRepo.findOne.mockResolvedValue({
        id: 'prop-1',
        teacherId: 'teacher-1',
        requestId: 'req-1',
        status: ProposalStatus.PENDING,
      });
    });

    it('formateur declines their own proposal', async () => {
      const result = await service.declineProposal('prop-1', teacherUser);
      expect(result).toMatchObject({ status: ProposalStatus.DECLINED });
    });

    it("formateur cannot decline another teacher's proposal", async () => {
      const otherTeacher = { id: 'teacher-2', role: UserRole.FORMATEUR, loginIdentifier: 'teacher.two' };
      await expect(service.declineProposal('prop-1', otherTeacher))
        .rejects.toThrow(ForbiddenException);
    });

    it('eleve cannot decline a proposal', async () => {
      await expect(service.declineProposal('prop-1', studentUser))
        .rejects.toThrow(ForbiddenException);
    });

    it('responsable_pedagogique cannot decline a proposal', async () => {
      await expect(service.declineProposal('prop-1', rpUser))
        .rejects.toThrow(ForbiddenException);
    });

    it('already-declined proposal throws BadRequestException', async () => {
      proposalRepo.findOne.mockResolvedValue({
        id: 'prop-1', teacherId: 'teacher-1', requestId: 'req-1', status: ProposalStatus.DECLINED,
      });
      await expect(service.declineProposal('prop-1', teacherUser))
        .rejects.toThrow(BadRequestException);
    });

    it('unknown proposalId throws NotFoundException', async () => {
      proposalRepo.findOne.mockResolvedValue(null);
      await expect(service.declineProposal('bad-id', teacherUser))
        .rejects.toThrow(NotFoundException);
    });
  });

  // ── publishSelectedCandidates ──────────────────────────────────────────────

  describe('publishSelectedCandidates', () => {
    const publishDto = { teacherIds: ['teacher-1', 'teacher-2'] };

    beforeEach(() => {
      requestRepo.findOne.mockResolvedValue({
        id: 'req-1',
        studentId: 'student-1',
        requesterId: 'parent-1',
        status: RequestStatus.REDIRECTED,
      });
      proposalRepo.find.mockResolvedValue([
        { id: 'prop-1', requestId: 'req-1', teacherId: 'teacher-1', status: ProposalStatus.ACCEPTED },
        { id: 'prop-2', requestId: 'req-1', teacherId: 'teacher-2', status: ProposalStatus.ACCEPTED },
        { id: 'prop-3', requestId: 'req-1', teacherId: 'teacher-3', status: ProposalStatus.ACCEPTED },
      ]);
    });

    it('RP publie 2 formateurs sur 3 ayant accepté → statut CANDIDATES_PUBLISHED, événement émis', async () => {
      const eventsEmit = jest.spyOn((service as any).events, 'emit');
      const result = await service.publishSelectedCandidates('req-1', publishDto, rpUser);

      expect(requestRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: RequestStatus.CANDIDATES_PUBLISHED,
          selectedTeacherIds: ['teacher-1', 'teacher-2'],
        }),
      );
      expect(eventsEmit).toHaveBeenCalledWith(
        'TeacherCandidatesSelected',
        expect.objectContaining({
          requestId: 'req-1',
          selectedTeacherIds: ['teacher-1', 'teacher-2'],
        }),
      );
      expect(result).toMatchObject({ status: RequestStatus.CANDIDATES_PUBLISHED });
    });

    it('teacherId sans proposition acceptée → BadRequestException (400)', async () => {
      // teacher-99 n'a pas de proposition acceptée
      const invalidDto = { teacherIds: ['teacher-1', 'teacher-99'] };
      await expect(service.publishSelectedCandidates('req-1', invalidDto, rpUser))
        .rejects.toThrow(BadRequestException);
    });

    it('non-RP ne peut pas publier les candidats → ForbiddenException (403)', async () => {
      await expect(service.publishSelectedCandidates('req-1', publishDto, studentUser))
        .rejects.toThrow(ForbiddenException);
    });

    it('non-RP formateur → ForbiddenException (403)', async () => {
      await expect(service.publishSelectedCandidates('req-1', publishDto, teacherUser))
        .rejects.toThrow(ForbiddenException);
    });

    it('non-RP parent_financeur → ForbiddenException (403)', async () => {
      await expect(service.publishSelectedCandidates('req-1', publishDto, parentUser))
        .rejects.toThrow(ForbiddenException);
    });

    it('request introuvable → NotFoundException', async () => {
      requestRepo.findOne.mockResolvedValue(null);
      await expect(service.publishSelectedCandidates('bad-id', publishDto, rpUser))
        .rejects.toThrow(NotFoundException);
    });

    it('request au statut PENDING → BadRequestException (mauvais statut)', async () => {
      requestRepo.findOne.mockResolvedValue({
        id: 'req-1',
        studentId: 'student-1',
        status: RequestStatus.PENDING,
      });
      await expect(service.publishSelectedCandidates('req-1', publishDto, rpUser))
        .rejects.toThrow(BadRequestException);
    });

    it('request au statut CANDIDATES_SELECTED → accepté (déjà dans la phase de sélection)', async () => {
      requestRepo.findOne.mockResolvedValue({
        id: 'req-1',
        studentId: 'student-1',
        status: RequestStatus.CANDIDATES_SELECTED,
      });
      const result = await service.publishSelectedCandidates('req-1', publishDto, rpUser);
      expect(result).toMatchObject({ status: RequestStatus.CANDIDATES_PUBLISHED });
    });

    it('emits TeacherCandidatesSelected with correct payload', async () => {
      const eventsEmit = jest.spyOn((service as any).events, 'emit');
      await service.publishSelectedCandidates('req-1', publishDto, rpUser);
      expect(eventsEmit).toHaveBeenCalledWith(
        'TeacherCandidatesSelected',
        expect.objectContaining({
          requestId: 'req-1',
          selectedTeacherIds: ['teacher-1', 'teacher-2'],
          publishedBy: 'rp-1',
        }),
      );
    });
  });

  // ── selectCandidate ────────────────────────────────────────────────────────

  describe('selectCandidate', () => {
    const selectDto = { proposalId: 'prop-1' };

    beforeEach(() => {
      requestRepo.findOne.mockResolvedValue({
        id: 'req-1',
        studentId: 'student-1',
        requesterId: 'parent-1',
        status: RequestStatus.REDIRECTED,
      });
      proposalRepo.findOne.mockResolvedValue({
        id: 'prop-1',
        requestId: 'req-1',
        teacherId: 'teacher-1',
        status: ProposalStatus.ACCEPTED,
      });
    });

    it('eleve can select a candidate for their own request', async () => {
      const result = await service.selectCandidate('req-1', selectDto, studentUser);
      expect(result).toMatchObject({
        status: RequestStatus.CANDIDATE_CHOSEN,
        chosenTeacherId: 'teacher-1',
      });
    });

    it('parent_financeur can select a candidate for a request they created', async () => {
      const result = await service.selectCandidate('req-1', selectDto, parentUser);
      expect(result).toMatchObject({
        status: RequestStatus.CANDIDATE_CHOSEN,
        chosenTeacherId: 'teacher-1',
      });
    });

    it('responsable_pedagogique cannot select a candidate', async () => {
      await expect(service.selectCandidate('req-1', selectDto, rpUser))
        .rejects.toThrow(ForbiddenException);
    });

    it('formateur cannot select a candidate', async () => {
      await expect(service.selectCandidate('req-1', selectDto, teacherUser))
        .rejects.toThrow(ForbiddenException);
    });

    it("eleve cannot select on another student's request", async () => {
      requestRepo.findOne.mockResolvedValue({
        id: 'req-1',
        studentId: 'student-99',
        requesterId: 'parent-1',
        status: RequestStatus.REDIRECTED,
      });
      await expect(service.selectCandidate('req-1', selectDto, studentUser))
        .rejects.toThrow(ForbiddenException);
    });

    it('request not in REDIRECTED/CANDIDATES_SELECTED/CANDIDATES_PUBLISHED state throws BadRequestException', async () => {
      requestRepo.findOne.mockResolvedValue({
        id: 'req-1',
        studentId: 'student-1',
        requesterId: 'parent-1',
        status: RequestStatus.PENDING,
      });
      await expect(service.selectCandidate('req-1', selectDto, studentUser))
        .rejects.toThrow(BadRequestException);
    });

    it('eleve can select from CANDIDATES_PUBLISHED state', async () => {
      requestRepo.findOne.mockResolvedValue({
        id: 'req-1',
        studentId: 'student-1',
        requesterId: 'parent-1',
        status: RequestStatus.CANDIDATES_PUBLISHED,
      });
      const result = await service.selectCandidate('req-1', selectDto, studentUser);
      expect(result).toMatchObject({
        status: RequestStatus.CANDIDATE_CHOSEN,
        chosenTeacherId: 'teacher-1',
      });
    });

    it('proposal not accepted by teacher throws BadRequestException', async () => {
      proposalRepo.findOne.mockResolvedValue({
        id: 'prop-1',
        requestId: 'req-1',
        teacherId: 'teacher-1',
        status: ProposalStatus.PENDING,
      });
      await expect(service.selectCandidate('req-1', selectDto, studentUser))
        .rejects.toThrow(BadRequestException);
    });

    it('proposal belonging to another request throws BadRequestException', async () => {
      proposalRepo.findOne.mockResolvedValue({
        id: 'prop-1',
        requestId: 'req-OTHER',
        teacherId: 'teacher-1',
        status: ProposalStatus.ACCEPTED,
      });
      await expect(service.selectCandidate('req-1', selectDto, studentUser))
        .rejects.toThrow(BadRequestException);
    });

    it('unknown requestId throws NotFoundException', async () => {
      requestRepo.findOne.mockResolvedValue(null);
      await expect(service.selectCandidate('bad-id', selectDto, studentUser))
        .rejects.toThrow(NotFoundException);
    });

    it('emits TeacherCandidateChosen event', async () => {
      const eventsEmit = jest.spyOn((service as any).events, 'emit');
      await service.selectCandidate('req-1', selectDto, studentUser);
      expect(eventsEmit).toHaveBeenCalledWith(
        'TeacherCandidateChosen',
        expect.objectContaining({ chosenTeacherId: 'teacher-1', requestId: 'req-1' }),
      );
    });
  });

  // ── createCollaborationStopRequest ─────────────────────────────────────────

  describe('createCollaborationStopRequest', () => {
    beforeEach(() => {
      assignmentRepo.findOne.mockResolvedValue({
        id: 'asgn-1',
        studentId: 'student-1',
        teacherId: 'teacher-1',
        status: AssignmentStatus.ACTIVE,
      });
    });

    it('delegates to createTermination — emits TeacherStopRequested event', async () => {
      await service.createCollaborationStopRequest('asgn-1', { noticeDate: '2026-09-01' }, teacherUser);
      expect(eventsService.emit).toHaveBeenCalledWith(
        'TeacherStopRequested',
        expect.objectContaining({ assignmentId: 'asgn-1', teacherId: 'teacher-1' }),
      );
    });

    it('formateur can stop a collaboration they own', async () => {
      await service.createCollaborationStopRequest('asgn-1', { noticeDate: '2026-09-01' }, teacherUser);
      expect(terminationRepo.save).toHaveBeenCalled();
      expect(assignmentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: AssignmentStatus.TERMINATION_REQUESTED }),
      );
    });

    it('eleve cannot stop a collaboration', async () => {
      await expect(
        service.createCollaborationStopRequest('asgn-1', { noticeDate: '2026-09-01' }, studentUser),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ── Transaction integrity tests ────────────────────────────────────────────

  describe('acceptProposal — transaction integrity', () => {
    beforeEach(() => {
      proposalRepo.findOne.mockResolvedValue({
        id: 'prop-1',
        teacherId: 'teacher-1',
        requestId: 'req-1',
        status: ProposalStatus.PENDING,
      });
      requestRepo.findOne.mockResolvedValue({
        id: 'req-1',
        studentId: 'student-1',
        status: RequestStatus.REDIRECTED,
      });
    });

    it('nominal: all three saves are called inside the transaction and event is emitted', async () => {
      const result = await service.acceptProposal('prop-1', teacherUser);

      expect(dataSource.transaction).toHaveBeenCalledTimes(1);
      expect(assignmentRepo.save).toHaveBeenCalledTimes(1);
      expect(proposalRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: ProposalStatus.ACCEPTED }),
      );
      expect(requestRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: RequestStatus.ASSIGNED }),
      );
      expect(result).toMatchObject({ studentId: 'student-1', teacherId: 'teacher-1' });
      expect(eventsService.emit).toHaveBeenCalledWith('TeacherAssigned', expect.any(Object));
    });

    it('rollback: error on proposalRepo.save rolls back — no event is emitted', async () => {
      dataSource.transaction = jest.fn(async (callback: (manager: unknown) => Promise<unknown>) => {
        const faultyProposalRepo = {
          ...makeRepo(),
          save: jest.fn().mockRejectedValue(new Error('DB failure on proposal save')),
        };
        const manager = {
          getRepository: jest.fn((entity: { name: string }) => {
            if (entity.name === 'TeacherProposal') return faultyProposalRepo;
            if (entity.name === 'Assignment') return assignmentRepo;
            if (entity.name === 'TeacherRequest') return requestRepo;
            return makeRepo();
          }),
        };
        return callback(manager);
      });

      await expect(service.acceptProposal('prop-1', teacherUser)).rejects.toThrow('DB failure on proposal save');
      // requestRepo.save is inside the transaction callback — it was not reached before the throw
      expect(requestRepo.save).not.toHaveBeenCalled();
      expect(eventsService.emit).not.toHaveBeenCalled();
    });
  });

  describe('createTermination — transaction integrity', () => {
    beforeEach(() => {
      assignmentRepo.findOne.mockResolvedValue({
        id: 'asgn-1',
        studentId: 'student-1',
        teacherId: 'teacher-1',
        status: AssignmentStatus.ACTIVE,
      });
    });

    it('nominal: both saves are called inside the transaction and event is emitted', async () => {
      const dto = { noticeDate: '2026-09-01', reason: 'Departure' };
      const result = await service.createTermination('asgn-1', dto, teacherUser);

      expect(dataSource.transaction).toHaveBeenCalledTimes(1);
      expect(terminationRepo.save).toHaveBeenCalledTimes(1);
      expect(assignmentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: AssignmentStatus.TERMINATION_REQUESTED }),
      );
      expect(result).toMatchObject({ assignmentId: 'asgn-1', teacherId: 'teacher-1' });
      expect(eventsService.emit).toHaveBeenCalledWith('TeacherRelationTerminationRequested', expect.any(Object));
    });

    it('rollback: error on assignmentRepo.save rolls back — no event is emitted', async () => {
      dataSource.transaction = jest.fn(async (callback: (manager: unknown) => Promise<unknown>) => {
        const faultyAssignmentRepo = {
          ...makeRepo(),
          save: jest.fn().mockRejectedValue(new Error('DB failure on assignment save')),
        };
        const manager = {
          getRepository: jest.fn((entity: { name: string }) => {
            if (entity.name === 'Assignment') return faultyAssignmentRepo;
            if (entity.name === 'TerminationRequest') return terminationRepo;
            return makeRepo();
          }),
        };
        return callback(manager);
      });

      const dto = { noticeDate: '2026-09-01', reason: 'Departure' };
      await expect(service.createTermination('asgn-1', dto, teacherUser)).rejects.toThrow('DB failure on assignment save');
      expect(eventsService.emit).not.toHaveBeenCalled();
    });
  });

  describe('createProposal — transaction integrity', () => {
    beforeEach(() => {
      requestRepo.findOne.mockResolvedValue({ id: 'req-1', status: RequestStatus.PENDING });
    });

    it('nominal: both saves are called inside the transaction and event is emitted', async () => {
      const result = await service.createProposal('req-1', { teacherId: 'teacher-1' }, rpUser);

      expect(dataSource.transaction).toHaveBeenCalledTimes(1);
      expect(proposalRepo.save).toHaveBeenCalledTimes(1);
      expect(requestRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: RequestStatus.REDIRECTED }),
      );
      expect(result).toMatchObject({ requestId: 'req-1', teacherId: 'teacher-1' });
      expect(eventsService.emit).toHaveBeenCalledWith('TeacherProposalSent', expect.any(Object));
    });

    it('rollback: error on requestRepo.save rolls back — no event is emitted', async () => {
      dataSource.transaction = jest.fn(async (callback: (manager: unknown) => Promise<unknown>) => {
        const faultyRequestRepo = {
          ...makeRepo(),
          save: jest.fn().mockRejectedValue(new Error('DB failure on request save')),
        };
        const manager = {
          getRepository: jest.fn((entity: { name: string }) => {
            if (entity.name === 'TeacherRequest') return faultyRequestRepo;
            if (entity.name === 'TeacherProposal') return proposalRepo;
            return makeRepo();
          }),
        };
        return callback(manager);
      });

      await expect(service.createProposal('req-1', { teacherId: 'teacher-1' }, rpUser)).rejects.toThrow('DB failure on request save');
      expect(eventsService.emit).not.toHaveBeenCalled();
    });
  });
});
