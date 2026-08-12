import { Controller, Get, Post, Body, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiHeader } from '@nestjs/swagger';

import { TeacherRequestService } from './teacher-request.service';
import { CreateProposalDto } from './dto/create-proposal.dto';
import { TeacherProposalResponseDto } from './dto/response/teacher-proposal-response.dto';
import { JwtAuthGuard } from '../common/jwt.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { Context, RequestContext } from '../common/request-context.decorator';
import { UserRole } from '../common/user-role.enum';
import { IdempotencyService } from '../idempotency/idempotency.service';

/**
 * Racine de ressource : les propositions rattachees a une demande
 * (`/requests/{requestId}/proposals`). Distincte de `/requests` et de
 * `/proposals` pour que chaque controleur garde une racine coherente.
 */
@ApiTags('proposals')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('requests/:requestId/proposals')
export class RequestProposalsController {
  constructor(
    private readonly service: TeacherRequestService,
    private readonly idempotency: IdempotencyService,
  ) {}

  @Post()
  @Roles(UserRole.RESPONSABLE_PEDAGOGIQUE)
  @ApiOperation({
    summary: 'Envoyer la proposition a des formateurs (RP uniquement)',
    description:
      'Le RP choisit ses formateurs et redige un texte, plus trois champs indicatifs optionnels : creneaux ' +
      "possibles, remuneration, date limite de reponse. L'envoi est atomique : tous les formateurs recoivent la " +
      "proposition, ou aucun.",
  })
  @ApiParam({ name: 'requestId', description: 'Identifiant de la demande' })
  @ApiHeader({ name: 'Idempotency-Key', required: false, description: 'Rejeu sans second envoi.' })
  @ApiResponse({ status: 201, description: 'Propositions envoyees', type: [TeacherProposalResponseDto] })
  @ApiResponse({ status: 400, description: 'Demande cloturee, ou formateur deja sollicite' })
  @ApiResponse({ status: 401, description: 'Jeton absent ou invalide' })
  @ApiResponse({ status: 403, description: 'Reserve au responsable pedagogique' })
  @ApiResponse({ status: 404, description: 'Demande inexistante' })
  async createProposals(
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @Body() dto: CreateProposalDto,
    @Context() context: RequestContext,
  ): Promise<TeacherProposalResponseDto[]> {
    return this.idempotency.runOnce(
      {
        idempotencyKey: context.idempotencyKey,
        endpoint: `POST /requests/${requestId}/proposals`,
        userId: context.user.id,
      },
      async () =>
        TeacherProposalResponseDto.fromEntities(await this.service.createProposals(requestId, dto, context)),
    );
  }

  @Get()
  @Roles(UserRole.RESPONSABLE_PEDAGOGIQUE)
  @ApiOperation({
    summary: 'Lire les reponses des formateurs (RP uniquement)',
    description:
      "Etape 5 du flow : le RP voit qui a accepte, qui a refuse et qui n'a pas repondu, avant de retenir un " +
      'formateur. Cette lecture n\'existait pas avant le 2026-08-12.',
  })
  @ApiParam({ name: 'requestId', description: 'Identifiant de la demande' })
  @ApiResponse({ status: 200, description: 'Propositions de la demande', type: [TeacherProposalResponseDto] })
  @ApiResponse({ status: 401, description: 'Jeton absent ou invalide' })
  @ApiResponse({ status: 403, description: 'Reserve au responsable pedagogique' })
  @ApiResponse({ status: 404, description: 'Demande inexistante' })
  async listProposals(
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @Context() context: RequestContext,
  ): Promise<TeacherProposalResponseDto[]> {
    return TeacherProposalResponseDto.fromEntities(
      await this.service.listProposalsOfRequest(requestId, context),
    );
  }
}
