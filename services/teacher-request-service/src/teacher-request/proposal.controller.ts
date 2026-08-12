import { Controller, Post, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';

import { TeacherRequestService } from './teacher-request.service';
import { TeacherProposalInboxDto } from './dto/response/teacher-proposal-inbox.dto';
import { JwtAuthGuard } from '../common/jwt.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { Context, RequestContext } from '../common/request-context.decorator';
import { UserRole } from '../common/user-role.enum';

// ── /proposals ───────────────────────────────────────────────────────────────
@ApiTags('proposals')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('proposals')
export class ProposalController {
  constructor(private readonly service: TeacherRequestService) {}

  @Post(':proposalId/accept')
  @Roles(UserRole.FORMATEUR)
  @ApiOperation({
    summary: 'Se porter candidat (formateur uniquement)',
    description:
      "Enregistre une CANDIDATURE, et rien d'autre : aucune affectation n'est creee ici. C'est le RP, et lui " +
      'seul, qui retient un candidat (`POST /requests/:id/validate`). Avant le 2026-08-12, cette route creait ' +
      'immediatement une affectation, au point que deux formateurs acceptant produisaient deux affectations ' +
      'actives sur le meme eleve.',
  })
  @ApiParam({ name: 'proposalId', description: 'Identifiant de la proposition' })
  @ApiResponse({ status: 201, description: 'Candidature enregistree', type: TeacherProposalInboxDto })
  @ApiResponse({ status: 400, description: 'Reponse deja donnee, ou demande cloturee' })
  @ApiResponse({ status: 401, description: 'Jeton absent ou invalide' })
  @ApiResponse({ status: 403, description: 'Reserve aux formateurs' })
  @ApiResponse({ status: 404, description: 'Proposition inexistante ou adressee a un autre formateur' })
  async acceptProposal(
    @Param('proposalId', ParseUUIDPipe) proposalId: string,
    @Context() context: RequestContext,
  ): Promise<TeacherProposalInboxDto> {
    return TeacherProposalInboxDto.fromEntity(await this.service.acceptProposal(proposalId, context));
  }

  @Post(':proposalId/decline')
  @Roles(UserRole.FORMATEUR)
  @ApiOperation({
    summary: 'Refuser une proposition (formateur uniquement)',
    description:
      "« Refusee » veut dire que le formateur a refuse. Ne pas confondre avec « caduque » (jamais repondue) " +
      'ni « non retenue » (avait accepte, un autre a ete choisi).',
  })
  @ApiParam({ name: 'proposalId', description: 'Identifiant de la proposition' })
  @ApiResponse({ status: 201, description: 'Refus enregistre', type: TeacherProposalInboxDto })
  @ApiResponse({ status: 400, description: 'Reponse deja donnee, ou demande cloturee' })
  @ApiResponse({ status: 401, description: 'Jeton absent ou invalide' })
  @ApiResponse({ status: 403, description: 'Reserve aux formateurs' })
  @ApiResponse({ status: 404, description: 'Proposition inexistante ou adressee a un autre formateur' })
  async declineProposal(
    @Param('proposalId', ParseUUIDPipe) proposalId: string,
    @Context() context: RequestContext,
  ): Promise<TeacherProposalInboxDto> {
    return TeacherProposalInboxDto.fromEntity(await this.service.declineProposal(proposalId, context));
  }
}
