import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';

import { TeacherRequestService, TeacherRequestWithNames } from './teacher-request.service';
import { CreateRequestDto } from './dto/create-request.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { CreatePpChangeDto } from './dto/create-pp-change.dto';
import { PublishSelectedCandidatesDto } from './dto/publish-selected-candidates.dto';
import { SelectCandidateDto } from './dto/select-candidate.dto';
import { TeacherRequestResponseDto } from './dto/response/teacher-request-response.dto';
import { TeacherProposalResponseDto } from './dto/response/teacher-proposal-response.dto';
import { TeacherProposal } from './entities/teacher-proposal.entity';
import { JwtAuthGuard } from '../common/jwt.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentUser } from '../common/current-user.decorator';
import { JwtPayload } from '../common/jwt.guard';
import { UserRole } from '../common/user-role.enum';

// ── /requests routes (Phase 1 CRUD + status transitions) ────────────────────
@ApiTags('requests')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('requests')
export class TeacherRequestController {
  constructor(private readonly service: TeacherRequestService) {}

  @Post()
  @Roles(UserRole.ELEVE, UserRole.PARENT_FINANCEUR, UserRole.RESPONSABLE_PEDAGOGIQUE)
  @ApiOperation({
    summary: 'Create a teacher request',
    description: 'ELEVE, PARENT_FINANCEUR or RESPONSABLE_PEDAGOGIQUE creates a request for a teacher.',
  })
  @ApiResponse({ status: 201, description: 'Request created' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async createRequest(
    @Body() dto: CreateRequestDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<TeacherRequestResponseDto> {
    const created = await this.service.createRequest(dto, user);
    return TeacherRequestResponseDto.fromEntity(created);
  }

  @Get()
  @Roles(UserRole.ELEVE, UserRole.PARENT_FINANCEUR, UserRole.RESPONSABLE_PEDAGOGIQUE, UserRole.FORMATEUR)
  @ApiOperation({
    summary: 'List teacher requests',
    description:
      'ELEVE/PARENT: own requests. RESPONSABLE_PEDAGOGIQUE: all requests. FORMATEUR: proposals sent to them.',
  })
  @ApiResponse({ status: 200, description: 'List of requests or proposals' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async listRequests(
    @CurrentUser() user: JwtPayload,
  ): Promise<(TeacherRequestResponseDto | TeacherProposalResponseDto)[]> {
    const results = await this.service.listRequests(user);
    if (results.length === 0) return [];
    return 'requestId' in results[0]
      ? TeacherProposalResponseDto.fromEntities(results as TeacherProposal[])
      : TeacherRequestResponseDto.fromEntities(results as TeacherRequestWithNames[]);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single teacher request by id' })
  @ApiParam({ name: 'id', description: 'TeacherRequest UUID' })
  @ApiResponse({ status: 200, description: 'Request detail' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async getRequest(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<TeacherRequestResponseDto> {
    const found = await this.service.getRequest(id, user);
    return TeacherRequestResponseDto.fromEntity(found);
  }

  @Patch(':id/status')
  @Roles(UserRole.RESPONSABLE_PEDAGOGIQUE)
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
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStatusDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<TeacherRequestResponseDto> {
    const updated = await this.service.updateRequestStatus(id, dto.status, user);
    return TeacherRequestResponseDto.fromEntity(updated);
  }

  @Delete(':id')
  @Roles(UserRole.RESPONSABLE_PEDAGOGIQUE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a teacher request (RP only)' })
  @ApiParam({ name: 'id', description: 'TeacherRequest UUID' })
  @ApiResponse({ status: 204, description: 'Deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async deleteRequest(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload): Promise<void> {
    await this.service.deleteRequest(id, user);
  }

  @Post('pp-change')
  @Roles(UserRole.PARENT_FINANCEUR)
  @ApiOperation({
    summary: 'Request a principal teacher change (PARENT_FINANCEUR only)',
    description: 'PARENT_FINANCEUR requests a change of principal teacher for one of their linked students.',
  })
  @ApiResponse({ status: 201, description: 'PP change request created' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 403, description: 'Forbidden — only PARENT_FINANCEUR' })
  async createPpChangeRequest(
    @Body() dto: CreatePpChangeDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<TeacherRequestResponseDto> {
    const created = await this.service.createPpChangeRequest(dto, user);
    return TeacherRequestResponseDto.fromEntity(created);
  }

  @Post(':id/selected-candidates')
  @Roles(UserRole.RESPONSABLE_PEDAGOGIQUE)
  @ApiOperation({
    summary: 'Publish selected teacher candidates to client (RP only)',
    description: 'RP selects from accepted proposals the teachers to present to the student/parent.',
  })
  @ApiParam({ name: 'id', description: 'TeacherRequest UUID' })
  @ApiResponse({ status: 201, description: 'Candidates published' })
  @ApiResponse({ status: 400, description: 'Invalid state or unknown teacher' })
  @ApiResponse({ status: 403, description: 'Forbidden — only RP' })
  @ApiResponse({ status: 404, description: 'Request not found' })
  async publishSelectedCandidates(
    @Param('id', ParseUUIDPipe) requestId: string,
    @Body() dto: PublishSelectedCandidatesDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<TeacherRequestResponseDto> {
    const updated = await this.service.publishSelectedCandidates(requestId, dto, user);
    return TeacherRequestResponseDto.fromEntity(updated);
  }

  @Post(':id/select')
  @Roles(UserRole.ELEVE, UserRole.PARENT_FINANCEUR)
  @ApiOperation({
    summary: 'Select a teacher candidate (ELEVE or PARENT_FINANCEUR)',
    description: 'Client chooses their preferred teacher from the published candidates.',
  })
  @ApiParam({ name: 'id', description: 'TeacherRequest UUID' })
  @ApiResponse({ status: 201, description: 'Candidate chosen' })
  @ApiResponse({ status: 400, description: 'Invalid state or proposal mismatch' })
  @ApiResponse({ status: 403, description: 'Forbidden — only ELEVE or PARENT_FINANCEUR' })
  @ApiResponse({ status: 404, description: 'Request or proposal not found' })
  async selectCandidate(
    @Param('id', ParseUUIDPipe) requestId: string,
    @Body() dto: SelectCandidateDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<TeacherRequestResponseDto> {
    const updated = await this.service.selectCandidate(requestId, dto, user);
    return TeacherRequestResponseDto.fromEntity(updated);
  }
}
