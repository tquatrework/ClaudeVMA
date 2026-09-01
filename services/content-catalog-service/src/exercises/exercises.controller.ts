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
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiHeader } from '@nestjs/swagger';
import { ExercisesService } from './exercises.service';
import { CreateExerciseDto } from './dto/create-exercise.dto';
import { UpdateExerciseDto } from './dto/update-exercise.dto';
import { SearchExerciseDto } from './dto/search-exercise.dto';
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
    description:
      'Retourne la liste des exercices visibles par l\'appelant, filtrés par niveau, difficulté, thème, tag, mot-clé ou auteur. ' +
      'Un exercice non validé reste invisible sauf à son auteur, aux AP, RP et TI.',
  })
  @ApiResponse({ status: 200, description: 'Liste des exercices correspondants' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiHeader({ name: 'x-correlation-id', required: false })
  async search(
    @Query() searchParams: SearchExerciseDto,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.exercisesService.search(searchParams, currentUser.id, currentUser.role);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.FORMATEUR, UserRole.ANIMATEUR_PEDAGOGIQUE, UserRole.RESPONSABLE_PEDAGOGIQUE)
  @ApiOperation({
    summary: 'Créer un exercice',
    description:
      'Crée un exercice avec sa séquence ordonnée de blocs (énoncé/image/question) et leurs solutions. ' +
      'Une image se dépose directement dans un bloc "image" dédié, encodée en base64 dans ce même appel ' +
      '(voir GET /exercises/image-constraints pour les plafonds). L\'exercice doit comporter au moins un ' +
      'bloc énoncé (peut être vide) et au moins un bloc question non vide. ' +
      'Un exercice créé par un formateur passe en attente de validation ; un exercice créé par un AP ou un RP est auto-validé.',
  })
  @ApiResponse({ status: 201, description: 'Exercice créé (jamais de solution dans la réponse)' })
  @ApiResponse({ status: 400, description: 'Données invalides (bloc mal formé, solution manquante...)' })
  @ApiResponse({ status: 403, description: 'Rôle insuffisant' })
  @ApiHeader({ name: 'x-correlation-id', required: false })
  async create(
    @Body() createExerciseDto: CreateExerciseDto,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.exercisesService.create(createExerciseDto, currentUser.id, currentUser.role);
  }

  @Put(':id')
  @Roles(UserRole.FORMATEUR, UserRole.ANIMATEUR_PEDAGOGIQUE, UserRole.RESPONSABLE_PEDAGOGIQUE)
  @ApiOperation({
    summary: 'Modifier un exercice',
    description:
      'Remplace intégralement les blocs, items et solutions d\'un exercice. Réservé à son auteur. ' +
      'Un exercice édité par son auteur formateur repasse en attente de validation. ' +
      'ATTENTION : les images précédemment envoyées sont supprimées par ce remplacement intégral ; ' +
      'pour les conserver, le front doit les renvoyer explicitement (base64) dans ce même appel.',
  })
  @ApiParam({ name: 'id', description: 'UUID de l\'exercice' })
  @ApiResponse({ status: 200, description: 'Exercice modifié' })
  @ApiResponse({ status: 400, description: 'Données invalides' })
  @ApiResponse({ status: 403, description: 'Réservé à l\'auteur de l\'exercice' })
  @ApiResponse({ status: 404, description: 'Exercice introuvable' })
  @ApiHeader({ name: 'x-correlation-id', required: false })
  async update(
    @Param('id') exerciseId: string,
    @Body() updateExerciseDto: UpdateExerciseDto,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.exercisesService.update(exerciseId, updateExerciseDto, currentUser.id, currentUser.role);
  }

  @Get('default-title')
  @Roles(UserRole.FORMATEUR, UserRole.ANIMATEUR_PEDAGOGIQUE, UserRole.RESPONSABLE_PEDAGOGIQUE)
  @ApiOperation({
    summary: 'Suggérer un titre par défaut avant création',
    description:
      'À lire par le front à l\'ouverture du formulaire de création, pour pré-remplir le champ titre ' +
      '(désormais obligatoire). Forme "Exercice {n}", où {n} est le nombre d\'exercices déjà créés par ' +
      'l\'appelant, plus un. Ne réserve rien : l\'utilisateur reste libre de modifier la valeur avant de valider.',
  })
  @ApiResponse({ status: 200, description: 'Titre suggéré', schema: { example: { title: 'Exercice 4' } } })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  async getDefaultTitle(@CurrentUser() currentUser: AuthenticatedUser): Promise<{ title: string }> {
    return this.exercisesService.getDefaultTitle(currentUser.id);
  }

  @Get('image-constraints')
  @Roles(UserRole.FORMATEUR, UserRole.ANIMATEUR_PEDAGOGIQUE, UserRole.RESPONSABLE_PEDAGOGIQUE)
  @ApiOperation({
    summary: 'Lire les plafonds applicables à une image de bloc',
    description:
      'À lire par le front avant d\'afficher le bouton d\'ajout d\'image (arbitrage du 2026-09-01, "Bloc image ' +
      'de premier niveau pour l\'Exercice") : taille maximale d\'une image en entrée (avant ré-encodage), ' +
      'taille maximale en sortie (après ré-encodage WebP), et taille maximale du corps JSON entier de ' +
      'POST/PUT /exercises. Jamais codés en dur côté front.',
  })
  @ApiResponse({
    status: 200,
    description: 'Plafonds courants',
    schema: {
      example: { maxImageInputBytes: 600000, maxImageOutputBytes: 500000, maxRequestBodyBytes: 900000 },
    },
  })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  getImageConstraints() {
    return this.exercisesService.getImageConstraints();
  }

  @Get('pending-validation')
  @Roles(UserRole.ANIMATEUR_PEDAGOGIQUE, UserRole.RESPONSABLE_PEDAGOGIQUE)
  @ApiOperation({
    summary: 'Lister les exercices en attente de validation',
    description:
      'Retourne les exercices créés par un professeur, en attente de validation. ' +
      'Un AP ne voit que les exercices des formateurs qu\'il anime ; un RP voit tout.',
  })
  @ApiResponse({ status: 200, description: 'Liste des exercices en attente de validation' })
  @ApiResponse({ status: 403, description: 'Réservé aux AP et RP' })
  @ApiResponse({ status: 503, description: 'profile-service injoignable' })
  async getPendingValidation(@CurrentUser() currentUser: AuthenticatedUser) {
    return this.exercisesService.getPendingValidation(currentUser.id, currentUser.role);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Récupérer un exercice par son identifiant',
    description:
      'Retourne la séquence ordonnée de blocs (énoncé/question) et leur contenu, jamais le contenu d\'une solution ' +
      '(seulement l\'indication qu\'un bloc question en porte une). 404 si non trouvé ou non visible pour l\'appelant.',
  })
  @ApiParam({ name: 'id', description: 'UUID de l\'exercice' })
  @ApiResponse({ status: 200, description: 'Exercice trouvé' })
  @ApiResponse({ status: 404, description: 'Exercice introuvable ou non visible pour l\'appelant' })
  async findOne(
    @Param('id') exerciseId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.exercisesService.findOne(exerciseId, currentUser.id, currentUser.role);
  }

  @Get(':id/solutions')
  @Roles(
    UserRole.FORMATEUR,
    UserRole.ANIMATEUR_PEDAGOGIQUE,
    UserRole.RESPONSABLE_PEDAGOGIQUE,
    UserRole.TECHNICIEN_INFORMATIQUE,
  )
  @ApiOperation({
    summary: 'Récupérer un exercice avec le contenu complet de ses solutions',
    description:
      'Retourne la même séquence de blocs que GET /exercises/:id, mais avec le contenu texte/formule/image ' +
      'de la solution de chaque bloc question (jamais les images de solution, servies uniquement via la ' +
      'médiation de learning-activity-service). Réservé à l\'auteur de l\'exercice et aux AP/RP/TI. ' +
      'GET /exercises/:id reste inchangée et ne renvoie jamais la solution, quel que soit l\'appelant ' +
      '(arbitrage du 2026-09-01, même principe que la solution du Quizz du 2026-08-28).',
  })
  @ApiParam({ name: 'id', description: 'UUID de l\'exercice' })
  @ApiResponse({ status: 200, description: 'Exercice avec solutions complètes' })
  @ApiResponse({ status: 403, description: 'Réservé à l\'auteur de l\'exercice et aux AP/RP/TI' })
  @ApiResponse({ status: 404, description: 'Exercice introuvable' })
  async findOneWithSolutions(
    @Param('id') exerciseId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.exercisesService.findOneWithSolutions(exerciseId, currentUser.id, currentUser.role);
  }

  @Get(':id/images/:itemId')
  @ApiOperation({
    summary: 'Télécharger les octets d\'une image de bloc',
    description:
      'Réservé aux images de blocs (énoncé/question) — une image de solution n\'est jamais servie par cette route ' +
      '(404). Revérifie la visibilité de l\'exercice parent à chaque téléchargement.',
  })
  @ApiParam({ name: 'id', description: 'UUID de l\'exercice' })
  @ApiParam({ name: 'itemId', description: 'UUID de l\'item image' })
  @ApiResponse({ status: 200, description: 'Octets de l\'image' })
  @ApiResponse({ status: 404, description: 'Exercice, bloc ou image introuvable' })
  async downloadPartImage(
    @Param('id') exerciseId: string,
    @Param('itemId') itemId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const { item, buffer } = await this.exercisesService.getPartImageForDownload(
      exerciseId,
      itemId,
      currentUser.id,
      currentUser.role,
    );
    res.set({
      'Content-Type': item.imageMimeType ?? 'application/octet-stream',
      'Content-Length': buffer.length,
    });
    res.send(buffer);
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
