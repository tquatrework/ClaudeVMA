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
import { CreatePpChangeDto } from './dto/create-pp-change.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { CreateProposalDto } from './dto/create-proposal.dto';
import { CreateTerminationDto } from './dto/create-termination.dto';
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
    summary: 'Create a specific teacher request',
    description: 'ELEVE, PARENT_FINANCEUR or RESPONSABLE_PEDAGOGIQUE creates a specific request for a teacher.',
  })
  @ApiResponse({ status: 201, description: 'Request created' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  createRequest(@Body() dto: CreateRequestDto, @CurrentUser() user: JwtPayload) {
    return this.service.createRequest(dto, user);
  }

  @Post('pp-change')
  @ApiOperation({
    summary: 'Request a principal teacher (PP) change',
    description: 'PARENT_FINANCEUR only. Creates a request to change the principal teacher for a student.',
  })
  @ApiResponse({ status: 201, description: 'PP change request created' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — only parent_financeur' })
  createPpChangeRequest(@Body() dto: CreatePpChangeDto, @CurrentUser() user: JwtPayload) {
    return this.service.createPpChangeRequest(dto, user);
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

  @Post(':id/select')
  @ApiOperation({
    summary: 'Select the final candidate for a request',
    description:
      'ELEVE or PARENT_FINANCEUR chooses the final teacher from accepted proposals. Emits TeacherCandidateChosen.',
  })
  @ApiParam({ name: 'id', description: 'TeacherRequest UUID' })
  @ApiResponse({ status: 201, description: 'Candidate chosen, request marked CANDIDATE_CHOSEN' })
  @ApiResponse({ status: 400, description: 'Invalid state or proposal mismatch' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — only eleve or parent_financeur' })
  @ApiResponse({ status: 404, description: 'Not found' })
  selectCandidate(
    @Param('id') requestId: string,
    @Body() dto: SelectCandidateDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.selectCandidate(requestId, dto, user);
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
  @ApiResponse({ status: 400, description: 'Proposal is not pending' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — proposal not addressed to this teacher' })
  @ApiResponse({ status: 404, description: 'Not found' })
  acceptProposal(@Param('proposalId') proposalId: string, @CurrentUser() user: JwtPayload) {
    return this.service.acceptProposal(proposalId, user);
  }

  @Post(':proposalId/decline')
  @ApiOperation({
    summary: 'Decline a proposal (FORMATEUR only)',
    description: 'Marks the proposal as DECLINED. The RP can then redirect to another teacher.',
  })
  @ApiParam({ name: 'proposalId', description: 'TeacherProposal UUID' })
  @ApiResponse({ status: 201, description: 'Proposal declined' })
  @ApiResponse({ status: 400, description: 'Proposal is not pending' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — proposal not addressed to this teacher' })
  @ApiResponse({ status: 404, description: 'Not found' })
  declineProposal(@Param('proposalId') proposalId: string, @CurrentUser() user: JwtPayload) {
    return this.service.declineProposal(proposalId, user);
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
    description: 'Teacher requests to end relation with a notice date. Emits TeacherStopRequested.',
  })
  @ApiParam({ name: 'assignmentId', description: 'Assignment UUID' })
  @ApiResponse({ status: 201, description: 'Termination request created' })
  @ApiResponse({ status: 400, description: 'Assignment is not active' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — not the teacher on this assignment' })
  @ApiResponse({ status: 404, description: 'Not found' })
  createTermination(
    @Param('assignmentId') assignmentId: string,
    @Body() dto: CreateTerminationDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.createTermination(assignmentId, dto, user);
  }
}

// ── /collaborations routes — alias for stop-request per XML spec ──────────────
@ApiTags('collaborations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('collaborations')
export class CollaborationController {
  constructor(private readonly service: TeacherRequestService) {}

  @Post(':assignmentId/stop-request')
  @ApiOperation({
    summary: 'Request collaboration stop (FORMATEUR only)',
    description:
      'Alias of POST /assignments/:id/termination. Formateur requests to end collaboration with notice date. ' +
      'Emits TeacherStopRequested.',
  })
  @ApiParam({ name: 'assignmentId', description: 'Assignment UUID' })
  @ApiResponse({ status: 201, description: 'Stop request created' })
  @ApiResponse({ status: 400, description: 'Assignment is not active' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — only formateur assigned to this student' })
  @ApiResponse({ status: 404, description: 'Not found' })
  createCollaborationStopRequest(
    @Param('assignmentId') assignmentId: string,
    @Body() dto: CreateTerminationDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.createCollaborationStopRequest(assignmentId, dto, user);
  }
}
