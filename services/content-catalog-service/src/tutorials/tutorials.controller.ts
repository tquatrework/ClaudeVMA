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
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiHeader,
} from '@nestjs/swagger';
import { TutorialsService } from './tutorials.service';
import { CreateTutorialDto } from './dto/create-tutorial.dto';
import { UpdateTutorialDto } from './dto/update-tutorial.dto';
import { SearchTutorialDto } from './dto/search-tutorial.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { AuthenticatedUser } from '../common/guards/jwt-auth.guard';

@ApiTags('tutorials')
@ApiBearerAuth()
@Controller('tutorials')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TutorialsController {
  constructor(private readonly tutorialsService: TutorialsService) {}

  @Get()
  @ApiOperation({
    summary: 'Rechercher des tutoriels/vidéos',
    description:
      'Retourne la liste des tutoriels visibles par l\'appelant, filtrés par format, niveau, difficulté, ' +
      'thème, tag, mot-clé ou auteur. Un tutoriel non validé reste invisible sauf à son auteur, aux AP ' +
      '(formateurs qu\'ils animent) et au RP.',
  })
  @ApiResponse({ status: 200, description: 'Liste des tutoriels correspondants' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiHeader({ name: 'x-correlation-id', required: false })
  async search(
    @Query() searchParams: SearchTutorialDto,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.tutorialsService.search(searchParams, currentUser.id, currentUser.role);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.FORMATEUR, UserRole.ANIMATEUR_PEDAGOGIQUE, UserRole.RESPONSABLE_PEDAGOGIQUE)
  @ApiOperation({
    summary: 'Créer un tutoriel',
    description:
      'Crée un tutoriel au format vidéo (videoUrl) ou post (séquence ordonnée de blocs titre/texte/image). ' +
      'Une image de bloc se dépose directement en base64 dans ce même appel (voir GET /tutorials/image-constraints ' +
      'pour les plafonds). Un tutoriel créé par un formateur passe en attente de validation ; un tutoriel créé ' +
      'par un AP ou un RP est auto-validé.',
  })
  @ApiResponse({ status: 201, description: 'Tutoriel créé' })
  @ApiResponse({ status: 400, description: 'Données invalides (format/blocs mal formés, Quizz lié introuvable...)' })
  @ApiResponse({ status: 403, description: 'Rôle insuffisant' })
  @ApiHeader({ name: 'x-correlation-id', required: false })
  async create(
    @Body() createTutorialDto: CreateTutorialDto,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.tutorialsService.create(createTutorialDto, currentUser.id, currentUser.role);
  }

  @Put(':id')
  @Roles(UserRole.FORMATEUR, UserRole.ANIMATEUR_PEDAGOGIQUE, UserRole.RESPONSABLE_PEDAGOGIQUE)
  @ApiOperation({
    summary: 'Modifier un tutoriel',
    description:
      'Remplace intégralement les blocs d\'un tutoriel post. Réservé à son auteur. Un tutoriel édité par son ' +
      'auteur formateur repasse en attente de validation. ATTENTION : les images précédemment envoyées sont ' +
      'supprimées par ce remplacement intégral ; pour les conserver, le front doit les renvoyer explicitement (base64).',
  })
  @ApiParam({ name: 'id', description: 'UUID du tutoriel' })
  @ApiResponse({ status: 200, description: 'Tutoriel modifié' })
  @ApiResponse({ status: 400, description: 'Données invalides' })
  @ApiResponse({ status: 403, description: 'Réservé à l\'auteur du tutoriel' })
  @ApiResponse({ status: 404, description: 'Tutoriel introuvable' })
  @ApiHeader({ name: 'x-correlation-id', required: false })
  async update(
    @Param('id') tutorialId: string,
    @Body() updateTutorialDto: UpdateTutorialDto,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.tutorialsService.update(tutorialId, updateTutorialDto, currentUser.id, currentUser.role);
  }

  @Get('default-title')
  @Roles(UserRole.FORMATEUR, UserRole.ANIMATEUR_PEDAGOGIQUE, UserRole.RESPONSABLE_PEDAGOGIQUE)
  @ApiOperation({
    summary: 'Suggérer un titre par défaut avant création',
    description:
      'À lire par le front à l\'ouverture du formulaire de création, pour pré-remplir le champ titre ' +
      '(obligatoire). Forme "Tutoriel (N)", où N est le nombre de tutoriels déjà créés par l\'appelant, plus un.',
  })
  @ApiResponse({ status: 200, description: 'Titre suggéré', schema: { example: { title: 'Tutoriel (4)' } } })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  async getDefaultTitle(@CurrentUser() currentUser: AuthenticatedUser): Promise<{ title: string }> {
    return this.tutorialsService.getDefaultTitle(currentUser.id);
  }

  @Get('image-constraints')
  @Roles(UserRole.FORMATEUR, UserRole.ANIMATEUR_PEDAGOGIQUE, UserRole.RESPONSABLE_PEDAGOGIQUE)
  @ApiOperation({
    summary: 'Lire les plafonds applicables à une image de bloc',
    description:
      'À lire par le front avant d\'afficher le bouton d\'ajout d\'image : taille maximale en entrée, taille ' +
      'maximale en sortie (après ré-encodage WebP), et taille maximale du corps JSON entier de POST/PUT /tutorials.',
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
    return this.tutorialsService.getImageConstraints();
  }

  @Get('pending-validation')
  @Roles(UserRole.ANIMATEUR_PEDAGOGIQUE, UserRole.RESPONSABLE_PEDAGOGIQUE)
  @ApiOperation({
    summary: 'Lister les tutoriels en attente de validation',
    description:
      'Retourne les tutoriels créés par un professeur, en attente de validation. Un AP ne voit que les ' +
      'tutoriels des formateurs qu\'il anime ; un RP voit tout.',
  })
  @ApiResponse({ status: 200, description: 'Liste des tutoriels en attente de validation' })
  @ApiResponse({ status: 403, description: 'Réservé aux AP et RP' })
  @ApiResponse({ status: 503, description: 'profile-service injoignable' })
  async getPendingValidation(@CurrentUser() currentUser: AuthenticatedUser) {
    return this.tutorialsService.getPendingValidation(currentUser.id, currentUser.role);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Récupérer un tutoriel par son identifiant',
    description:
      'Retourne les métadonnées et le contenu (URL vidéo ou séquence de blocs) du tutoriel. 404 si non trouvé ' +
      'ou non visible pour l\'appelant. Le Quizz lié (linkedQuizId) n\'est renvoyé que s\'il est validated.',
  })
  @ApiParam({ name: 'id', description: 'UUID du tutoriel' })
  @ApiResponse({ status: 200, description: 'Tutoriel trouvé' })
  @ApiResponse({ status: 404, description: 'Tutoriel introuvable ou non visible pour l\'appelant' })
  async findOne(
    @Param('id') tutorialId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.tutorialsService.findOne(tutorialId, currentUser.id, currentUser.role);
  }

  @Get(':id/images/:blockId')
  @ApiOperation({
    summary: 'Télécharger les octets d\'une image de bloc',
    description: 'Revérifie la visibilité du tutoriel parent à chaque téléchargement.',
  })
  @ApiParam({ name: 'id', description: 'UUID du tutoriel' })
  @ApiParam({ name: 'blockId', description: 'UUID du bloc image' })
  @ApiResponse({ status: 200, description: 'Octets de l\'image' })
  @ApiResponse({ status: 404, description: 'Tutoriel ou image introuvable' })
  async downloadBlockImage(
    @Param('id') tutorialId: string,
    @Param('blockId') blockId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const { block, buffer } = await this.tutorialsService.getBlockImageForDownload(
      tutorialId,
      blockId,
      currentUser.id,
      currentUser.role,
    );
    res.set({
      'Content-Type': block.imageMimeType ?? 'application/octet-stream',
      'Content-Length': buffer.length,
    });
    res.send(buffer);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.RESPONSABLE_PEDAGOGIQUE, UserRole.TECHNICIEN_INFORMATIQUE)
  @ApiOperation({
    summary: 'Retirer un tutoriel',
    description: 'Marque le tutoriel comme retiré (REMOVED). Réservé au RP et au TI.',
  })
  @ApiParam({ name: 'id', description: 'UUID du tutoriel' })
  @ApiResponse({ status: 204, description: 'Tutoriel retiré' })
  @ApiResponse({ status: 403, description: 'Rôle insuffisant' })
  @ApiResponse({ status: 404, description: 'Tutoriel introuvable' })
  async remove(
    @Param('id') tutorialId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.tutorialsService.removeTutorial(tutorialId, currentUser.id, currentUser.role);
  }
}
