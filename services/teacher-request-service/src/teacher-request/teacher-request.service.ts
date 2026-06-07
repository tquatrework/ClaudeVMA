import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { TeacherRequest, RequestStatus } from './entities/teacher-request.entity';
import { TeacherProposal, ProposalStatus } from './entities/teacher-proposal.entity';
import { Assignment, AssignmentStatus } from './entities/assignment.entity';
import { TerminationRequest } from './entities/termination-request.entity';
import { CreateRequestDto } from './dto/create-request.dto';
import { CreateProposalDto } from './dto/create-proposal.dto';
import { CreateTerminationDto } from './dto/create-termination.dto';
import { EventsService } from './events.service';
import { JwtPayload } from '../common/jwt.guard';
import { UserRole } from '../common/user-role.enum';

@Injectable()
export class TeacherRequestService {
  constructor(
    @InjectRepository(TeacherRequest) private readonly requestRepo: Repository<TeacherRequest>,
    @InjectRepository(TeacherProposal) private readonly proposalRepo: Repository<TeacherProposal>,
    @InjectRepository(Assignment) private readonly assignmentRepo: Repository<Assignment>,
    @InjectRepository(TerminationRequest) private readonly terminationRepo: Repository<TerminationRequest>,
    private readonly events: EventsService,
  ) {}

  async createRequest(dto: CreateRequestDto, user: JwtPayload): Promise<TeacherRequest> {
    if (![UserRole.ELEVE, UserRole.PARENT_FINANCEUR].includes(user.role as UserRole)) {
      throw new ForbiddenException('Only students and parents can create teacher requests');
    }
    const studentId = user.role === UserRole.ELEVE ? user.id : dto.studentId;
    if (!studentId) {
      throw new BadRequestException('studentId is required when requester is PARENT_FINANCEUR');
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

  async listRequests(user: JwtPayload): Promise<TeacherRequest[] | TeacherProposal[]> {
    switch (user.role) {
      case UserRole.ELEVE:
        return this.requestRepo.find({ where: { studentId: user.id }, order: { createdAt: 'DESC' } });
      case UserRole.PARENT_FINANCEUR:
        return this.requestRepo.find({ where: { requesterId: user.id }, order: { createdAt: 'DESC' } });
      case UserRole.RESPONSABLE_PEDAGOGIQUE:
        return this.requestRepo.find({ order: { createdAt: 'DESC' } });
      case UserRole.FORMATEUR:
        // TRQ-FB-001: teacher sees only proposals redirected to them, not all requests
        return this.proposalRepo.find({ where: { teacherId: user.id }, order: { createdAt: 'DESC' } });
      default:
        throw new ForbiddenException('Access denied');
    }
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
}
