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
import { EvaluationAttemptsService } from './evaluation-attempts.service';
import { StartEvaluationAttemptDto } from './dto/start-evaluation-attempt.dto';
import { SubmitEvaluationAnswerDto } from './dto/submit-evaluation-answer.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/guards/jwt-auth.guard';

@ApiTags('evaluation-attempts')
@ApiBearerAuth()
@Controller('evaluation-attempts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EvaluationAttemptsController {
  constructor(private readonly evaluationAttemptsService: EvaluationAttemptsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Démarrer une tentative d\'Évaluation',
    description:
      'Vérifie que l\'Évaluation est validée auprès de content-catalog-service, calcule ' +
      'l\'échéance (deadlineAt) à partir de sa durée, et démarre une tentative chronométrée. ' +
      'Réservé aux élèves, formateurs, RP et AP.',
  })
  @ApiResponse({ status: 201, description: 'Tentative démarrée' })
  @ApiResponse({ status: 400, description: 'Données invalides ou Évaluation non validée' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: 'Rôle insuffisant' })
  @ApiResponse({ status: 404, description: 'Évaluation introuvable' })
  @ApiResponse({ status: 502, description: 'Réponse d\'Évaluation invalide de content-catalog-service' })
  @ApiResponse({ status: 503, description: 'Service de contenu (content-catalog-service) injoignable' })
  @ApiHeader({ name: 'x-correlation-id', required: false, description: 'Identifiant de corrélation inter-services' })
  async start(
    @Body() startDto: StartEvaluationAttemptDto,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Headers('authorization') authorizationHeader: string,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.evaluationAttemptsService.start(
      startDto,
      currentUser.id,
      currentUser.role,
      authorizationHeader,
      correlationId,
    );
  }

  @Post(':id/answers')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Soumettre ou remplacer la réponse à un bloc question',
    description:
      'Idempotent. Refusé explicitement une fois le délai imparti écoulé ou la tentative close ' +
      '(verrouillage de confiance, pas une protection anti-triche durcie).',
  })
  @ApiParam({ name: 'id', description: 'UUID de la tentative' })
  @ApiResponse({ status: 200, description: 'Réponse enregistrée' })
  @ApiResponse({ status: 400, description: 'Données invalides, délai écoulé, tentative close, ou Exercice hors Évaluation' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: 'Rôle insuffisant' })
  @ApiResponse({ status: 404, description: 'Tentative introuvable' })
  async submitAnswer(
    @Param('id') attemptId: string,
    @Body() answerDto: SubmitEvaluationAnswerDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.evaluationAttemptsService.submitAnswer(
      attemptId,
      answerDto,
      currentUser.id,
      currentUser.role,
    );
  }

  @Post(':id/submit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Enregistrer sa réponse (clôturer la tentative)',
    description:
      'Clôture la tentative, ses réponses sont figées. Action indépendante de la demande de ' +
      'correction : les deux peuvent se faire ensemble ou séparément.',
  })
  @ApiParam({ name: 'id', description: 'UUID de la tentative' })
  @ApiResponse({ status: 200, description: 'Tentative clôturée' })
  @ApiResponse({ status: 400, description: 'Tentative déjà terminée' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: 'Rôle insuffisant' })
  @ApiResponse({ status: 404, description: 'Tentative introuvable' })
  async submit(@Param('id') attemptId: string, @CurrentUser() currentUser: AuthenticatedUser) {
    return this.evaluationAttemptsService.submit(attemptId, currentUser.id, currentUser.role);
  }

  @Post(':id/request-correction')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Demander une correction humaine',
    description:
      'Notifie les professeurs liés à l\'élève (premier arrivé, premier servi) et le RP. ' +
      'Nécessite une tentative déjà clôturée (« enregistrer sa réponse »). Un élève sans aucun ' +
      'professeur lié bascule directement en all_declined pour que le RP soit notifié.',
  })
  @ApiParam({ name: 'id', description: 'UUID de la tentative' })
  @ApiResponse({ status: 201, description: 'Demande de correction créée' })
  @ApiResponse({ status: 400, description: 'Tentative non clôturée, ou demande déjà en cours' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: 'Rôle insuffisant' })
  @ApiResponse({ status: 404, description: 'Tentative introuvable' })
  @ApiHeader({ name: 'x-correlation-id', required: false, description: 'Identifiant de corrélation inter-services' })
  async requestCorrection(
    @Param('id') attemptId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.evaluationAttemptsService.requestCorrection(
      attemptId,
      currentUser.id,
      currentUser.role,
      correlationId,
    );
  }

  @Get('history')
  @ApiOperation({
    summary: 'Historique des tentatives d\'Évaluation',
    description: 'Retourne les tentatives de l\'utilisateur authentifié, passées et en cours.',
  })
  @ApiResponse({ status: 200, description: 'Historique des tentatives' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  async history(@CurrentUser() currentUser: AuthenticatedUser) {
    return this.evaluationAttemptsService.history(currentUser.id);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'État d\'une tentative d\'Évaluation',
    description: 'Inclut l\'indicateur timeExpired, calculé à la volée.',
  })
  @ApiParam({ name: 'id', description: 'UUID de la tentative' })
  @ApiResponse({ status: 200, description: 'État de la tentative' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: 'Rôle insuffisant' })
  @ApiResponse({ status: 404, description: 'Tentative introuvable' })
  async findOne(@Param('id') attemptId: string, @CurrentUser() currentUser: AuthenticatedUser) {
    return this.evaluationAttemptsService.findOne(attemptId, currentUser.id, currentUser.role);
  }
}
