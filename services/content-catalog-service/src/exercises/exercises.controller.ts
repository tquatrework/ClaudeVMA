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
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
  Headers,
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiHeader,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { ExercisesService } from './exercises.service';
import { CreateExerciseDto } from './dto/create-exercise.dto';
import { UpdateExerciseDto } from './dto/update-exercise.dto';
import { SearchExerciseDto } from './dto/search-exercise.dto';
import { CreateExerciseImageDto } from './dto/create-exercise-image.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { AuthenticatedUser } from '../common/guards/jwt-auth.guard';
import { EXERCISE_IMAGE_MAX_BYTES } from './exercise.constants';

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
      'Crée un exercice avec sa séquence ordonnée de blocs (énoncé/question) et leurs solutions. ' +
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
      'ATTENTION : les images précédemment envoyées sont supprimées par ce remplacement intégral, elles doivent être renvoyées après l\'édition.',
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

  @Post(':id/parts/:partId/images')
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.FORMATEUR, UserRole.ANIMATEUR_PEDAGOGIQUE, UserRole.RESPONSABLE_PEDAGOGIQUE)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: EXERCISE_IMAGE_MAX_BYTES * 4 } }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' }, caption: { type: 'string' } } },
  })
  @ApiOperation({
    summary: 'Ajouter une image à un bloc',
    description:
      'Réservé à l\'auteur de l\'exercice. Ré-encodage systématique en WebP, type détecté sur les octets réels, ' +
      'SVG refusé. Ajouter une image fait repasser l\'exercice en attente de validation si l\'auteur est formateur.',
  })
  @ApiParam({ name: 'id', description: 'UUID de l\'exercice' })
  @ApiParam({ name: 'partId', description: 'UUID du bloc' })
  @ApiResponse({ status: 201, description: 'Image ajoutée' })
  @ApiResponse({ status: 400, description: 'Fichier absent, illisible, ou format non reconnu' })
  @ApiResponse({ status: 403, description: 'Réservé à l\'auteur de l\'exercice' })
  @ApiResponse({ status: 404, description: 'Exercice ou bloc introuvable' })
  @ApiResponse({ status: 413, description: 'Image trop volumineuse' })
  async addPartImage(
    @Param('id') exerciseId: string,
    @Param('partId') partId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreateExerciseImageDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.exercisesService.addImageToPart(exerciseId, partId, file, dto, currentUser.id);
  }

  @Post(':id/parts/:partId/solution/images')
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.FORMATEUR, UserRole.ANIMATEUR_PEDAGOGIQUE, UserRole.RESPONSABLE_PEDAGOGIQUE)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: EXERCISE_IMAGE_MAX_BYTES * 4 } }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' }, caption: { type: 'string' } } },
  })
  @ApiOperation({
    summary: 'Ajouter une image à la solution d\'un bloc question',
    description:
      'Réservé à l\'auteur de l\'exercice. Jamais servie par une route publique — accessible uniquement via ' +
      'la médiation de learning-activity-service (route interne dédiée).',
  })
  @ApiParam({ name: 'id', description: 'UUID de l\'exercice' })
  @ApiParam({ name: 'partId', description: 'UUID du bloc question' })
  @ApiResponse({ status: 201, description: 'Image ajoutée à la solution' })
  @ApiResponse({ status: 400, description: 'Fichier absent, illisible, format non reconnu, ou bloc non-question' })
  @ApiResponse({ status: 403, description: 'Réservé à l\'auteur de l\'exercice' })
  @ApiResponse({ status: 404, description: 'Exercice, bloc ou solution introuvable' })
  @ApiResponse({ status: 413, description: 'Image trop volumineuse' })
  async addSolutionImage(
    @Param('id') exerciseId: string,
    @Param('partId') partId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreateExerciseImageDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.exercisesService.addImageToSolution(exerciseId, partId, file, dto, currentUser.id);
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
