import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';

import { TeacherRequestService } from './teacher-request.service';
import { CreateRequestDto } from './dto/create-request.dto';
import { CreateProposalDto } from './dto/create-proposal.dto';
import { CreateTerminationDto } from './dto/create-termination.dto';
import { JwtAuthGuard } from '../common/jwt.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { JwtPayload } from '../common/jwt.guard';

@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class TeacherRequestController {
  constructor(private readonly service: TeacherRequestService) {}

  // ── Teacher requests ──────────────────────────────────────────────────────

  @Post('teacher-requests')
  @ApiTags('teacher-requests')
  @ApiOperation({ summary: 'Create a teacher request', description: 'STUDENT or PARENT creates a request for a teacher' })
  @ApiResponse({ status: 201, description: 'Request created' })
  @ApiResponse({ status: 403, description: 'Forbidden — only STUDENT/PARENT' })
  createRequest(@Body() dto: CreateRequestDto, @CurrentUser() user: JwtPayload) {
    return this.service.createRequest(dto, user);
  }

  @Get('teacher-requests')
  @ApiTags('teacher-requests')
  @ApiOperation({
    summary: 'List teacher requests',
    description: 'STUDENT/PARENT: own requests. RP: all requests. TEACHER: proposals sent to them.',
  })
  @ApiResponse({ status: 200, description: 'Requests or proposals list' })
  listRequests(@CurrentUser() user: JwtPayload) {
    return this.service.listRequests(user);
  }

  @Post('teacher-requests/:requestId/proposals')
  @ApiTags('teacher-requests')
  @ApiOperation({ summary: 'Redirect request to a teacher (RP only)', description: 'RP creates a proposal targeting a specific teacher' })
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

  // ── Proposals ─────────────────────────────────────────────────────────────

  @Post('proposals/:proposalId/accept')
  @ApiTags('proposals')
  @ApiOperation({ summary: 'Accept a proposal (TEACHER only)', description: 'Creates an assignment and marks proposal ACCEPTED' })
  @ApiParam({ name: 'proposalId', description: 'TeacherProposal UUID' })
  @ApiResponse({ status: 201, description: 'Assignment created' })
  @ApiResponse({ status: 403, description: 'Forbidden — proposal not addressed to this teacher' })
  acceptProposal(@Param('proposalId') proposalId: string, @CurrentUser() user: JwtPayload) {
    return this.service.acceptProposal(proposalId, user);
  }

  // ── Assignments ───────────────────────────────────────────────────────────

  @Post('assignments/:assignmentId/main-teacher')
  @ApiTags('assignments')
  @ApiOperation({ summary: 'Designate main teacher', description: 'RP or STUDENT sets the main teacher for an assignment (TRQ-BR-006)' })
  @ApiParam({ name: 'assignmentId', description: 'Assignment UUID' })
  @ApiResponse({ status: 201, description: 'Main teacher flag set' })
  @ApiResponse({ status: 403, description: 'Forbidden or assignment not linked to student' })
  setMainTeacher(@Param('assignmentId') assignmentId: string, @CurrentUser() user: JwtPayload) {
    return this.service.setMainTeacher(assignmentId, user);
  }

  @Post('assignments/:assignmentId/termination')
  @ApiTags('assignments')
  @ApiOperation({ summary: 'Request assignment termination (TEACHER only)', description: 'Teacher requests to end relation with a notice date (TRQ-BR-005)' })
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
