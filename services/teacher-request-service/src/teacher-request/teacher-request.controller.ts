import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  Query,
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
  ApiQuery,
  ApiHeader,
  ApiExtraModels,
} from '@nestjs/swagger';

import { RequestScope, TeacherRequestService } from './teacher-request.service';
import { CreateRequestDto } from './dto/create-request.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { CreatePpChangeDto } from './dto/create-pp-change.dto';
import { ValidateCandidateDto } from './dto/validate-candidate.dto';
import { TeacherRequestResponseDto } from './dto/response/teacher-request-response.dto';
import { TeacherProposalInboxDto } from './dto/response/teacher-proposal-inbox.dto';
import { JwtAuthGuard } from '../common/jwt.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { Context, RequestContext } from '../common/request-context.decorator';
import { UserRole } from '../common/user-role.enum';
import { IdempotencyService } from '../idempotency/idempotency.service';

const IDEMPOTENCY_HEADER_DOC = {
  name: 'Idempotency-Key',
  required: false,
  description:
    "Rejouer la commande avec la meme cle renvoie la premiere reponse au lieu d'en creer une seconde.",
};

// ── /requests ────────────────────────────────────────────────────────────────
@ApiTags('requests')
@ApiBearerAuth()
@ApiExtraModels(TeacherRequestResponseDto, TeacherProposalInboxDto)
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('requests')
export class TeacherRequestController {
  constructor(
    private readonly service: TeacherRequestService,
    private readonly idempotency: IdempotencyService,
  ) {}

  @Post()
  @Roles(UserRole.ELEVE, UserRole.PARENT_FINANCEUR, UserRole.RESPONSABLE_PEDAGOGIQUE)
  @ApiOperation({
    summary: 'Creer une demande de professeur',
    description:
      "Un seul champ de saisie : `description`. Un parent ou un RP precise en plus `studentId` ; " +
      "le lien avec l'eleve est verifie a chaque appel aupres de profile-service.",
  })
  @ApiHeader(IDEMPOTENCY_HEADER_DOC)
  @ApiResponse({ status: 201, description: 'Demande creee', type: TeacherRequestResponseDto })
  @ApiResponse({ status: 400, description: 'Corps invalide, ou champ inconnu envoye' })
  @ApiResponse({ status: 401, description: 'Jeton absent ou invalide' })
  @ApiResponse({ status: 403, description: 'Role sans droit de creer une demande' })
  @ApiResponse({ status: 404, description: "Eleve inconnu, ou aucun lien avec l'appelant" })
  @ApiResponse({ status: 503, description: 'profile-service injoignable : droits non verifiables' })
  async createRequest(
    @Body() dto: CreateRequestDto,
    @Context() context: RequestContext,
  ): Promise<TeacherRequestResponseDto> {
    return this.idempotency.runOnce(
      { idempotencyKey: context.idempotencyKey, endpoint: 'POST /requests', userId: context.user.id },
      async () => TeacherRequestResponseDto.fromEntity(await this.service.createRequest(dto, context)),
    );
  }

  @Get()
  @Roles(UserRole.ELEVE, UserRole.PARENT_FINANCEUR, UserRole.RESPONSABLE_PEDAGOGIQUE, UserRole.FORMATEUR)
  @ApiOperation({
    summary: 'Lister les demandes de professeur',
    description:
      "Eleve : ses demandes. Parent : celles qu'il a creees, pour les eleves auxquels il est ENCORE lie. " +
      'RP : toutes, avec le nombre de formateurs candidats. Formateur : les propositions qui lui sont adressees, ' +
      "avec la description de la demande et le nom de l'eleve. " +
      'Par defaut, seules les demandes en cours sont renvoyees (etape 8 du flow).',
  })
  @ApiQuery({
    name: 'scope',
    required: false,
    enum: RequestScope,
    description: 'open (defaut) | closed | all',
  })
  @ApiResponse({ status: 200, description: 'Demandes, ou propositions pour un formateur' })
  @ApiResponse({ status: 401, description: 'Jeton absent ou invalide' })
  @ApiResponse({ status: 403, description: 'Role sans droit de lecture' })
  async listRequests(
    @Context() context: RequestContext,
    @Query('scope') scope?: RequestScope,
  ): Promise<TeacherRequestResponseDto[] | TeacherProposalInboxDto[]> {
    const resolvedScope = scope ?? RequestScope.OPEN;
    // La forme de la reponse depend du ROLE, jamais du contenu de la liste :
    // deduire la forme du premier element (`'requestId' in results[0]`) la
    // rendait indevinable sur liste vide.
    if (context.user.role === UserRole.FORMATEUR) {
      return TeacherProposalInboxDto.fromEntities(
        await this.service.listProposalsForTeacher(context, resolvedScope),
      );
    }
    return TeacherRequestResponseDto.fromEntities(await this.service.listRequests(context, resolvedScope));
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Lire une demande de professeur',
    description:
      "Accessible a l'eleve concerne, au parent qui l'a creee et lui est toujours lie, aux administrateurs, " +
      "et au formateur destinataire d'une proposition sur cette demande.",
  })
  @ApiParam({ name: 'id', description: 'Identifiant de la demande' })
  @ApiResponse({ status: 200, description: 'Demande', type: TeacherRequestResponseDto })
  @ApiResponse({ status: 401, description: 'Jeton absent ou invalide' })
  @ApiResponse({ status: 404, description: 'Demande inexistante, ou hors de portee de l\'appelant' })
  async getRequest(
    @Param('id', ParseUUIDPipe) id: string,
    @Context() context: RequestContext,
  ): Promise<TeacherRequestResponseDto> {
    return TeacherRequestResponseDto.fromEntity(await this.service.getRequest(id, context));
  }

  @Patch(':id/status')
  @Roles(UserRole.RESPONSABLE_PEDAGOGIQUE)
  @ApiOperation({
    summary: "Renoncer a une demande, ou cloturer une demande heritee",
    description:
      "`declined` et `cancelled` referment une demande en cours ; `closed` n'est accepte que sur une demande " +
      "bloquee en `assigned` par l'ancien modele. Une demande se cloture normalement en retenant un formateur. " +
      'Les propositions encore ouvertes deviennent « caduques », celles qui avaient accepte « non retenues ».',
  })
  @ApiParam({ name: 'id', description: 'Identifiant de la demande' })
  @ApiResponse({ status: 200, description: 'Demande mise a jour', type: TeacherRequestResponseDto })
  @ApiResponse({ status: 400, description: 'Transition refusee' })
  @ApiResponse({ status: 401, description: 'Jeton absent ou invalide' })
  @ApiResponse({ status: 403, description: 'Reserve au responsable pedagogique' })
  @ApiResponse({ status: 404, description: 'Demande inexistante' })
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStatusDto,
    @Context() context: RequestContext,
  ): Promise<TeacherRequestResponseDto> {
    return TeacherRequestResponseDto.fromEntity(
      await this.service.updateRequestStatus(id, dto.status, context),
    );
  }

  @Post(':id/validate')
  @Roles(UserRole.RESPONSABLE_PEDAGOGIQUE)
  @ApiOperation({
    summary: 'Retenir un formateur candidat (RP uniquement)',
    description:
      "Point de decision unique du flow : le RP choisit parmi les formateurs qui ont ACCEPTE. Cree le lien " +
      "eleve↔formateur dans profile-service, cloture la demande, marque les autres candidats « non retenus » " +
      'et les propositions sans reponse « caduques ». Remplace `POST /requests/:id/select` et ' +
      '`POST /requests/:id/selected-candidates`, qui relevaient de modeles abandonnes.',
  })
  @ApiParam({ name: 'id', description: 'Identifiant de la demande' })
  @ApiHeader(IDEMPOTENCY_HEADER_DOC)
  @ApiResponse({ status: 201, description: 'Formateur retenu, demande cloturee', type: TeacherRequestResponseDto })
  @ApiResponse({ status: 400, description: "Demande deja cloturee, ou formateur n'ayant pas accepte" })
  @ApiResponse({ status: 401, description: 'Jeton absent ou invalide' })
  @ApiResponse({ status: 403, description: 'Reserve au responsable pedagogique' })
  @ApiResponse({ status: 404, description: 'Demande ou proposition inexistante' })
  @ApiResponse({ status: 503, description: "profile-service injoignable : le lien n'a pas pu etre cree" })
  async validateCandidate(
    @Param('id', ParseUUIDPipe) requestId: string,
    @Body() dto: ValidateCandidateDto,
    @Context() context: RequestContext,
  ): Promise<TeacherRequestResponseDto> {
    return this.idempotency.runOnce(
      {
        idempotencyKey: context.idempotencyKey,
        endpoint: `POST /requests/${requestId}/validate`,
        userId: context.user.id,
      },
      async () =>
        TeacherRequestResponseDto.fromEntity(await this.service.validateCandidate(requestId, dto, context)),
    );
  }

  @Delete(':id')
  @Roles(UserRole.RESPONSABLE_PEDAGOGIQUE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Supprimer une demande (RP uniquement)' })
  @ApiParam({ name: 'id', description: 'Identifiant de la demande' })
  @ApiResponse({ status: 204, description: 'Demande supprimee' })
  @ApiResponse({ status: 401, description: 'Jeton absent ou invalide' })
  @ApiResponse({ status: 403, description: 'Reserve au responsable pedagogique' })
  @ApiResponse({ status: 404, description: 'Demande inexistante' })
  async deleteRequest(
    @Param('id', ParseUUIDPipe) id: string,
    @Context() context: RequestContext,
  ): Promise<void> {
    await this.service.deleteRequest(id, context);
  }

  @Post('pp-change')
  @Roles(UserRole.PARENT_FINANCEUR)
  @ApiOperation({
    summary: 'Demander un changement de professeur principal (parent financeur)',
    description: "Le lien parent↔eleve est verifie a l'appel, comme pour toute action sur un eleve.",
  })
  @ApiHeader(IDEMPOTENCY_HEADER_DOC)
  @ApiResponse({ status: 201, description: 'Demande creee', type: TeacherRequestResponseDto })
  @ApiResponse({ status: 400, description: 'Corps invalide, ou champ inconnu envoye' })
  @ApiResponse({ status: 401, description: 'Jeton absent ou invalide' })
  @ApiResponse({ status: 403, description: 'Reserve au parent financeur' })
  @ApiResponse({ status: 404, description: "Eleve inconnu, ou aucun lien avec l'appelant" })
  async createPpChangeRequest(
    @Body() dto: CreatePpChangeDto,
    @Context() context: RequestContext,
  ): Promise<TeacherRequestResponseDto> {
    return this.idempotency.runOnce(
      { idempotencyKey: context.idempotencyKey, endpoint: 'POST /requests/pp-change', userId: context.user.id },
      async () => TeacherRequestResponseDto.fromEntity(await this.service.createPpChangeRequest(dto, context)),
    );
  }
}
