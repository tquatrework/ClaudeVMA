import {
  Controller,
  Get,
  Post,
  Put,
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
import { QuizzesService } from './quizzes.service';
import { CreateQuizDto } from './dto/create-quiz.dto';
import { UpdateQuizDto } from './dto/update-quiz.dto';
import { SearchQuizDto } from './dto/search-quiz.dto';
import { PendingValidationQueryDto } from './dto/pending-validation-query.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { AuthenticatedUser } from '../common/guards/jwt-auth.guard';

@ApiTags('quizzes')
@ApiBearerAuth()
@Controller('quizzes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class QuizzesController {
  constructor(private readonly quizzesService: QuizzesService) {}

  @Get()
  @ApiOperation({
    summary: 'Rechercher des quizz',
    description:
      'Retourne la liste des quizz visibles par l\'appelant, filtrable par tag et mot-clé. ' +
      'Un quizz non validé reste invisible sauf à son auteur, aux AP, RP et TI. La solution n\'est jamais incluse. ' +
      'Avec `mine=true`, retourne tous les quizz de l\'appelant, tous statuts confondus (y compris rejected).',
  })
  @ApiResponse({ status: 200, description: 'Liste des quizz correspondants' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiHeader({ name: 'x-correlation-id', required: false })
  async search(
    @Query() searchParams: SearchQuizDto,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.quizzesService.search(searchParams, currentUser.id, currentUser.role);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.FORMATEUR, UserRole.ANIMATEUR_PEDAGOGIQUE, UserRole.RESPONSABLE_PEDAGOGIQUE)
  @ApiOperation({
    summary: 'Créer un quizz',
    description:
      'Crée un quizz avec ses questions, sa solution et son barème. Réservé aux formateurs, AP et RP. ' +
      'Un quizz créé par un formateur passe en attente de validation ; un quizz créé par un AP ou un RP est auto-validé.',
  })
  @ApiResponse({ status: 201, description: 'Quizz créé (jamais de solution dans la réponse)' })
  @ApiResponse({ status: 400, description: 'Données invalides (question mal formée, solution manquante...)' })
  @ApiResponse({ status: 403, description: 'Rôle insuffisant' })
  @ApiHeader({ name: 'x-correlation-id', required: false })
  async create(
    @Body() createQuizDto: CreateQuizDto,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.quizzesService.create(createQuizDto, currentUser.id, currentUser.role);
  }

  @Put(':id')
  @Roles(UserRole.FORMATEUR, UserRole.ANIMATEUR_PEDAGOGIQUE, UserRole.RESPONSABLE_PEDAGOGIQUE)
  @ApiOperation({
    summary: 'Modifier un quizz',
    description:
      'Remplace le contenu d\'un quizz (titre, description, tags, barème, pénalité, questions). ' +
      'Réservé à son auteur. Un quizz édité par son auteur formateur repasse en attente de validation, ' +
      'quel que soit son statut précédent ; un quizz édité par son auteur AP/RP ne change pas de statut.',
  })
  @ApiParam({ name: 'id', description: 'UUID du quizz' })
  @ApiResponse({ status: 200, description: 'Quizz modifié' })
  @ApiResponse({ status: 400, description: 'Données invalides (question mal formée, solution manquante...)' })
  @ApiResponse({ status: 403, description: 'Réservé à l\'auteur du quizz' })
  @ApiResponse({ status: 404, description: 'Quizz introuvable' })
  @ApiHeader({ name: 'x-correlation-id', required: false })
  async update(
    @Param('id') quizId: string,
    @Body() updateQuizDto: UpdateQuizDto,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.quizzesService.update(quizId, updateQuizDto, currentUser.id, currentUser.role);
  }

  @Get('pending-validation')
  @Roles(UserRole.ANIMATEUR_PEDAGOGIQUE, UserRole.RESPONSABLE_PEDAGOGIQUE)
  @ApiOperation({
    summary: 'Lister les quizz en attente de validation',
    description:
      'Retourne les quizz créés par un professeur, en attente de validation par un AP ou un RP. ' +
      'Un AP ne voit que les quizz des formateurs qu\'il anime ; un RP voit tout.',
  })
  @ApiResponse({ status: 200, description: 'Liste des quizz en attente de validation' })
  @ApiResponse({ status: 403, description: 'Réservé aux AP et RP' })
  @ApiResponse({ status: 503, description: 'profile-service injoignable (vérification de la relation AP↔formateur impossible)' })
  async getPendingValidation(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Query() query: PendingValidationQueryDto,
  ) {
    return this.quizzesService.getPendingValidation(currentUser.id, currentUser.role, query.page, query.limit);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Récupérer un quizz par identifiant',
    description: 'Retourne les questions et choix d\'un quizz, jamais la solution. 404 si non trouvé ou non visible pour l\'appelant.',
  })
  @ApiParam({ name: 'id', description: 'UUID du quizz' })
  @ApiResponse({ status: 200, description: 'Quizz trouvé' })
  @ApiResponse({ status: 404, description: 'Quizz introuvable ou non visible pour l\'appelant' })
  async findOne(
    @Param('id') quizId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.quizzesService.findOne(quizId, currentUser.id, currentUser.role);
  }
}
