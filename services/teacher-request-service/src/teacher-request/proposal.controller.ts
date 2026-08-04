import { Controller, Post, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';

import { TeacherRequestService } from './teacher-request.service';
import { AssignmentResponseDto } from './dto/response/assignment-response.dto';
import { TeacherProposalResponseDto } from './dto/response/teacher-proposal-response.dto';
import { JwtAuthGuard } from '../common/jwt.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentUser } from '../common/current-user.decorator';
import { JwtPayload } from '../common/jwt.guard';
import { UserRole } from '../common/user-role.enum';

// ── /proposals routes ────────────────────────────────────────────────────────
@ApiTags('proposals')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('proposals')
export class ProposalController {
  constructor(private readonly service: TeacherRequestService) {}

  @Post(':proposalId/accept')
  @Roles(UserRole.FORMATEUR)
  @ApiOperation({
    summary: 'Accept a proposal (FORMATEUR only)',
    description: 'Creates an assignment and marks proposal ACCEPTED.',
  })
  @ApiParam({ name: 'proposalId', description: 'TeacherProposal UUID' })
  @ApiResponse({ status: 201, description: 'Assignment created' })
  @ApiResponse({ status: 403, description: 'Forbidden — proposal not addressed to this teacher' })
  async acceptProposal(
    @Param('proposalId', ParseUUIDPipe) proposalId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<AssignmentResponseDto> {
    const assignment = await this.service.acceptProposal(proposalId, user);
    return AssignmentResponseDto.fromEntity(assignment);
  }

  @Post(':proposalId/decline')
  @Roles(UserRole.FORMATEUR)
  @ApiOperation({
    summary: 'Decline a proposal (FORMATEUR only)',
    description: 'Marks proposal DECLINED. Only the teacher the proposal was sent to can decline it.',
  })
  @ApiParam({ name: 'proposalId', description: 'TeacherProposal UUID' })
  @ApiResponse({ status: 201, description: 'Proposal declined' })
  @ApiResponse({ status: 400, description: 'Proposal is no longer pending' })
  @ApiResponse({ status: 403, description: 'Forbidden — proposal not addressed to this teacher' })
  @ApiResponse({ status: 404, description: 'Proposal not found' })
  async declineProposal(
    @Param('proposalId', ParseUUIDPipe) proposalId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<TeacherProposalResponseDto> {
    const declined = await this.service.declineProposal(proposalId, user);
    return TeacherProposalResponseDto.fromEntity(declined);
  }
}
