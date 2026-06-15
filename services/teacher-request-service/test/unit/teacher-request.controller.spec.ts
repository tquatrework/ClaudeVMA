import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import {
  TeacherRequestController,
  ProposalController,
  AssignmentController,
  CollaborationController,
} from '../../src/teacher-request/teacher-request.controller';
import { TeacherRequestService } from '../../src/teacher-request/teacher-request.service';
import { JwtAuthGuard } from '../../src/common/jwt.guard';
import { RequestStatus, RequestType } from '../../src/teacher-request/entities/teacher-request.entity';
import { ProposalStatus } from '../../src/teacher-request/entities/teacher-proposal.entity';
import { AssignmentStatus } from '../../src/teacher-request/entities/assignment.entity';
import { UserRole } from '../../src/common/user-role.enum';

// ── Shared user fixtures ──────────────────────────────────────────────────────

const studentUser = { id: 'student-1', role: UserRole.ELEVE };
const parentUser = { id: 'parent-1', role: UserRole.PARENT_FINANCEUR };
const rpUser = { id: 'rp-1', role: UserRole.RESPONSABLE_PEDAGOGIQUE };
const teacherUser = { id: 'teacher-1', role: UserRole.FORMATEUR };

// ── Shared entity fixtures ────────────────────────────────────────────────────

const baseRequest = {
  id: 'req-1',
  requesterId: 'student-1',
  requesterRole: UserRole.ELEVE,
  studentId: 'student-1',
  subject: 'Algèbre',
  status: RequestStatus.PENDING,
  type: RequestType.SPECIFIC,
};

const baseProposal = {
  id: 'prop-1',
  requestId: 'req-1',
  teacherId: 'teacher-1',
  status: ProposalStatus.PENDING,
};

const baseAssignment = {
  id: 'asgn-1',
  studentId: 'student-1',
  teacherId: 'teacher-1',
  proposalId: 'prop-1',
  requestId: 'req-1',
  isMainTeacher: false,
  status: AssignmentStatus.ACTIVE,
};

const baseTermination = {
  id: 'term-1',
  assignmentId: 'asgn-1',
  teacherId: 'teacher-1',
  noticeDate: new Date('2026-09-01'),
  reason: 'Personal reasons',
};

// ── Mock service factory ──────────────────────────────────────────────────────

const makeMockService = () => ({
  createRequest: jest.fn(),
  createPpChangeRequest: jest.fn(),
  listRequests: jest.fn(),
  getRequest: jest.fn(),
  updateRequestStatus: jest.fn(),
  deleteRequest: jest.fn(),
  createProposal: jest.fn(),
  acceptProposal: jest.fn(),
  declineProposal: jest.fn(),
  publishSelectedCandidates: jest.fn(),
  selectCandidate: jest.fn(),
  setMainTeacher: jest.fn(),
  createTermination: jest.fn(),
  createCollaborationStopRequest: jest.fn(),
});

// ── Helper: bypass JwtAuthGuard so controller logic can be tested in isolation

const overrideJwtGuard = (builder: any) =>
  builder.overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true });

// =============================================================================
// TeacherRequestController
// =============================================================================

describe('TeacherRequestController', () => {
  let controller: TeacherRequestController;
  let mockService: ReturnType<typeof makeMockService>;

  beforeEach(async () => {
    mockService = makeMockService();

    const moduleBuilder = Test.createTestingModule({
      controllers: [TeacherRequestController],
      providers: [
        { provide: TeacherRequestService, useValue: mockService },
        Reflector,
      ],
    });

    const module: TestingModule = await overrideJwtGuard(moduleBuilder).compile();
    controller = module.get(TeacherRequestController);
  });

  // ── JwtAuthGuard is applied ─────────────────────────────────────────────────

  describe('guard binding', () => {
    it('JwtAuthGuard is applied at controller level', () => {
      const guards = Reflect.getMetadata('__guards__', TeacherRequestController);
      const hasJwtGuard = guards?.some(
        (guard: any) => guard === JwtAuthGuard || guard?.name === 'JwtAuthGuard',
      );
      expect(hasJwtGuard).toBe(true);
    });
  });

  // ── createRequest ───────────────────────────────────────────────────────────

  describe('POST / — createRequest', () => {
    it('delegates to service.createRequest and returns its result', async () => {
      mockService.createRequest.mockResolvedValue(baseRequest);
      const dto = { subject: 'Algèbre', level: 'Terminale' };
      const result = await controller.createRequest(dto as any, studentUser as any);
      expect(mockService.createRequest).toHaveBeenCalledWith(dto, studentUser);
      expect(result).toEqual(baseRequest);
    });

    it('propagates ForbiddenException from service (non-allowed role)', async () => {
      mockService.createRequest.mockRejectedValue(new ForbiddenException());
      await expect(controller.createRequest({} as any, teacherUser as any)).rejects.toThrow(ForbiddenException);
    });

    it('propagates BadRequestException from service (missing studentId)', async () => {
      mockService.createRequest.mockRejectedValue(new BadRequestException());
      await expect(controller.createRequest({} as any, parentUser as any)).rejects.toThrow(BadRequestException);
    });
  });

  // ── createPpChangeRequest ───────────────────────────────────────────────────

  describe('POST /pp-change — createPpChangeRequest', () => {
    const ppChangeDto = {
      studentId: 'student-1',
      currentPpTeacherId: 'teacher-old',
      subject: 'Mathématiques',
      message: 'Changement demandé',
    };

    it('delegates to service.createPpChangeRequest and returns its result', async () => {
      const ppChangeResult = { ...baseRequest, type: RequestType.PP_CHANGE };
      mockService.createPpChangeRequest.mockResolvedValue(ppChangeResult);
      const result = await controller.createPpChangeRequest(ppChangeDto as any, parentUser as any);
      expect(mockService.createPpChangeRequest).toHaveBeenCalledWith(ppChangeDto, parentUser);
      expect(result).toEqual(ppChangeResult);
    });

    it('propagates ForbiddenException when non-PARENT_FINANCEUR calls the route', async () => {
      mockService.createPpChangeRequest.mockRejectedValue(new ForbiddenException());
      await expect(controller.createPpChangeRequest(ppChangeDto as any, studentUser as any))
        .rejects.toThrow(ForbiddenException);
    });

    it('propagates ForbiddenException when RP calls the route', async () => {
      mockService.createPpChangeRequest.mockRejectedValue(new ForbiddenException());
      await expect(controller.createPpChangeRequest(ppChangeDto as any, rpUser as any))
        .rejects.toThrow(ForbiddenException);
    });
  });

  // ── listRequests ────────────────────────────────────────────────────────────

  describe('GET / — listRequests', () => {
    it('delegates to service.listRequests and returns its result', async () => {
      mockService.listRequests.mockResolvedValue([baseRequest]);
      const result = await controller.listRequests(rpUser as any);
      expect(mockService.listRequests).toHaveBeenCalledWith(rpUser);
      expect(result).toEqual([baseRequest]);
    });

    it('propagates ForbiddenException for unauthorized roles', async () => {
      mockService.listRequests.mockRejectedValue(new ForbiddenException());
      await expect(controller.listRequests({ id: 'x', role: UserRole.ADMINISTRATEUR_FINANCIER } as any))
        .rejects.toThrow(ForbiddenException);
    });
  });

  // ── getRequest ──────────────────────────────────────────────────────────────

  describe('GET /:id — getRequest', () => {
    it('delegates to service.getRequest and returns its result', async () => {
      mockService.getRequest.mockResolvedValue(baseRequest);
      const result = await controller.getRequest('req-1', rpUser as any);
      expect(mockService.getRequest).toHaveBeenCalledWith('req-1', rpUser);
      expect(result).toEqual(baseRequest);
    });

    it('propagates NotFoundException for unknown id', async () => {
      mockService.getRequest.mockRejectedValue(new NotFoundException());
      await expect(controller.getRequest('bad-id', rpUser as any)).rejects.toThrow(NotFoundException);
    });

    it('propagates ForbiddenException when student accesses another request', async () => {
      mockService.getRequest.mockRejectedValue(new ForbiddenException());
      await expect(controller.getRequest('req-other', studentUser as any)).rejects.toThrow(ForbiddenException);
    });
  });

  // ── publishSelectedCandidates ───────────────────────────────────────────────

  describe('POST /:id/selected-candidates — publishSelectedCandidates', () => {
    const publishDto = { teacherIds: ['teacher-1', 'teacher-2'] };
    const publishedRequest = { ...baseRequest, status: RequestStatus.CANDIDATES_PUBLISHED };

    it('RP publishes selected candidates — delegates correctly and returns result', async () => {
      mockService.publishSelectedCandidates.mockResolvedValue(publishedRequest);
      const result = await controller.publishSelectedCandidates('req-1', publishDto as any, rpUser as any);
      expect(mockService.publishSelectedCandidates).toHaveBeenCalledWith('req-1', publishDto, rpUser);
      expect(result).toEqual(publishedRequest);
    });

    it('propagates ForbiddenException for non-RP (student)', async () => {
      mockService.publishSelectedCandidates.mockRejectedValue(new ForbiddenException());
      await expect(controller.publishSelectedCandidates('req-1', publishDto as any, studentUser as any))
        .rejects.toThrow(ForbiddenException);
    });

    it('propagates ForbiddenException for non-RP (formateur)', async () => {
      mockService.publishSelectedCandidates.mockRejectedValue(new ForbiddenException());
      await expect(controller.publishSelectedCandidates('req-1', publishDto as any, teacherUser as any))
        .rejects.toThrow(ForbiddenException);
    });

    it('propagates BadRequestException when a teacherId has no accepted proposal', async () => {
      mockService.publishSelectedCandidates.mockRejectedValue(new BadRequestException());
      await expect(controller.publishSelectedCandidates('req-1', { teacherIds: ['teacher-99'] } as any, rpUser as any))
        .rejects.toThrow(BadRequestException);
    });

    it('propagates NotFoundException for unknown request', async () => {
      mockService.publishSelectedCandidates.mockRejectedValue(new NotFoundException());
      await expect(controller.publishSelectedCandidates('bad-id', publishDto as any, rpUser as any))
        .rejects.toThrow(NotFoundException);
    });
  });

  // ── selectCandidate ─────────────────────────────────────────────────────────

  describe('POST /:id/select — selectCandidate', () => {
    const selectDto = { proposalId: 'prop-1' };
    const chosenRequest = { ...baseRequest, status: RequestStatus.CANDIDATE_CHOSEN, chosenTeacherId: 'teacher-1' };

    it('eleve selects a candidate — delegates correctly', async () => {
      mockService.selectCandidate.mockResolvedValue(chosenRequest);
      const result = await controller.selectCandidate('req-1', selectDto as any, studentUser as any);
      expect(mockService.selectCandidate).toHaveBeenCalledWith('req-1', selectDto, studentUser);
      expect(result).toEqual(chosenRequest);
    });

    it('parent_financeur selects a candidate — delegates correctly', async () => {
      mockService.selectCandidate.mockResolvedValue(chosenRequest);
      const result = await controller.selectCandidate('req-1', selectDto as any, parentUser as any);
      expect(mockService.selectCandidate).toHaveBeenCalledWith('req-1', selectDto, parentUser);
      expect(result).toEqual(chosenRequest);
    });

    it('propagates ForbiddenException for RP', async () => {
      mockService.selectCandidate.mockRejectedValue(new ForbiddenException());
      await expect(controller.selectCandidate('req-1', selectDto as any, rpUser as any))
        .rejects.toThrow(ForbiddenException);
    });

    it('propagates BadRequestException for bad state', async () => {
      mockService.selectCandidate.mockRejectedValue(new BadRequestException());
      await expect(controller.selectCandidate('req-1', selectDto as any, studentUser as any))
        .rejects.toThrow(BadRequestException);
    });
  });

  // ── updateStatus ────────────────────────────────────────────────────────────

  describe('PATCH /:id/status — updateStatus', () => {
    it('RP updates status — delegates correctly', async () => {
      const updatedRequest = { ...baseRequest, status: RequestStatus.ACCEPTED };
      mockService.updateRequestStatus.mockResolvedValue(updatedRequest);
      const result = await controller.updateStatus('req-1', { status: RequestStatus.ACCEPTED } as any, rpUser as any);
      expect(mockService.updateRequestStatus).toHaveBeenCalledWith('req-1', RequestStatus.ACCEPTED, rpUser);
      expect(result).toEqual(updatedRequest);
    });

    it('propagates ForbiddenException for non-RP', async () => {
      mockService.updateRequestStatus.mockRejectedValue(new ForbiddenException());
      await expect(controller.updateStatus('req-1', { status: RequestStatus.ACCEPTED } as any, teacherUser as any))
        .rejects.toThrow(ForbiddenException);
    });

    it('propagates BadRequestException for invalid transition', async () => {
      mockService.updateRequestStatus.mockRejectedValue(new BadRequestException());
      await expect(controller.updateStatus('req-1', { status: RequestStatus.ACCEPTED } as any, rpUser as any))
        .rejects.toThrow(BadRequestException);
    });

    it('propagates NotFoundException for unknown id', async () => {
      mockService.updateRequestStatus.mockRejectedValue(new NotFoundException());
      await expect(controller.updateStatus('bad-id', { status: RequestStatus.ACCEPTED } as any, rpUser as any))
        .rejects.toThrow(NotFoundException);
    });
  });

  // ── deleteRequest ───────────────────────────────────────────────────────────

  describe('DELETE /:id — deleteRequest', () => {
    it('RP deletes a request — delegates correctly', async () => {
      mockService.deleteRequest.mockResolvedValue(undefined);
      await controller.deleteRequest('req-1', rpUser as any);
      expect(mockService.deleteRequest).toHaveBeenCalledWith('req-1', rpUser);
    });

    it('propagates ForbiddenException for non-RP', async () => {
      mockService.deleteRequest.mockRejectedValue(new ForbiddenException());
      await expect(controller.deleteRequest('req-1', teacherUser as any)).rejects.toThrow(ForbiddenException);
    });

    it('propagates NotFoundException for unknown id', async () => {
      mockService.deleteRequest.mockRejectedValue(new NotFoundException());
      await expect(controller.deleteRequest('bad-id', rpUser as any)).rejects.toThrow(NotFoundException);
    });
  });

  // ── createProposal sub-route ────────────────────────────────────────────────

  describe('POST /:requestId/proposals — createProposal', () => {
    it('RP creates a proposal — delegates correctly', async () => {
      mockService.createProposal.mockResolvedValue(baseProposal);
      const dto = { teacherId: 'teacher-1' };
      const result = await controller.createProposal('req-1', dto as any, rpUser as any);
      expect(mockService.createProposal).toHaveBeenCalledWith('req-1', dto, rpUser);
      expect(result).toEqual(baseProposal);
    });

    it('propagates ForbiddenException for formateur', async () => {
      mockService.createProposal.mockRejectedValue(new ForbiddenException());
      await expect(controller.createProposal('req-1', { teacherId: 'teacher-1' } as any, teacherUser as any))
        .rejects.toThrow(ForbiddenException);
    });

    it('propagates NotFoundException for unknown request', async () => {
      mockService.createProposal.mockRejectedValue(new NotFoundException());
      await expect(controller.createProposal('bad-id', { teacherId: 'teacher-1' } as any, rpUser as any))
        .rejects.toThrow(NotFoundException);
    });
  });
});

// =============================================================================
// ProposalController
// =============================================================================

describe('ProposalController', () => {
  let controller: ProposalController;
  let mockService: ReturnType<typeof makeMockService>;

  beforeEach(async () => {
    mockService = makeMockService();

    const moduleBuilder = Test.createTestingModule({
      controllers: [ProposalController],
      providers: [
        { provide: TeacherRequestService, useValue: mockService },
        Reflector,
      ],
    });

    const module: TestingModule = await overrideJwtGuard(moduleBuilder).compile();
    controller = module.get(ProposalController);
  });

  // ── JwtAuthGuard is applied ─────────────────────────────────────────────────

  describe('guard binding', () => {
    it('JwtAuthGuard is applied at controller level', () => {
      const guards = Reflect.getMetadata('__guards__', ProposalController);
      const hasJwtGuard = guards?.some(
        (guard: any) => guard === JwtAuthGuard || guard?.name === 'JwtAuthGuard',
      );
      expect(hasJwtGuard).toBe(true);
    });
  });

  // ── acceptProposal ──────────────────────────────────────────────────────────

  describe('POST /:proposalId/accept — acceptProposal', () => {
    it('formateur accepts their own proposal — delegates correctly', async () => {
      mockService.acceptProposal.mockResolvedValue(baseAssignment);
      const result = await controller.acceptProposal('prop-1', teacherUser as any);
      expect(mockService.acceptProposal).toHaveBeenCalledWith('prop-1', teacherUser);
      expect(result).toEqual(baseAssignment);
    });

    it("propagates ForbiddenException when formateur tries to accept another teacher's proposal", async () => {
      mockService.acceptProposal.mockRejectedValue(new ForbiddenException());
      const otherTeacher = { id: 'teacher-2', role: UserRole.FORMATEUR };
      await expect(controller.acceptProposal('prop-1', otherTeacher as any))
        .rejects.toThrow(ForbiddenException);
    });

    it('propagates ForbiddenException for eleve (wrong role)', async () => {
      mockService.acceptProposal.mockRejectedValue(new ForbiddenException());
      await expect(controller.acceptProposal('prop-1', studentUser as any))
        .rejects.toThrow(ForbiddenException);
    });

    it('propagates BadRequestException for already-accepted proposal', async () => {
      mockService.acceptProposal.mockRejectedValue(new BadRequestException());
      await expect(controller.acceptProposal('prop-1', teacherUser as any))
        .rejects.toThrow(BadRequestException);
    });

    it('propagates NotFoundException for unknown proposal', async () => {
      mockService.acceptProposal.mockRejectedValue(new NotFoundException());
      await expect(controller.acceptProposal('bad-id', teacherUser as any))
        .rejects.toThrow(NotFoundException);
    });
  });

  // ── declineProposal ─────────────────────────────────────────────────────────

  describe('POST /:proposalId/decline — declineProposal', () => {
    it('formateur declines their own proposal — delegates correctly', async () => {
      const declinedProposal = { ...baseProposal, status: ProposalStatus.DECLINED };
      mockService.declineProposal.mockResolvedValue(declinedProposal);
      const result = await controller.declineProposal('prop-1', teacherUser as any);
      expect(mockService.declineProposal).toHaveBeenCalledWith('prop-1', teacherUser);
      expect(result).toEqual(declinedProposal);
    });

    it("propagates ForbiddenException when formateur tries to decline another teacher's proposal", async () => {
      mockService.declineProposal.mockRejectedValue(new ForbiddenException());
      const otherTeacher = { id: 'teacher-2', role: UserRole.FORMATEUR };
      await expect(controller.declineProposal('prop-1', otherTeacher as any))
        .rejects.toThrow(ForbiddenException);
    });

    it('propagates ForbiddenException for eleve', async () => {
      mockService.declineProposal.mockRejectedValue(new ForbiddenException());
      await expect(controller.declineProposal('prop-1', studentUser as any))
        .rejects.toThrow(ForbiddenException);
    });

    it('propagates ForbiddenException for RP', async () => {
      mockService.declineProposal.mockRejectedValue(new ForbiddenException());
      await expect(controller.declineProposal('prop-1', rpUser as any))
        .rejects.toThrow(ForbiddenException);
    });

    it('propagates BadRequestException for already-declined proposal', async () => {
      mockService.declineProposal.mockRejectedValue(new BadRequestException());
      await expect(controller.declineProposal('prop-1', teacherUser as any))
        .rejects.toThrow(BadRequestException);
    });

    it('propagates NotFoundException for unknown proposal', async () => {
      mockService.declineProposal.mockRejectedValue(new NotFoundException());
      await expect(controller.declineProposal('bad-id', teacherUser as any))
        .rejects.toThrow(NotFoundException);
    });
  });
});

// =============================================================================
// AssignmentController
// =============================================================================

describe('AssignmentController', () => {
  let controller: AssignmentController;
  let mockService: ReturnType<typeof makeMockService>;

  beforeEach(async () => {
    mockService = makeMockService();

    const moduleBuilder = Test.createTestingModule({
      controllers: [AssignmentController],
      providers: [
        { provide: TeacherRequestService, useValue: mockService },
        Reflector,
      ],
    });

    const module: TestingModule = await overrideJwtGuard(moduleBuilder).compile();
    controller = module.get(AssignmentController);
  });

  // ── JwtAuthGuard is applied ─────────────────────────────────────────────────

  describe('guard binding', () => {
    it('JwtAuthGuard is applied at controller level', () => {
      const guards = Reflect.getMetadata('__guards__', AssignmentController);
      const hasJwtGuard = guards?.some(
        (guard: any) => guard === JwtAuthGuard || guard?.name === 'JwtAuthGuard',
      );
      expect(hasJwtGuard).toBe(true);
    });
  });

  // ── setMainTeacher ──────────────────────────────────────────────────────────

  describe('POST /:assignmentId/main-teacher — setMainTeacher', () => {
    it('RP sets main teacher — delegates correctly', async () => {
      const updatedAssignment = { ...baseAssignment, isMainTeacher: true };
      mockService.setMainTeacher.mockResolvedValue(updatedAssignment);
      const result = await controller.setMainTeacher('asgn-1', rpUser as any);
      expect(mockService.setMainTeacher).toHaveBeenCalledWith('asgn-1', rpUser);
      expect(result).toEqual(updatedAssignment);
    });

    it('eleve sets main teacher on own assignment — delegates correctly', async () => {
      const updatedAssignment = { ...baseAssignment, isMainTeacher: true };
      mockService.setMainTeacher.mockResolvedValue(updatedAssignment);
      const result = await controller.setMainTeacher('asgn-1', studentUser as any);
      expect(mockService.setMainTeacher).toHaveBeenCalledWith('asgn-1', studentUser);
      expect(result).toEqual(updatedAssignment);
    });

    it('propagates ForbiddenException for formateur', async () => {
      mockService.setMainTeacher.mockRejectedValue(new ForbiddenException());
      await expect(controller.setMainTeacher('asgn-1', teacherUser as any))
        .rejects.toThrow(ForbiddenException);
    });

    it("propagates ForbiddenException when eleve accesses another student's assignment", async () => {
      mockService.setMainTeacher.mockRejectedValue(new ForbiddenException());
      await expect(controller.setMainTeacher('asgn-other', studentUser as any))
        .rejects.toThrow(ForbiddenException);
    });

    it('propagates BadRequestException for inactive assignment (TRQ-FB-003)', async () => {
      mockService.setMainTeacher.mockRejectedValue(new BadRequestException());
      await expect(controller.setMainTeacher('asgn-1', rpUser as any))
        .rejects.toThrow(BadRequestException);
    });

    it('propagates NotFoundException for unknown assignment', async () => {
      mockService.setMainTeacher.mockRejectedValue(new NotFoundException());
      await expect(controller.setMainTeacher('bad-id', rpUser as any))
        .rejects.toThrow(NotFoundException);
    });
  });

  // ── createTermination ───────────────────────────────────────────────────────

  describe('POST /:assignmentId/termination — createTermination', () => {
    const terminationDto = { noticeDate: '2026-09-01', reason: 'Personal reasons' };

    it('formateur requests termination — delegates correctly', async () => {
      mockService.createTermination.mockResolvedValue(baseTermination);
      const result = await controller.createTermination('asgn-1', terminationDto as any, teacherUser as any);
      expect(mockService.createTermination).toHaveBeenCalledWith('asgn-1', terminationDto, teacherUser);
      expect(result).toEqual(baseTermination);
    });

    it('propagates ForbiddenException for RP (wrong role)', async () => {
      mockService.createTermination.mockRejectedValue(new ForbiddenException());
      await expect(controller.createTermination('asgn-1', terminationDto as any, rpUser as any))
        .rejects.toThrow(ForbiddenException);
    });

    it("propagates ForbiddenException when formateur requests termination on another teacher's assignment", async () => {
      mockService.createTermination.mockRejectedValue(new ForbiddenException());
      const otherTeacher = { id: 'teacher-2', role: UserRole.FORMATEUR };
      await expect(controller.createTermination('asgn-1', terminationDto as any, otherTeacher as any))
        .rejects.toThrow(ForbiddenException);
    });

    it('propagates BadRequestException for inactive assignment (TRQ-FB-002)', async () => {
      mockService.createTermination.mockRejectedValue(new BadRequestException());
      await expect(controller.createTermination('asgn-1', terminationDto as any, teacherUser as any))
        .rejects.toThrow(BadRequestException);
    });

    it('propagates NotFoundException for unknown assignment', async () => {
      mockService.createTermination.mockRejectedValue(new NotFoundException());
      await expect(controller.createTermination('bad-id', terminationDto as any, teacherUser as any))
        .rejects.toThrow(NotFoundException);
    });
  });
});

// =============================================================================
// CollaborationController
// =============================================================================

describe('CollaborationController', () => {
  let controller: CollaborationController;
  let mockService: ReturnType<typeof makeMockService>;

  beforeEach(async () => {
    mockService = makeMockService();

    const moduleBuilder = Test.createTestingModule({
      controllers: [CollaborationController],
      providers: [
        { provide: TeacherRequestService, useValue: mockService },
        Reflector,
      ],
    });

    const module: TestingModule = await overrideJwtGuard(moduleBuilder).compile();
    controller = module.get(CollaborationController);
  });

  // ── JwtAuthGuard is applied ─────────────────────────────────────────────────

  describe('guard binding', () => {
    it('JwtAuthGuard is applied at controller level', () => {
      const guards = Reflect.getMetadata('__guards__', CollaborationController);
      const hasJwtGuard = guards?.some(
        (guard: any) => guard === JwtAuthGuard || guard?.name === 'JwtAuthGuard',
      );
      expect(hasJwtGuard).toBe(true);
    });
  });

  // ── createCollaborationStopRequest ──────────────────────────────────────────

  describe('POST /:assignmentId/stop-request — createCollaborationStopRequest', () => {
    const stopDto = { noticeDate: '2026-09-01', reason: 'Personal reasons' };

    it('formateur stops a collaboration — delegates to service.createCollaborationStopRequest', async () => {
      mockService.createCollaborationStopRequest.mockResolvedValue(baseTermination);
      const result = await controller.createCollaborationStopRequest('asgn-1', stopDto as any, teacherUser as any);
      expect(mockService.createCollaborationStopRequest).toHaveBeenCalledWith('asgn-1', stopDto, teacherUser);
      expect(result).toEqual(baseTermination);
    });

    it('propagates ForbiddenException for eleve', async () => {
      mockService.createCollaborationStopRequest.mockRejectedValue(new ForbiddenException());
      await expect(controller.createCollaborationStopRequest('asgn-1', stopDto as any, studentUser as any))
        .rejects.toThrow(ForbiddenException);
    });

    it('propagates ForbiddenException for RP', async () => {
      mockService.createCollaborationStopRequest.mockRejectedValue(new ForbiddenException());
      await expect(controller.createCollaborationStopRequest('asgn-1', stopDto as any, rpUser as any))
        .rejects.toThrow(ForbiddenException);
    });

    it("propagates ForbiddenException when formateur is not the assigned teacher", async () => {
      mockService.createCollaborationStopRequest.mockRejectedValue(new ForbiddenException());
      const otherTeacher = { id: 'teacher-2', role: UserRole.FORMATEUR };
      await expect(controller.createCollaborationStopRequest('asgn-1', stopDto as any, otherTeacher as any))
        .rejects.toThrow(ForbiddenException);
    });

    it('propagates BadRequestException for already-terminated assignment', async () => {
      mockService.createCollaborationStopRequest.mockRejectedValue(new BadRequestException());
      await expect(controller.createCollaborationStopRequest('asgn-1', stopDto as any, teacherUser as any))
        .rejects.toThrow(BadRequestException);
    });

    it('propagates NotFoundException for unknown assignment', async () => {
      mockService.createCollaborationStopRequest.mockRejectedValue(new NotFoundException());
      await expect(controller.createCollaborationStopRequest('bad-id', stopDto as any, teacherUser as any))
        .rejects.toThrow(NotFoundException);
    });
  });
});
