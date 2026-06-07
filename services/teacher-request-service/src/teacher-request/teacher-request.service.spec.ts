import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';

import { TeacherRequestService } from './teacher-request.service';
import { TeacherRequest, RequestStatus } from './entities/teacher-request.entity';
import { TeacherProposal, ProposalStatus } from './entities/teacher-proposal.entity';
import { Assignment, AssignmentStatus } from './entities/assignment.entity';
import { TerminationRequest } from './entities/termination-request.entity';
import { EventsService } from './events.service';

const makeRepo = () => ({
  create: jest.fn((dto) => ({ ...dto })),
  save: jest.fn((entity) => Promise.resolve({ id: 'uuid-1', ...entity })),
  find: jest.fn(() => Promise.resolve([])),
  findOne: jest.fn(),
});

const student = { sub: 'student-1', role: 'STUDENT' };
const parent = { sub: 'parent-1', role: 'PARENT' };
const rp = { sub: 'rp-1', role: 'RP' };
const teacher = { sub: 'teacher-1', role: 'TEACHER' };

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
    it('STUDENT creates request — studentId defaults to their own sub', async () => {
      const dto = { subject: 'Algèbre', level: 'Terminale' };
      const result = await service.createRequest(dto, student);
      expect(requestRepo.save).toHaveBeenCalled();
      expect(result).toMatchObject({ studentId: 'student-1', requesterId: 'student-1', subject: 'Algèbre' });
    });

    it('PARENT creates request with explicit studentId', async () => {
      const dto = { subject: 'Géométrie', studentId: 'student-2' };
      const result = await service.createRequest(dto, parent);
      expect(result).toMatchObject({ studentId: 'student-2', requesterId: 'parent-1' });
    });

    it('PARENT without studentId throws BadRequestException', async () => {
      await expect(service.createRequest({ subject: 'Calcul' }, parent))
        .rejects.toThrow(BadRequestException);
    });

    it('RP cannot create a teacher request', async () => {
      await expect(service.createRequest({ subject: 'Test' }, rp))
        .rejects.toThrow(ForbiddenException);
    });

    it('TEACHER cannot create a teacher request', async () => {
      await expect(service.createRequest({ subject: 'Test' }, teacher))
        .rejects.toThrow(ForbiddenException);
    });
  });

  // ── listRequests ───────────────────────────────────────────────────────────

  describe('listRequests', () => {
    it('STUDENT queries by studentId', async () => {
      await service.listRequests(student);
      expect(requestRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { studentId: 'student-1' } }),
      );
    });

    it('PARENT queries by requesterId', async () => {
      await service.listRequests(parent);
      expect(requestRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { requesterId: 'parent-1' } }),
      );
    });

    it('RP sees all requests', async () => {
      await service.listRequests(rp);
      expect(requestRepo.find).toHaveBeenCalledWith(expect.objectContaining({ order: { createdAt: 'DESC' } }));
    });

    it('TEACHER sees only their own proposals (TRQ-FB-001)', async () => {
      await service.listRequests(teacher);
      expect(proposalRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { teacherId: 'teacher-1' } }),
      );
      expect(requestRepo.find).not.toHaveBeenCalled();
    });

    it('unknown role throws ForbiddenException', async () => {
      await expect(service.listRequests({ sub: 'x', role: 'FINANCE_ADMIN' }))
        .rejects.toThrow(ForbiddenException);
    });
  });

  // ── createProposal ─────────────────────────────────────────────────────────

  describe('createProposal', () => {
    beforeEach(() => {
      requestRepo.findOne.mockResolvedValue({ id: 'req-1', status: RequestStatus.PENDING });
    });

    it('RP redirects a pending request to a teacher', async () => {
      const result = await service.createProposal('req-1', { teacherId: 'teacher-1' }, rp);
      expect(result).toMatchObject({ requestId: 'req-1', teacherId: 'teacher-1' });
      expect(requestRepo.save).toHaveBeenCalledWith(expect.objectContaining({ status: RequestStatus.REDIRECTED }));
    });

    it('non-RP cannot create proposals', async () => {
      await expect(service.createProposal('req-1', { teacherId: 'teacher-1' }, teacher))
        .rejects.toThrow(ForbiddenException);
    });

    it('unknown requestId throws NotFoundException', async () => {
      requestRepo.findOne.mockResolvedValue(null);
      await expect(service.createProposal('bad-id', { teacherId: 'teacher-1' }, rp))
        .rejects.toThrow(NotFoundException);
    });

    it('already-assigned request cannot be redirected', async () => {
      requestRepo.findOne.mockResolvedValue({ id: 'req-1', status: RequestStatus.ASSIGNED });
      await expect(service.createProposal('req-1', { teacherId: 'teacher-1' }, rp))
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

    it('teacher accepts their own proposal → creates assignment', async () => {
      const result = await service.acceptProposal('prop-1', teacher);
      expect(result).toMatchObject({ studentId: 'student-1', teacherId: 'teacher-1' });
      expect(assignmentRepo.save).toHaveBeenCalled();
    });

    it('teacher cannot accept another teacher\'s proposal (TRQ-FB-001)', async () => {
      const otherTeacher = { sub: 'teacher-2', role: 'TEACHER' };
      await expect(service.acceptProposal('prop-1', otherTeacher))
        .rejects.toThrow(ForbiddenException);
    });

    it('non-teacher cannot accept a proposal', async () => {
      await expect(service.acceptProposal('prop-1', student))
        .rejects.toThrow(ForbiddenException);
    });

    it('already-accepted proposal throws BadRequestException', async () => {
      proposalRepo.findOne.mockResolvedValue({ id: 'prop-1', teacherId: 'teacher-1', requestId: 'req-1', status: ProposalStatus.ACCEPTED });
      await expect(service.acceptProposal('prop-1', teacher))
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

    it('RP can set main teacher on any active assignment', async () => {
      const result = await service.setMainTeacher('asgn-1', rp);
      expect(result).toMatchObject({ isMainTeacher: true });
    });

    it('STUDENT can set main teacher for their own assignment', async () => {
      const result = await service.setMainTeacher('asgn-1', student);
      expect(result).toMatchObject({ isMainTeacher: true });
    });

    it('STUDENT cannot set main teacher on another student\'s assignment (TRQ-FB-003)', async () => {
      assignmentRepo.findOne.mockResolvedValue({
        id: 'asgn-1', studentId: 'student-99', teacherId: 'teacher-1', status: AssignmentStatus.ACTIVE,
      });
      await expect(service.setMainTeacher('asgn-1', student))
        .rejects.toThrow(ForbiddenException);
    });

    it('TEACHER cannot set main teacher', async () => {
      await expect(service.setMainTeacher('asgn-1', teacher))
        .rejects.toThrow(ForbiddenException);
    });

    it('inactive assignment throws BadRequestException (TRQ-FB-003)', async () => {
      assignmentRepo.findOne.mockResolvedValue({
        id: 'asgn-1', studentId: 'student-1', teacherId: 'teacher-1', status: AssignmentStatus.TERMINATED,
      });
      await expect(service.setMainTeacher('asgn-1', rp))
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

    it('teacher requests termination with notice date', async () => {
      const dto = { noticeDate: '2026-09-01', reason: 'Personal reasons' };
      const result = await service.createTermination('asgn-1', dto, teacher);
      expect(terminationRepo.save).toHaveBeenCalled();
      expect(assignmentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: AssignmentStatus.TERMINATION_REQUESTED }),
      );
    });

    it('teacher cannot terminate another teacher\'s assignment', async () => {
      assignmentRepo.findOne.mockResolvedValue({
        id: 'asgn-1', studentId: 'student-1', teacherId: 'teacher-99', status: AssignmentStatus.ACTIVE,
      });
      await expect(service.createTermination('asgn-1', { noticeDate: '2026-09-01' }, teacher))
        .rejects.toThrow(ForbiddenException);
    });

    it('non-teacher cannot request termination', async () => {
      await expect(service.createTermination('asgn-1', { noticeDate: '2026-09-01' }, rp))
        .rejects.toThrow(ForbiddenException);
    });

    it('already-terminated assignment throws BadRequestException (TRQ-FB-002)', async () => {
      assignmentRepo.findOne.mockResolvedValue({
        id: 'asgn-1', studentId: 'student-1', teacherId: 'teacher-1', status: AssignmentStatus.TERMINATED,
      });
      await expect(service.createTermination('asgn-1', { noticeDate: '2026-09-01' }, teacher))
        .rejects.toThrow(BadRequestException);
    });
  });
});
