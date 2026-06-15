import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';

import { TeacherRequestService } from '../../src/teacher-request/teacher-request.service';
import { TeacherRequest, RequestStatus } from '../../src/teacher-request/entities/teacher-request.entity';
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

const studentUser = { id: 'student-1', role: UserRole.ELEVE };
const parentUser = { id: 'parent-1', role: UserRole.PARENT_FINANCEUR };
const rpUser = { id: 'rp-1', role: UserRole.RESPONSABLE_PEDAGOGIQUE };
const teacherUser = { id: 'teacher-1', role: UserRole.FORMATEUR };
const adminFinUser = { id: 'admin-fin-1', role: UserRole.ADMINISTRATEUR_FINANCIER };

describe('TeacherRequestService', () => {
  let service: TeacherRequestService;
  let requestRepo: ReturnType<typeof makeRepo>;
  let proposalRepo: ReturnType<typeof makeRepo>;
  let assignmentRepo: ReturnType<typeof makeRepo>;
  let terminationRepo: ReturnType<typeof makeRepo>;

  beforeEach(async () => {
    requestRepo = makeRepo();
    proposalRepo = makeRepo();
    assignmentRepo = makeRepo();
    terminationRepo = makeRepo();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TeacherRequestService,
        { provide: getRepositoryToken(TeacherRequest), useValue: requestRepo },
        { provide: getRepositoryToken(TeacherProposal), useValue: proposalRepo },
        { provide: getRepositoryToken(Assignment), useValue: assignmentRepo },
        { provide: getRepositoryToken(TerminationRequest), useValue: terminationRepo },
        { provide: EventsService, useValue: { emit: jest.fn() } },
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
      const otherTeacher = { id: 'teacher-2', role: UserRole.FORMATEUR };
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
});
