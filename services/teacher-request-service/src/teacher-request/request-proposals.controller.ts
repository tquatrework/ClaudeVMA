import { Controller, Post, Body, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';

import { TeacherRequestService } from './teacher-request.service';
import { CreateProposalDto } from './dto/create-proposal.dto';
import { TeacherProposalResponseDto } from './dto/response/teacher-proposal-response.dto';
import { JwtAuthGuard } from '../common/jwt.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentUser } from '../common/current-user.decorator';
import { JwtPayload } from '../common/jwt.guard';
import { UserRole } from '../common/user-role.enum';

/**
 * Resource root: proposals created under a teacher request
 * (`/requests/{requestId}/proposals`). Kept separate from
 * TeacherRequestController (`/requests`) and ProposalController
 * (`/proposals`) so each controller keeps a single, coherent resource root.
 */
@ApiTags('proposals')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('requests/:requestId/proposals')
export class RequestProposalsController {
  constructor(private readonly service: TeacherRequestService) {}

  @Post()
  @Roles(UserRole.RESPONSABLE_PEDAGOGIQUE)
  @ApiOperation({
    summary: 'Redirect request to a teacher (RP only)',
    description: 'RP creates a proposal targeting a specific teacher.',
  })
  @ApiParam({ name: 'requestId', description: 'TeacherRequest UUID' })
  @ApiResponse({ status: 201, description: 'Proposal created, request marked REDIRECTED' })
  @ApiResponse({ status: 403, description: 'Forbidden — only RP' })
  async createProposal(
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @Body() dto: CreateProposalDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<TeacherProposalResponseDto> {
    const created = await this.service.createProposal(requestId, dto, user);
    return TeacherProposalResponseDto.fromEntity(created);
  }
}
