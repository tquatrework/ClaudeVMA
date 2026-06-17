import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
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
import { ExercisesService } from './exercises.service';
import { CreateExerciseDto } from './dto/create-exercise.dto';
import { SearchExerciseDto } from './dto/search-exercise.dto';
import { CreateExerciseAnswerDto } from './dto/create-exercise-answer.dto';
import { CreateCorrectionRequestDto } from './dto/create-correction-request.dto';
import { ProposeSolutionDto } from './dto/propose-solution.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { AuthenticatedUser } from '../common/guards/jwt-auth.guard';

@ApiTags('exercises')
@ApiBearerAuth()
@Controller('exercises')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ExercisesController {
  constructor(private readonly exercisesService: ExercisesService) {}

  @Get()
  @ApiOperation({
    summary: 'Rechercher des exercices',
    description: 'Retourne la liste des exercices filtrés par niveau, difficulté, thème, tag ou auteur.',
  })
  @ApiResponse({ status: 200, description: 'Liste des exercices correspondants' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiHeader({ name: 'x-correlation-id', required: false, description: 'Identifiant de corrélation inter-services' })
  async search(
    @Query() searchParams: SearchExerciseDto,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.exercisesService.search(searchParams, currentUser.role);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.FORMATEUR, UserRole.ANIMATEUR_PEDAGOGIQUE, UserRole.RESPONSABLE_PEDAGOGIQUE)
  @ApiOperation({
    summary: 'Charger un exercice',
    description: 'Crée un exercice avec son énoncé, ses parties et une solution obligatoire. Réservé aux formateurs et rôles pédagogiques.',
  })
  @ApiResponse({ status: 201, description: 'Exercice créé avec succès' })
  @ApiResponse({ status: 400, description: 'Données invalides' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: 'Rôle insuffisant' })
  @ApiHeader({ name: 'x-correlation-id', required: false })
  async create(
    @Body() createExerciseDto: CreateExerciseDto,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.exercisesService.create(createExerciseDto, currentUser.id, currentUser.role);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Récupérer un exercice par son identifiant',
    description: 'Retourne le détail complet d\'un exercice avec ses parties.',
  })
  @ApiParam({ name: 'id', description: 'UUID de l\'exercice' })
  @ApiResponse({ status: 200, description: 'Exercice trouvé' })
  @ApiResponse({ status: 404, description: 'Exercice introuvable' })
  async findOne(
    @Param('id') exerciseId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.exercisesService.findOne(exerciseId);
  }

  @Post(':id/answers')
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.ELEVE)
  @ApiOperation({
    summary: 'Soumettre une réponse à un exercice',
    description: 'Permet à un élève de soumettre sa réponse à un exercice validé.',
  })
  @ApiParam({ name: 'id', description: 'UUID de l\'exercice' })
  @ApiResponse({ status: 201, description: 'Réponse enregistrée' })
  @ApiResponse({ status: 400, description: 'Exercice non disponible ou données invalides' })
  @ApiResponse({ status: 403, description: 'Réservé aux élèves' })
  @ApiHeader({ name: 'x-correlation-id', required: false })
  async submitAnswer(
    @Param('id') exerciseId: string,
    @Body() createAnswerDto: CreateExerciseAnswerDto,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.exercisesService.submitAnswer(
      exerciseId,
      createAnswerDto,
      currentUser.id,
      currentUser.role,
    );
  }

  @Post(':id/solutions')
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.FORMATEUR, UserRole.ANIMATEUR_PEDAGOGIQUE, UserRole.RESPONSABLE_PEDAGOGIQUE)
  @ApiOperation({
    summary: 'Proposer une solution pour un exercice',
    description: 'Permet aux formateurs et rôles pédagogiques de proposer une solution à un exercice.',
  })
  @ApiParam({ name: 'id', description: 'UUID de l\'exercice' })
  @ApiResponse({ status: 201, description: 'Solution proposée' })
  @ApiResponse({ status: 403, description: 'Rôle insuffisant' })
  @ApiHeader({ name: 'x-correlation-id', required: false })
  async proposeSolution(
    @Param('id') exerciseId: string,
    @Body() proposeSolutionDto: ProposeSolutionDto,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.exercisesService.proposeSolution(
      exerciseId,
      proposeSolutionDto,
      currentUser.id,
      currentUser.role,
    );
  }

  @Get(':id/solutions/official')
  @ApiOperation({
    summary: 'Obtenir la solution officielle d\'un exercice',
    description: 'Retourne la solution officielle (moins chère des solutions validées). Les solutions restent bloquées pendant une évaluation en cours.',
  })
  @ApiParam({ name: 'id', description: 'UUID de l\'exercice' })
  @ApiResponse({ status: 200, description: 'Solution officielle' })
  @ApiResponse({ status: 404, description: 'Aucune solution validée disponible' })
  async getOfficialSolution(
    @Param('id') exerciseId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.exercisesService.getOfficialSolution(exerciseId, currentUser.id, currentUser.role);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.RESPONSABLE_PEDAGOGIQUE, UserRole.TECHNICIEN_INFORMATIQUE)
  @ApiOperation({
    summary: 'Retirer un exercice',
    description: 'Marque l\'exercice comme retiré (REMOVED). Le RP peut retirer tout contenu non conforme.',
  })
  @ApiParam({ name: 'id', description: 'UUID de l\'exercice' })
  @ApiResponse({ status: 204, description: 'Exercice retiré' })
  @ApiResponse({ status: 403, description: 'Rôle insuffisant' })
  @ApiResponse({ status: 404, description: 'Exercice introuvable' })
  async remove(
    @Param('id') exerciseId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.exercisesService.removeExercise(exerciseId, currentUser.id, currentUser.role);
  }
}
