import { Controller, Post, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';

import { TeacherRequestService } from './teacher-request.service';
import { JwtAuthGuard } from '../common/jwt.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { JwtPayload } from '../common/jwt.guard';

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
