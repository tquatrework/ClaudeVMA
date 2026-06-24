import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';

import { TeacherRequestService } from './teacher-request.service';
import { CreateRequestDto } from './dto/create-request.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { CreateProposalDto } from './dto/create-proposal.dto';
import { CreateTerminationDto } from './dto/create-termination.dto';
import { CreatePpChangeDto } from './dto/create-pp-change.dto';
import { PublishSelectedCandidatesDto } from './dto/publish-selected-candidates.dto';
import { SelectCandidateDto } from './dto/select-candidate.dto';
import { JwtAuthGuard } from '../common/jwt.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { JwtPayload } from '../common/jwt.guard';

// ── /requests routes (Phase 1 CRUD + status transitions) ────────────────────
@ApiTags('requests')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('requests')
export class TeacherRequestController {
  constructor(private readonly service: TeacherRequestService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a teacher request',
    description: 'ELEVE, PARENT_FINANCEUR or RESPONSABLE_PEDAGOGIQUE creates a request for a teacher.',
  })
  @ApiResponse({ status: 201, description: 'Request created' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  createRequest(@Body() dto: CreateRequestDto, @CurrentUser() user: JwtPayload) {
    return this.service.createRequest(dto, user);
  }

  @Get()
  @ApiOperation({
    summary: 'List teacher requests',
    description:
      'ELEVE/PARENT: own requests. RESPONSABLE_PEDAGOGIQUE: all requests. FORMATEUR: proposals sent to them.',
  })
  @ApiResponse({ status: 200, description: 'List of requests or proposals' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  listRequests(@CurrentUser() user: JwtPayload) {
    return this.service.listRequests(user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single teacher request by id' })
  @ApiParam({ name: 'id', description: 'TeacherRequest UUID' })
  @ApiResponse({ status: 200, description: 'Request detail' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Not found' })
  getRequest(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.getRequest(id, user);
  }

  @Patch(':id/status')
  @ApiOperation({
    summary: 'Update request status',
    description: 'RESPONSABLE_PEDAGOGIQUE only. Allowed transitions: pending → accepted / declined / cancelled.',
  })
  @ApiParam({ name: 'id', description: 'TeacherRequest UUID' })
  @ApiResponse({ status: 200, description: 'Updated request' })
  @ApiResponse({ status: 400, description: 'Invalid status transition' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Not found' })
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateStatusDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.updateRequestStatus(id, dto.status, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a teacher request (RP only)' })
  @ApiParam({ name: 'id', description: 'TeacherRequest UUID' })
  @ApiResponse({ status: 204, description: 'Deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Not found' })
  deleteRequest(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.deleteRequest(id, user);
  }

  @Post('pp-change')
  @ApiOperation({
    summary: 'Request a principal teacher change (PARENT_FINANCEUR only)',
    description: 'PARENT_FINANCEUR requests a change of principal teacher for one of their linked students.',
  })
  @ApiResponse({ status: 201, description: 'PP change request created' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 403, description: 'Forbidden — only PARENT_FINANCEUR' })
  createPpChangeRequest(@Body() dto: CreatePpChangeDto, @CurrentUser() user: JwtPayload) {
    return this.service.createPpChangeRequest(dto, user);
  }

  @Post(':id/selected-candidates')
  @ApiOperation({
    summary: 'Publish selected teacher candidates to client (RP only)',
    description: 'RP selects from accepted proposals the teachers to present to the student/parent.',
  })
  @ApiParam({ name: 'id', description: 'TeacherRequest UUID' })
  @ApiResponse({ status: 201, description: 'Candidates published' })
  @ApiResponse({ status: 400, description: 'Invalid state or unknown teacher' })
  @ApiResponse({ status: 403, description: 'Forbidden — only RP' })
  @ApiResponse({ status: 404, description: 'Request not found' })
  publishSelectedCandidates(
    @Param('id') requestId: string,
    @Body() dto: PublishSelectedCandidatesDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.publishSelectedCandidates(requestId, dto, user);
  }

  @Post(':id/select')
  @ApiOperation({
    summary: 'Select a teacher candidate (ELEVE or PARENT_FINANCEUR)',
    description: 'Client chooses their preferred teacher from the published candidates.',
  })
  @ApiParam({ name: 'id', description: 'TeacherRequest UUID' })
  @ApiResponse({ status: 201, description: 'Candidate chosen' })
  @ApiResponse({ status: 400, description: 'Invalid state or proposal mismatch' })
  @ApiResponse({ status: 403, description: 'Forbidden — only ELEVE or PARENT_FINANCEUR' })
  @ApiResponse({ status: 404, description: 'Request or proposal not found' })
  selectCandidate(
    @Param('id') requestId: string,
    @Body() dto: SelectCandidateDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.selectCandidate(requestId, dto, user);
  }

  // ── Proposal sub-routes ───────────────────────────────────────────────────

  @Post(':requestId/proposals')
  @ApiTags('proposals')
  @ApiOperation({
    summary: 'Redirect request to a teacher (RP only)',
    description: 'RP creates a proposal targeting a specific teacher.',
  })
  @ApiParam({ name: 'requestId', description: 'TeacherRequest UUID' })
  @ApiResponse({ status: 201, description: 'Proposal created, request marked REDIRECTED' })
  @ApiResponse({ status: 403, description: 'Forbidden — only RP' })
  createProposal(
    @Param('requestId') requestId: string,
    @Body() dto: CreateProposalDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.createProposal(requestId, dto, user);
  }
}

// ── /proposals routes ────────────────────────────────────────────────────────
@ApiTags('proposals')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('proposals')
export class ProposalController {
  constructor(private readonly service: TeacherRequestService) {}

  @Post(':proposalId/accept')
  @ApiOperation({
    summary: 'Accept a proposal (FORMATEUR only)',
    description: 'Creates an assignment and marks proposal ACCEPTED.',
  })
  @ApiParam({ name: 'proposalId', description: 'TeacherProposal UUID' })
  @ApiResponse({ status: 201, description: 'Assignment created' })
  @ApiResponse({ status: 403, description: 'Forbidden — proposal not addressed to this teacher' })
  acceptProposal(@Param('proposalId') proposalId: string, @CurrentUser() user: JwtPayload) {
    return this.service.acceptProposal(proposalId, user);
  }

  @Post(':proposalId/decline')
  @ApiOperation({
    summary: 'Decline a proposal (FORMATEUR only)',
    description: 'Marks proposal DECLINED. Only the teacher the proposal was sent to can decline it.',
  })
  @ApiParam({ name: 'proposalId', description: 'TeacherProposal UUID' })
  @ApiResponse({ status: 201, description: 'Proposal declined' })
  @ApiResponse({ status: 400, description: 'Proposal is no longer pending' })
  @ApiResponse({ status: 403, description: 'Forbidden — proposal not addressed to this teacher' })
  @ApiResponse({ status: 404, description: 'Proposal not found' })
  declineProposal(@Param('proposalId') proposalId: string, @CurrentUser() user: JwtPayload) {
    return this.service.declineProposal(proposalId, user);
  }
}

// ── /collaborations routes ────────────────────────────────────────────────────
@ApiTags('collaborations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('collaborations')
export class CollaborationController {
  constructor(private readonly service: TeacherRequestService) {}

  @Post(':assignmentId/stop-request')
  @ApiOperation({
    summary: 'Request collaboration stop (FORMATEUR only)',
    description: 'Teacher requests to end an active collaboration with a notice date.',
  })
  @ApiParam({ name: 'assignmentId', description: 'Assignment UUID' })
  @ApiResponse({ status: 201, description: 'Stop request created' })
  @ApiResponse({ status: 400, description: 'Assignment is not active' })
  @ApiResponse({ status: 403, description: 'Forbidden — not the assigned teacher' })
  @ApiResponse({ status: 404, description: 'Assignment not found' })
  createCollaborationStopRequest(
    @Param('assignmentId') assignmentId: string,
    @Body() dto: CreateTerminationDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.createCollaborationStopRequest(assignmentId, dto, user);
  }
}

// ── /assignments routes ───────────────────────────────────────────────────────
@ApiTags('assignments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('assignments')
export class AssignmentController {
  constructor(private readonly service: TeacherRequestService) {}

  @Post(':assignmentId/main-teacher')
  @ApiOperation({
    summary: 'Designate main teacher',
    description: 'RP or ELEVE sets the main teacher for an assignment.',
  })
  @ApiParam({ name: 'assignmentId', description: 'Assignment UUID' })
  @ApiResponse({ status: 201, description: 'Main teacher flag set' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  setMainTeacher(@Param('assignmentId') assignmentId: string, @CurrentUser() user: JwtPayload) {
    return this.service.setMainTeacher(assignmentId, user);
  }

  @Post(':assignmentId/termination')
  @ApiOperation({
    summary: 'Request assignment termination (FORMATEUR only)',
    description: 'Teacher requests to end relation with a notice date.',
  })
  @ApiParam({ name: 'assignmentId', description: 'Assignment UUID' })
  @ApiResponse({ status: 201, description: 'Termination request created' })
  @ApiResponse({ status: 403, description: 'Forbidden — not the teacher on this assignment' })
  createTermination(
    @Param('assignmentId') assignmentId: string,
    @Body() dto: CreateTerminationDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.createTermination(assignmentId, dto, user);
  }
}
