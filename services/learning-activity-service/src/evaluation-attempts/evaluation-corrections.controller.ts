import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Headers,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiHeader,
} from '@nestjs/swagger';
import { EvaluationCorrectionsService } from './evaluation-corrections.service';
import { CorrectEvaluationDto } from './dto/correct-evaluation.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/guards/jwt-auth.guard';

@ApiTags('evaluation-corrections')
@ApiBearerAuth()
@Controller('evaluation-corrections')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EvaluationCorrectionsController {
  constructor(private readonly evaluationCorrectionsService: EvaluationCorrectionsService) {}

  @Get('pending')
  @ApiOperation({
    summary: 'File des demandes de correction à traiter',
    description:
      'Pour un professeur : demandes en attente où il est lié à l\'élève et n\'a pas encore ' +
      'refusé. Pour le RP : toutes les demandes en attente et celles où tous les professeurs ' +
      'liés ont refusé (état actionnable).',
  })
  @ApiResponse({ status: 200, description: 'File de corrections' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: 'Rôle insuffisant' })
  async pending(@CurrentUser() currentUser: AuthenticatedUser) {
    return this.evaluationCorrectionsService.pending(currentUser.id, currentUser.role);
  }

  @Get('mine')
  @ApiOperation({
    summary: 'Corrections acceptées et/ou soumises par l\'appelant',
    description: 'Réservé aux professeurs et au RP.',
  })
  @ApiResponse({ status: 200, description: 'Corrections de l\'appelant' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: 'Rôle insuffisant' })
  async mine(@CurrentUser() currentUser: AuthenticatedUser) {
    return this.evaluationCorrectionsService.mine(currentUser.id, currentUser.role);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Détail d\'une demande de correction',
    description:
      'Les réponses de la tentative (attemptAnswers) ne sont jointes que pour l\'élève, le ' +
      'professeur ayant accepté, un professeur lié, ou le RP — jamais la solution officielle ' +
      'de l\'Exercice.',
  })
  @ApiParam({ name: 'id', description: 'UUID de la demande de correction' })
  @ApiResponse({ status: 200, description: 'Détail de la demande' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: 'Accès refusé à cette demande' })
  @ApiResponse({ status: 404, description: 'Demande introuvable' })
  async findOne(@Param('id') correctionRequestId: string, @CurrentUser() currentUser: AuthenticatedUser) {
    return this.evaluationCorrectionsService.findOne(correctionRequestId, currentUser.id, currentUser.role);
  }

  @Post(':id/accept')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Accepter une demande de correction',
    description:
      'Premier arrivé, premier servi : tout accept suivant échoue explicitement (400). ' +
      'Réservé aux professeurs actuellement liés à l\'élève (vérifié en direct), ou au RP en ' +
      'override d\'escalade (y compris depuis l\'état all_declined).',
  })
  @ApiParam({ name: 'id', description: 'UUID de la demande de correction' })
  @ApiResponse({ status: 200, description: 'Demande acceptée' })
  @ApiResponse({ status: 400, description: 'Demande déjà prise en charge ou clôturée' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: 'Rôle insuffisant ou non lié à l\'élève' })
  @ApiResponse({ status: 404, description: 'Demande introuvable' })
  @ApiResponse({ status: 502, description: 'Réponse de relations invalide de profile-service' })
  @ApiResponse({ status: 503, description: 'Service de profils (profile-service) injoignable' })
  @ApiHeader({ name: 'x-correlation-id', required: false, description: 'Identifiant de corrélation inter-services' })
  async accept(
    @Param('id') correctionRequestId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.evaluationCorrectionsService.accept(
      correctionRequestId,
      currentUser.id,
      currentUser.role,
      correlationId,
    );
  }

  @Post(':id/decline')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Refuser une demande de correction',
    description:
      'Refus individuel. Bascule en all_declined quand tous les professeurs actuellement liés ' +
      'ont refusé, ce qui notifie le RP.',
  })
  @ApiParam({ name: 'id', description: 'UUID de la demande de correction' })
  @ApiResponse({ status: 200, description: 'Demande refusée (ou basculée en all_declined)' })
  @ApiResponse({ status: 400, description: 'Demande déjà traitée' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: 'Rôle insuffisant ou non lié à l\'élève' })
  @ApiResponse({ status: 404, description: 'Demande introuvable' })
  @ApiHeader({ name: 'x-correlation-id', required: false, description: 'Identifiant de corrélation inter-services' })
  async decline(
    @Param('id') correctionRequestId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.evaluationCorrectionsService.decline(
      correctionRequestId,
      currentUser.id,
      currentUser.role,
      correlationId,
    );
  }

  @Post(':id/correct')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Soumettre la correction',
    description:
      'Score et/ou commentaire, jamais de comparaison à la solution officielle de l\'Exercice. ' +
      'Réservé à celui qui a accepté la demande.',
  })
  @ApiParam({ name: 'id', description: 'UUID de la demande de correction' })
  @ApiResponse({ status: 200, description: 'Correction enregistrée' })
  @ApiResponse({ status: 400, description: 'Demande non en cours de prise en charge, ou correction vide' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: 'Seul le correcteur ayant accepté peut corriger' })
  @ApiResponse({ status: 404, description: 'Demande introuvable' })
  @ApiHeader({ name: 'x-correlation-id', required: false, description: 'Identifiant de corrélation inter-services' })
  async correct(
    @Param('id') correctionRequestId: string,
    @Body() correctDto: CorrectEvaluationDto,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.evaluationCorrectionsService.correct(
      correctionRequestId,
      correctDto,
      currentUser.id,
      correlationId,
    );
  }
}
