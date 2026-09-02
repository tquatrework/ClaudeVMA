import {
  Controller,
  Get,
  Post,
  Put,
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
import { EvaluationsService } from './evaluations.service';
import { CreateEvaluationDto } from './dto/create-evaluation.dto';
import { UpdateEvaluationDto } from './dto/update-evaluation.dto';
import { SearchEvaluationDto } from './dto/search-evaluation.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { AuthenticatedUser } from '../common/guards/jwt-auth.guard';

@ApiTags('evaluations')
@ApiBearerAuth()
@Controller('evaluations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EvaluationsController {
  constructor(private readonly evaluationsService: EvaluationsService) {}

  @Get()
  @ApiOperation({
    summary: 'Rechercher des évaluations',
    description:
      'Retourne la liste des évaluations filtrées (niveau, difficulté, thème, tag, mot-clé). ' +
      'Les élèves et parents ne voient que les évaluations validées.',
  })
  @ApiResponse({ status: 200, description: 'Liste des évaluations correspondantes' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiHeader({ name: 'x-correlation-id', required: false })
  async search(
    @Query() searchParams: SearchEvaluationDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.evaluationsService.search(searchParams, currentUser.role);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.FORMATEUR, UserRole.ANIMATEUR_PEDAGOGIQUE, UserRole.RESPONSABLE_PEDAGOGIQUE)
  @ApiOperation({
    summary: 'Créer une évaluation',
    description:
      'Crée une évaluation à partir d\'une liste d\'exercices, avec chronométrage obligatoire et option de ' +
      'blocage du retour arrière. Une évaluation créée par un formateur passe en attente de validation ; ' +
      'une évaluation créée par un AP ou un RP est auto-validée (cycle aligné sur Quizz/Exercice). ' +
      'Accepte optionnellement un barème informatif (par exercice ou par question), jamais utilisé ' +
      'pour un calcul automatique.',
  })
  @ApiResponse({ status: 201, description: 'Évaluation créée' })
  @ApiResponse({ status: 400, description: 'Données invalides, liste d\'exercices vide ou durée absente/invalide' })
  @ApiResponse({ status: 403, description: 'Rôle insuffisant' })
  @ApiHeader({ name: 'x-correlation-id', required: false })
  async create(
    @Body() createEvaluationDto: CreateEvaluationDto,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.evaluationsService.create(createEvaluationDto, currentUser.id, currentUser.role);
  }

  @Put(':id')
  @Roles(UserRole.FORMATEUR, UserRole.ANIMATEUR_PEDAGOGIQUE, UserRole.RESPONSABLE_PEDAGOGIQUE)
  @ApiOperation({
    summary: 'Modifier une évaluation',
    description:
      'Modifie une évaluation, réservé à son auteur (ajouté le 2026-09-02 avec le barème ' +
      'informatif). Remplacement intégral (exercices et barème compris). Un formateur qui ' +
      'modifie une évaluation déjà validée la fait repasser en attente de validation ; un AP ' +
      'ou un RP éditant sa propre évaluation ne change pas son statut.',
  })
  @ApiParam({ name: 'id', description: 'UUID de l\'évaluation' })
  @ApiResponse({ status: 200, description: 'Évaluation modifiée' })
  @ApiResponse({ status: 400, description: 'Données invalides' })
  @ApiResponse({ status: 403, description: 'Vous n\'êtes pas l\'auteur de cette évaluation' })
  @ApiResponse({ status: 404, description: 'Évaluation introuvable' })
  @ApiHeader({ name: 'x-correlation-id', required: false })
  async update(
    @Param('id') evaluationId: string,
    @Body() updateEvaluationDto: UpdateEvaluationDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.evaluationsService.update(
      evaluationId,
      updateEvaluationDto,
      currentUser.id,
      currentUser.role,
    );
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Récupérer une évaluation par identifiant',
    description:
      'Retourne le détail d\'une évaluation avec ses exercices et son barème informatif ' +
      'éventuel (champ scoring, null si le créateur n\'en a pas défini).',
  })
  @ApiParam({ name: 'id', description: 'UUID de l\'évaluation' })
  @ApiResponse({ status: 200, description: 'Évaluation trouvée' })
  @ApiResponse({ status: 404, description: 'Évaluation introuvable' })
  async findOne(
    @Param('id') evaluationId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.evaluationsService.findOne(evaluationId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.RESPONSABLE_PEDAGOGIQUE, UserRole.TECHNICIEN_INFORMATIQUE)
  @ApiOperation({
    summary: 'Retirer une évaluation',
    description: 'Marque l\'évaluation comme retirée (REMOVED). Réservé au RP et au TI.',
  })
  @ApiParam({ name: 'id', description: 'UUID de l\'évaluation' })
  @ApiResponse({ status: 204, description: 'Évaluation retirée' })
  @ApiResponse({ status: 403, description: 'Rôle insuffisant' })
  @ApiResponse({ status: 404, description: 'Évaluation introuvable' })
  async remove(
    @Param('id') evaluationId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.evaluationsService.removeEvaluation(evaluationId, currentUser.id, currentUser.role);
  }
}
