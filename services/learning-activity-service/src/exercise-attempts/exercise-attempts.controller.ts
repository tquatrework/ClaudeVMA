import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Res,
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
import { Response } from 'express';
import { ExerciseAttemptsService } from './exercise-attempts.service';
import { StartExerciseAttemptDto } from './dto/start-exercise-attempt.dto';
import { SubmitExerciseAnswerDto } from './dto/submit-exercise-answer.dto';
import { RevealExerciseSolutionDto } from './dto/reveal-exercise-solution.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/guards/jwt-auth.guard';

@ApiTags('exercise-attempts')
@ApiBearerAuth()
@Controller('exercise-attempts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ExerciseAttemptsController {
  constructor(private readonly exerciseAttemptsService: ExerciseAttemptsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Démarrer une tentative d\'Exercice',
    description:
      'Lit la structure de l\'exercice auprès de content-catalog-service (blocs question, ' +
      'jamais la solution) et démarre une tentative d\'auto-contrôle. Réservé aux élèves, ' +
      'formateurs, RP et AP.',
  })
  @ApiResponse({ status: 201, description: 'Tentative démarrée' })
  @ApiResponse({ status: 400, description: 'Données invalides' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: 'Rôle insuffisant' })
  @ApiResponse({ status: 404, description: 'Exercice introuvable' })
  @ApiResponse({ status: 502, description: 'Réponse de structure invalide de content-catalog-service' })
  @ApiResponse({ status: 503, description: 'Service de contenu (content-catalog-service) injoignable' })
  @ApiHeader({ name: 'x-correlation-id', required: false, description: 'Identifiant de corrélation inter-services' })
  async start(
    @Body() startDto: StartExerciseAttemptDto,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Headers('authorization') authorizationHeader: string,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.exerciseAttemptsService.start(
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
      'Idempotent : remplace la réponse précédente pour ce bloc si elle existe déjà. ' +
      'Réponse facultative, l\'élève n\'est pas obligé de répondre à toutes les questions.',
  })
  @ApiParam({ name: 'id', description: 'UUID de la tentative' })
  @ApiResponse({ status: 200, description: 'Réponse enregistrée' })
  @ApiResponse({ status: 400, description: 'Données invalides' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: 'Rôle insuffisant' })
  @ApiResponse({ status: 404, description: 'Tentative ou bloc question introuvable' })
  async submitAnswer(
    @Param('id') attemptId: string,
    @Body() submitDto: SubmitExerciseAnswerDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.exerciseAttemptsService.submitAnswer(
      attemptId,
      submitDto,
      currentUser.id,
      currentUser.role,
    );
  }

  @Post(':id/reveal')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Révéler la solution d\'un bloc question',
    description:
      'Médiation obligatoire vers content-catalog-service, seul propriétaire de la solution : ' +
      'le front ne doit jamais l\'appeler directement. Idempotent : une solution déjà révélée ' +
      'n\'est jamais redemandée, la valeur mise en cache est renvoyée telle quelle.',
  })
  @ApiParam({ name: 'id', description: 'UUID de la tentative' })
  @ApiResponse({ status: 200, description: 'Solution révélée (ou déjà révélée), renvoyée dans la tentative' })
  @ApiResponse({ status: 400, description: 'Données invalides' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: 'Rôle insuffisant' })
  @ApiResponse({ status: 404, description: 'Tentative, bloc question ou solution introuvable' })
  @ApiResponse({ status: 502, description: 'Réponse de solution invalide de content-catalog-service' })
  @ApiResponse({ status: 503, description: 'Service de contenu (content-catalog-service) injoignable' })
  @ApiHeader({ name: 'x-correlation-id', required: false, description: 'Identifiant de corrélation inter-services' })
  async reveal(
    @Param('id') attemptId: string,
    @Body() revealDto: RevealExerciseSolutionDto,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.exerciseAttemptsService.reveal(
      attemptId,
      revealDto,
      currentUser.id,
      currentUser.role,
      correlationId,
    );
  }

  @Get(':id/images/:itemId')
  @ApiOperation({
    summary: 'Octets d\'une image de solution révélée',
    description:
      'Proxy authentifié vers content-catalog-service : ne sert que les images appartenant à ' +
      'une solution déjà révélée sur cette tentative — jamais un id orphelin, jamais de base64 ' +
      'dans du JSON. Le front ne doit jamais contacter content-catalog-service directement.',
  })
  @ApiParam({ name: 'id', description: 'UUID de la tentative' })
  @ApiParam({ name: 'itemId', description: 'Identifiant de l\'item image (défini par content-catalog-service)' })
  @ApiResponse({ status: 200, description: 'Octets de l\'image' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: 'Rôle insuffisant' })
  @ApiResponse({ status: 404, description: 'Tentative introuvable, ou image non révélée sur cette tentative' })
  @ApiResponse({ status: 502, description: 'Réponse d\'image invalide de content-catalog-service' })
  @ApiResponse({ status: 503, description: 'Service de contenu (content-catalog-service) injoignable' })
  @ApiHeader({ name: 'x-correlation-id', required: false, description: 'Identifiant de corrélation inter-services' })
  async getRevealedImage(
    @Param('id') attemptId: string,
    @Param('itemId') itemId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Res({ passthrough: true }) response: Response,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    const { buffer, contentType } = await this.exerciseAttemptsService.getRevealedImage(
      attemptId,
      itemId,
      currentUser.id,
      currentUser.role,
      correlationId,
    );

    response.setHeader('Content-Type', contentType);
    return buffer;
  }

  @Get('history')
  @ApiOperation({
    summary: 'Historique des tentatives d\'Exercice',
    description:
      'Retourne les tentatives de l\'utilisateur authentifié, passées et en cours, avec leur statut.',
  })
  @ApiResponse({ status: 200, description: 'Historique des tentatives' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  async history(@CurrentUser() currentUser: AuthenticatedUser) {
    return this.exerciseAttemptsService.history(currentUser.id);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'État d\'une tentative d\'Exercice',
    description:
      'Calcule le statut (fait / en cours) selon les réponses données et les solutions révélées.',
  })
  @ApiParam({ name: 'id', description: 'UUID de la tentative' })
  @ApiResponse({ status: 200, description: 'État de la tentative' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: 'Rôle insuffisant' })
  @ApiResponse({ status: 404, description: 'Tentative introuvable' })
  async findOne(
    @Param('id') attemptId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.exerciseAttemptsService.findOne(attemptId, currentUser.id, currentUser.role);
  }
}
