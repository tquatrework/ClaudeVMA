import { Controller, Get, Post, Patch, Delete, Body, Param, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';

import { TeacherRequestService } from './teacher-request.service';
import { CreateRequestDto } from './dto/create-request.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { CreateProposalDto } from './dto/create-proposal.dto';
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

  // ── Proposal sub-route (nested under a request) ──────────────────────────

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
