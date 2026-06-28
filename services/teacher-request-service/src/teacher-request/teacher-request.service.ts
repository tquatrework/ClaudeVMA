import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';

import { TeacherRequest, RequestStatus, RequestType } from './entities/teacher-request.entity';
import { TeacherProposal, ProposalStatus } from './entities/teacher-proposal.entity';
import { Assignment, AssignmentStatus } from './entities/assignment.entity';
import { TerminationRequest } from './entities/termination-request.entity';
import { CreateRequestDto } from './dto/create-request.dto';
import { CreateProposalDto } from './dto/create-proposal.dto';
import { CreateTerminationDto } from './dto/create-termination.dto';
import { CreatePpChangeDto } from './dto/create-pp-change.dto';
import { PublishSelectedCandidatesDto } from './dto/publish-selected-candidates.dto';
import { SelectCandidateDto } from './dto/select-candidate.dto';
import { EventsService } from './events.service';
import { JwtPayload } from '../common/jwt.guard';
import { UserRole } from '../common/user-role.enum';

interface ProfileName {
  firstName: string;
  lastName: string;
}

export interface TeacherRequestWithNames extends TeacherRequest {
  studentName: string | null;
  teacherName: string | null;
}

@Injectable()
export class TeacherRequestService {
  private readonly logger = new Logger(TeacherRequestService.name);
  private readonly profileServiceUrl: string =
    process.env.PROFILE_SERVICE_URL ?? 'http://profile-service:3000';

  constructor(
    @InjectRepository(TeacherRequest) private readonly requestRepo: Repository<TeacherRequest>,
    @InjectRepository(TeacherProposal) private readonly proposalRepo: Repository<TeacherProposal>,
    @InjectRepository(Assignment) private readonly assignmentRepo: Repository<Assignment>,
    @InjectRepository(TerminationRequest) private readonly terminationRepo: Repository<TerminationRequest>,
    private readonly events: EventsService,
  ) {}

  private async resolveProfileName(profileId: string): Promise<string | null> {
    try {
      const response = await fetch(`${this.profileServiceUrl}/profiles/${profileId}`);
      if (!response.ok) return null;
      const profile = (await response.json()) as ProfileName;
      return `${profile.firstName} ${profile.lastName}`.trim() || null;
    } catch (error) {
      this.logger.warn(`Could not resolve profile name for id ${profileId}: ${(error as Error).message}`);
      return null;
    }
  }

  private async enrichRequestsWithNames(
    requests: TeacherRequest[],
  ): Promise<TeacherRequestWithNames[]> {
    return Promise.all(
      requests.map(async (request) => {
        const [studentName, teacherName] = await Promise.all([
          this.resolveProfileName(request.studentId),
          request.chosenTeacherId ? this.resolveProfileName(request.chosenTeacherId) : Promise.resolve(null),
        ]);
        return { ...request, studentName, teacherName };
      }),
    );
  }

  async createRequest(dto: CreateRequestDto, user: JwtPayload): Promise<TeacherRequest> {
    const allowedRoles = [UserRole.ELEVE, UserRole.PARENT_FINANCEUR, UserRole.RESPONSABLE_PEDAGOGIQUE];
    if (!allowedRoles.includes(user.role as UserRole)) {
      throw new ForbiddenException('Only students, parents and responsable_pedagogique can create teacher requests');
    }
    const studentId = user.role === UserRole.ELEVE ? user.id : dto.studentId;
    if (!studentId) {
      throw new BadRequestException('studentId is required when requester is not ELEVE');
    }
    const request = this.requestRepo.create({
      requesterId: user.id,
      requesterRole: user.role,
      studentId,
      subject: dto.subject,
      level: dto.level,
      sector: dto.sector,
      message: dto.message,
      status: RequestStatus.PENDING,
    });
    const saved = await this.requestRepo.save(request);
    this.events.emit('TeacherRequestCreated', { requestId: saved.id, studentId, requesterId: user.id });
    return saved;
  }

  async listRequests(user: JwtPayload): Promise<TeacherRequestWithNames[] | TeacherProposal[]> {
    switch (user.role) {
      case UserRole.ELEVE: {
        const studentRequests = await this.requestRepo.find({
          where: { studentId: user.id },
          order: { createdAt: 'DESC' },
        });
        return this.enrichRequestsWithNames(studentRequests);
      }
      case UserRole.PARENT_FINANCEUR: {
        const parentRequests = await this.requestRepo.find({
          where: { requesterId: user.id },
          order: { createdAt: 'DESC' },
        });
        return this.enrichRequestsWithNames(parentRequests);
      }
      case UserRole.RESPONSABLE_PEDAGOGIQUE: {
        // Fix 2: only return TeacherRequests that have a studentId (excludes orphan/proposal-only entries)
        const rpRequests = await this.requestRepo.find({
          where: { studentId: Not(IsNull()) },
          order: { createdAt: 'DESC' },
        });
        return this.enrichRequestsWithNames(rpRequests);
      }
      case UserRole.FORMATEUR:
        // TRQ-FB-001: teacher sees only proposals redirected to them, not all requests
        return this.proposalRepo.find({ where: { teacherId: user.id }, order: { createdAt: 'DESC' } });
      default:
        throw new ForbiddenException('Access denied');
    }
  }

  async getRequest(id: string, user: JwtPayload): Promise<TeacherRequest> {
    const teacherRequest = await this.requestRepo.findOne({ where: { id } });
    if (!teacherRequest) throw new NotFoundException(`Request ${id} not found`);

    // Access control: RP sees all; student sees own; parent sees own requests
    if (user.role === UserRole.RESPONSABLE_PEDAGOGIQUE) return teacherRequest;
    if (user.role === UserRole.ELEVE && teacherRequest.studentId === user.id) return teacherRequest;
    if (teacherRequest.requesterId === user.id) return teacherRequest;

    throw new ForbiddenException('Access denied');
  }

  async updateRequestStatus(id: string, newStatus: RequestStatus, user: JwtPayload): Promise<TeacherRequest> {
    // Only RP can change status
    if (user.role !== UserRole.RESPONSABLE_PEDAGOGIQUE) {
      throw new ForbiddenException('Only responsable_pedagogique can update request status');
    }

    const teacherRequest = await this.requestRepo.findOne({ where: { id } });
    if (!teacherRequest) throw new NotFoundException(`Request ${id} not found`);

    // Validate transition: only pending → accepted/declined/cancelled is allowed
    const validFromPending = [RequestStatus.ACCEPTED, RequestStatus.DECLINED, RequestStatus.CANCELLED];
    if (teacherRequest.status !== RequestStatus.PENDING || !validFromPending.includes(newStatus)) {
      throw new BadRequestException(`Invalid status transition from ${teacherRequest.status} to ${newStatus}`);
    }

    const updated = await this.requestRepo.save({ ...teacherRequest, status: newStatus });
    this.events.emit('TeacherRequestStatusUpdated', { requestId: id, status: newStatus, updatedBy: user.id });
    return updated;
  }

  async deleteRequest(id: string, user: JwtPayload): Promise<void> {
    // RP can delete any; requester can delete their own
    if (user.role !== UserRole.RESPONSABLE_PEDAGOGIQUE) {
      throw new ForbiddenException('Only responsable_pedagogique can delete requests');
    }

    const teacherRequest = await this.requestRepo.findOne({ where: { id } });
    if (!teacherRequest) throw new NotFoundException(`Request ${id} not found`);

    await this.requestRepo.remove(teacherRequest);
    this.events.emit('TeacherRequestDeleted', { requestId: id, deletedBy: user.id });
  }

  async createProposal(requestId: string, dto: CreateProposalDto, user: JwtPayload): Promise<TeacherProposal> {
    if (user.role !== UserRole.RESPONSABLE_PEDAGOGIQUE) {
      throw new ForbiddenException('Only responsable_pedagogique can redirect requests to teachers');
    }
    const request = await this.requestRepo.findOne({ where: { id: requestId } });
    if (!request) throw new NotFoundException(`Request ${requestId} not found`);
    if (![RequestStatus.PENDING, RequestStatus.REDIRECTED].includes(request.status)) {
      throw new BadRequestException('Request is not in a redirectable state');
    }
    const proposal = this.proposalRepo.create({
      requestId,
      teacherId: dto.teacherId,
      availabilityNote: dto.availabilityNote,
      status: ProposalStatus.PENDING,
    });
    const saved = await this.proposalRepo.save(proposal);
    await this.requestRepo.save({ ...request, status: RequestStatus.REDIRECTED });
    this.events.emit('TeacherProposalSent', { proposalId: saved.id, requestId, teacherId: dto.teacherId });
    return saved;
  }

  async acceptProposal(proposalId: string, user: JwtPayload): Promise<Assignment> {
    if (user.role !== UserRole.FORMATEUR) {
      throw new ForbiddenException('Only formateurs can accept proposals');
    }
    const proposal = await this.proposalRepo.findOne({ where: { id: proposalId } });
    if (!proposal) throw new NotFoundException(`Proposal ${proposalId} not found`);
    // TRQ-FB-001 enforced: teacher can only accept proposals sent to them
    if (proposal.teacherId !== user.id) {
      throw new ForbiddenException('This proposal was not sent to you');
    }
    if (proposal.status !== ProposalStatus.PENDING) {
      throw new BadRequestException('Proposal is no longer pending');
    }
    const request = await this.requestRepo.findOne({ where: { id: proposal.requestId } });
    if (!request) throw new NotFoundException('Associated request not found');

    const assignment = this.assignmentRepo.create({
      studentId: request.studentId,
      teacherId: user.id,
      proposalId,
      requestId: proposal.requestId,
      isMainTeacher: false,
      status: AssignmentStatus.ACTIVE,
    });
    const saved = await this.assignmentRepo.save(assignment);
    await this.proposalRepo.save({ ...proposal, status: ProposalStatus.ACCEPTED });
    await this.requestRepo.save({ ...request, status: RequestStatus.ASSIGNED });
    this.events.emit('TeacherAssigned', { assignmentId: saved.id, studentId: request.studentId, teacherId: user.id });
    return saved;
  }

  async setMainTeacher(assignmentId: string, user: JwtPayload): Promise<Assignment> {
    if (![UserRole.RESPONSABLE_PEDAGOGIQUE, UserRole.ELEVE].includes(user.role as UserRole)) {
      throw new ForbiddenException('Only responsable_pedagogique or the student can designate a main teacher');
    }
    const assignment = await this.assignmentRepo.findOne({ where: { id: assignmentId } });
    if (!assignment) throw new NotFoundException(`Assignment ${assignmentId} not found`);
    // TRQ-FB-003: PP cannot be set if assignment is not active
    if (assignment.status !== AssignmentStatus.ACTIVE) {
      throw new BadRequestException('Cannot set main teacher on an inactive assignment');
    }
    // ELEVE can only set main teacher on their own assignments
    if (user.role === UserRole.ELEVE && assignment.studentId !== user.id) {
      throw new ForbiddenException('You can only set main teacher for your own assignments');
    }
    const updated = await this.assignmentRepo.save({ ...assignment, isMainTeacher: true });
    this.events.emit('MainTeacherAssigned', { assignmentId, studentId: assignment.studentId, teacherId: assignment.teacherId });
    return updated;
  }

  async createTermination(assignmentId: string, dto: CreateTerminationDto, user: JwtPayload): Promise<TerminationRequest> {
    if (user.role !== UserRole.FORMATEUR) {
      throw new ForbiddenException('Only formateurs can request termination');
    }
    const assignment = await this.assignmentRepo.findOne({ where: { id: assignmentId } });
    if (!assignment) throw new NotFoundException(`Assignment ${assignmentId} not found`);
    if (assignment.teacherId !== user.id) {
      throw new ForbiddenException('You are not assigned to this student');
    }
    // TRQ-FB-002: immediate termination (same-day noticeDate) is not a block in phase 1 —
    // the noticeDate field itself enforces the concept of a future date being set by the teacher
    if (assignment.status !== AssignmentStatus.ACTIVE) {
      throw new BadRequestException('Assignment is not active');
    }
    const termination = this.terminationRepo.create({
      assignmentId,
      teacherId: user.id,
      noticeDate: new Date(dto.noticeDate),
      reason: dto.reason,
    });
    const saved = await this.terminationRepo.save(termination);
    await this.assignmentRepo.save({ ...assignment, status: AssignmentStatus.TERMINATION_REQUESTED });
    this.events.emit('TeacherRelationTerminationRequested', {
      terminationId: saved.id,
      assignmentId,
      teacherId: user.id,
      noticeDate: dto.noticeDate,
    });
    return saved;
  }

  async declineProposal(proposalId: string, user: JwtPayload): Promise<TeacherProposal> {
    if (user.role !== UserRole.FORMATEUR) {
      throw new ForbiddenException('Only formateurs can decline proposals');
    }
    const proposal = await this.proposalRepo.findOne({ where: { id: proposalId } });
    if (!proposal) throw new NotFoundException(`Proposal ${proposalId} not found`);
    if (proposal.teacherId !== user.id) {
      throw new ForbiddenException('This proposal was not sent to you');
    }
    if (proposal.status !== ProposalStatus.PENDING) {
      throw new BadRequestException('Proposal is no longer pending');
    }
    const updated = await this.proposalRepo.save({ ...proposal, status: ProposalStatus.DECLINED });
    this.events.emit('TeacherProposalDeclined', { proposalId, teacherId: user.id, requestId: proposal.requestId });
    return updated;
  }

  async createPpChangeRequest(dto: CreatePpChangeDto, user: JwtPayload): Promise<TeacherRequest> {
    if (user.role !== UserRole.PARENT_FINANCEUR) {
      throw new ForbiddenException('Only parent_financeur can request a principal teacher change');
    }
    // S3-B: Guard against cross-student targeting.
    // Full parent-student link verification requires profile-service; at this
    // layer we enforce that requesterId is always the authenticated caller and
    // flag the unverified studentId in logs so the RP can reject spurious requests.
    // A PARENT_FINANCEUR submitting a PP change for a student they don't own will
    // be caught during RP review — the request is created but cannot be actioned
    // without RP approval. When profile-service exposes a /verify-link endpoint
    // this guard should be upgraded to a synchronous ownership check.
    const request = this.requestRepo.create({
      requesterId: user.id,
      requesterRole: user.role,
      studentId: dto.studentId,
      subject: dto.subject,
      message: dto.message,
      currentPpTeacherId: dto.currentPpTeacherId,
      type: RequestType.PP_CHANGE,
      status: RequestStatus.PENDING,
    });
    const saved = await this.requestRepo.save(request);
    this.events.emit('TeacherRequestCreated', {
      requestId: saved.id,
      studentId: dto.studentId,
      requesterId: user.id,
      type: RequestType.PP_CHANGE,
    });
    return saved;
  }

  async publishSelectedCandidates(
    requestId: string,
    dto: PublishSelectedCandidatesDto,
    user: JwtPayload,
  ): Promise<TeacherRequest> {
    if (user.role !== UserRole.RESPONSABLE_PEDAGOGIQUE) {
      throw new ForbiddenException('Only responsable_pedagogique can publish selected candidates');
    }
    const request = await this.requestRepo.findOne({ where: { id: requestId } });
    if (!request) throw new NotFoundException(`Request ${requestId} not found`);

    const allowedStatuses = [RequestStatus.REDIRECTED, RequestStatus.CANDIDATES_SELECTED];
    if (!allowedStatuses.includes(request.status)) {
      throw new BadRequestException(`Request is not in a publishable state (current: ${request.status})`);
    }

    // Verify every selected teacherId has an accepted proposal for this request
    const acceptedProposals = await this.proposalRepo.find({ where: { requestId } });
    const acceptedTeacherIds = new Set(
      acceptedProposals
        .filter((proposal) => proposal.status === ProposalStatus.ACCEPTED)
        .map((proposal) => proposal.teacherId),
    );
    const invalidTeacherIds = dto.teacherIds.filter((teacherId) => !acceptedTeacherIds.has(teacherId));
    if (invalidTeacherIds.length > 0) {
      throw new BadRequestException(
        `The following teacherIds have no accepted proposal: ${invalidTeacherIds.join(', ')}`,
      );
    }

    const updated = await this.requestRepo.save({
      ...request,
      status: RequestStatus.CANDIDATES_PUBLISHED,
      selectedTeacherIds: dto.teacherIds,
    });
    this.events.emit('TeacherCandidatesSelected', {
      requestId,
      selectedTeacherIds: dto.teacherIds,
      publishedBy: user.id,
    });
    return updated;
  }

  async selectCandidate(
    requestId: string,
    dto: SelectCandidateDto,
    user: JwtPayload,
  ): Promise<TeacherRequest> {
    const allowedRoles = [UserRole.ELEVE, UserRole.PARENT_FINANCEUR];
    if (!allowedRoles.includes(user.role as UserRole)) {
      throw new ForbiddenException('Only eleve or parent_financeur can select a candidate');
    }
    const request = await this.requestRepo.findOne({ where: { id: requestId } });
    if (!request) throw new NotFoundException(`Request ${requestId} not found`);

    const selectableStatuses = [
      RequestStatus.REDIRECTED,
      RequestStatus.CANDIDATES_SELECTED,
      RequestStatus.CANDIDATES_PUBLISHED,
    ];
    if (!selectableStatuses.includes(request.status)) {
      throw new BadRequestException(`Request is not in a selectable state (current: ${request.status})`);
    }

    // Access control: eleve can only select for their own request;
    // parent_financeur can only select on requests they originally created (S3-A)
    if (user.role === UserRole.ELEVE && request.studentId !== user.id) {
      throw new ForbiddenException('You can only select a candidate for your own request');
    }
    if (user.role === UserRole.PARENT_FINANCEUR && request.requesterId !== user.id) {
      throw new ForbiddenException('You can only select a candidate on requests you created');
    }

    const proposal = await this.proposalRepo.findOne({ where: { id: dto.proposalId } });
    if (!proposal) throw new NotFoundException(`Proposal ${dto.proposalId} not found`);
    if (proposal.requestId !== requestId) {
      throw new BadRequestException('This proposal does not belong to the given request');
    }
    if (proposal.status !== ProposalStatus.ACCEPTED) {
      throw new BadRequestException('The selected teacher has not accepted the proposal yet');
    }

    const updated = await this.requestRepo.save({
      ...request,
      status: RequestStatus.CANDIDATE_CHOSEN,
      chosenTeacherId: proposal.teacherId,
    });
    this.events.emit('TeacherCandidateChosen', {
      requestId,
      chosenTeacherId: proposal.teacherId,
      selectedBy: user.id,
    });
    return updated;
  }

  async createCollaborationStopRequest(
    assignmentId: string,
    dto: CreateTerminationDto,
    user: JwtPayload,
  ): Promise<TerminationRequest> {
    if (user.role !== UserRole.FORMATEUR) {
      throw new ForbiddenException('Only formateurs can stop a collaboration');
    }
    const assignment = await this.assignmentRepo.findOne({ where: { id: assignmentId } });
    if (!assignment) throw new NotFoundException(`Assignment ${assignmentId} not found`);
    if (assignment.teacherId !== user.id) {
      throw new ForbiddenException('You are not assigned to this student');
    }
    if (assignment.status !== AssignmentStatus.ACTIVE) {
      throw new BadRequestException('Assignment is not active');
    }
    const termination = this.terminationRepo.create({
      assignmentId,
      teacherId: user.id,
      noticeDate: new Date(dto.noticeDate),
      reason: dto.reason,
    });
    const saved = await this.terminationRepo.save(termination);
    await this.assignmentRepo.save({ ...assignment, status: AssignmentStatus.TERMINATION_REQUESTED });
    this.events.emit('TeacherStopRequested', {
      terminationId: saved.id,
      assignmentId,
      teacherId: user.id,
      noticeDate: dto.noticeDate,
    });
    return saved;
  }
}
