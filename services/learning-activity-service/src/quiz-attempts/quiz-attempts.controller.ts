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
import { QuizAttemptsService } from './quiz-attempts.service';
import { StartQuizAttemptDto } from './dto/start-quiz-attempt.dto';
import { SubmitQuizAttemptDto } from './dto/submit-quiz-attempt.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/guards/jwt-auth.guard';

@ApiTags('quiz-attempts')
@ApiBearerAuth()
@Controller('quiz-attempts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class QuizAttemptsController {
  constructor(private readonly quizAttemptsService: QuizAttemptsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Démarrer une tentative de Quizz',
    description:
      'Inscrit l\'utilisateur authentifié à un Quizz défini par content-catalog-service. ' +
      'Réservé aux élèves, formateurs, RP et AP.',
  })
  @ApiResponse({ status: 201, description: 'Tentative démarrée' })
  @ApiResponse({ status: 400, description: 'Données invalides' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: 'Rôle insuffisant' })
  @ApiHeader({ name: 'x-correlation-id', required: false, description: 'Identifiant de corrélation inter-services' })
  async start(
    @Body() startDto: StartQuizAttemptDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.quizAttemptsService.start(startDto, currentUser.id, currentUser.role);
  }

  @Post(':id/submit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Soumettre les réponses d\'une tentative de Quizz',
    description:
      'Reçoit les réponses de la tentative en cours, fait noter la copie par content-catalog-service ' +
      '(seul propriétaire de la solution du Quizz) et clôture la tentative avec son résultat. ' +
      'Refuse de re-soumettre une tentative déjà terminée.',
  })
  @ApiParam({ name: 'id', description: 'UUID de la tentative' })
  @ApiResponse({ status: 200, description: 'Tentative notée et clôturée' })
  @ApiResponse({ status: 400, description: 'Données invalides ou tentative déjà terminée' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: 'Rôle insuffisant' })
  @ApiResponse({ status: 404, description: 'Tentative introuvable' })
  @ApiResponse({ status: 502, description: 'Réponse de notation invalide ou incomplète de content-catalog-service' })
  @ApiResponse({ status: 503, description: 'Service de notation (content-catalog-service) injoignable' })
  @ApiHeader({ name: 'x-correlation-id', required: false, description: 'Identifiant de corrélation inter-services' })
  async submit(
    @Param('id') attemptId: string,
    @Body() submitDto: SubmitQuizAttemptDto,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.quizAttemptsService.submit(
      attemptId,
      submitDto,
      currentUser.id,
      currentUser.role,
      correlationId,
    );
  }

  @Get('history')
  @ApiOperation({
    summary: 'Historique des Quizz passés',
    description:
      'Retourne les tentatives terminées de l\'utilisateur authentifié, avec leur score ' +
      'rapporté au maximum possible et leur date de fin.',
  })
  @ApiResponse({ status: 200, description: 'Historique des tentatives terminées' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  async history(@CurrentUser() currentUser: AuthenticatedUser) {
    return this.quizAttemptsService.history(currentUser.id);
  }
}
