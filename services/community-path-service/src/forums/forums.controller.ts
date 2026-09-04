import {
  Controller,
  Get,
  Post,
  Patch,
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
  StreamableFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiHeader,
  ApiQuery,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { ForumsService } from './forums.service';
import { CreateForumDto } from './dto/create-forum.dto';
import { CreateForumCommentDto } from './dto/create-forum-comment.dto';
import { CreateForumExclusionDto } from './dto/create-forum-exclusion.dto';
import { UpdateForumCharterDto } from './dto/update-forum-charter.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/guards/jwt-auth.guard';
import {
  FORUM_IMAGE_MAX_SIZE_BYTES,
  FORUM_IMAGE_ALLOWED_MIME_TYPES,
} from '../common/constants/forum-image.constants';
import { parsePagination } from '../common/utils/pagination.util';

@ApiTags('forums')
@ApiBearerAuth()
@Controller('forums')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ForumsController {
  constructor(private readonly forumsService: ForumsService) {}

  // ─── Forums ────────────────────────────────────────────────────────────

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Créer un forum',
    description:
      'Crée un nouveau forum, visible immédiatement. Réservé au responsable pédagogique (RP) depuis le 2026-09-04.',
  })
  @ApiResponse({ status: 201, description: 'Forum créé' })
  @ApiResponse({ status: 400, description: 'Données invalides' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: 'Rôle insuffisant (réservé au RP)' })
  @ApiHeader({ name: 'x-correlation-id', required: false })
  async createForum(
    @Body() createForumDto: CreateForumDto,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.forumsService.createForum(createForumDto, currentUser.id, currentUser.role);
  }

  @Get()
  @ApiOperation({
    summary: 'Lister les forums',
    description:
      'Retourne les forums accessibles à l\'appelant : les forums restreints à des rôles auxquels ' +
      'l\'appelant n\'appartient pas ne sont pas retournés (masqués, pas de 403). RP/AF/TI voient tout.',
  })
  @ApiQuery({ name: 'tags', required: false, description: 'Filtre par tags, séparés par virgule' })
  @ApiResponse({ status: 200, description: 'Liste des forums accessibles' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiHeader({ name: 'x-correlation-id', required: false })
  async findAllForums(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Query('tags') tags?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    const tagList = tags ? tags.split(',') : undefined;
    return this.forumsService.findAllForums(currentUser.role, tagList);
  }

  // ─── Charte de bonne conduite ─────────────────────────────────────────

  @Get('charter')
  @ApiOperation({
    summary: 'Lire la charte de bonne conduite',
    description: 'Texte global, unique pour toute la plateforme. Lecture ouverte à tout compte authentifié.',
  })
  @ApiResponse({ status: 200, description: 'Charte courante' })
  @ApiHeader({ name: 'x-correlation-id', required: false })
  async getCharter() {
    return this.forumsService.getCharter();
  }

  @Patch('charter')
  @ApiOperation({
    summary: 'Modifier la charte de bonne conduite',
    description: 'Réservé au RP et au TI. Pas de versionnage : remplace le texte courant.',
  })
  @ApiResponse({ status: 200, description: 'Charte mise à jour' })
  @ApiResponse({ status: 403, description: 'Rôle insuffisant' })
  @ApiHeader({ name: 'x-correlation-id', required: false })
  async updateCharter(
    @Body() dto: UpdateForumCharterDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.forumsService.updateCharter(dto, currentUser.id, currentUser.role);
  }

  @Get('charter/acceptance')
  @ApiOperation({
    summary: 'Consulter mon acceptation de la charte',
    description: 'Indique si l\'utilisateur courant a déjà accepté la charte, et quand.',
  })
  @ApiResponse({ status: 200, description: 'Statut d\'acceptation' })
  @ApiHeader({ name: 'x-correlation-id', required: false })
  async getMyCharterAcceptance(@CurrentUser() currentUser: AuthenticatedUser) {
    return this.forumsService.getCharterAcceptanceStatus(currentUser.id);
  }

  @Post('charter/acceptance')
  @ApiOperation({
    summary: 'Accepter la charte de bonne conduite',
    description:
      'Idempotent : si déjà acceptée, ne réenregistre rien et renvoie 200 avec l\'acceptation existante ; ' +
      'sinon crée l\'acceptation et renvoie 201.',
  })
  @ApiResponse({ status: 201, description: 'Charte acceptée' })
  @ApiResponse({ status: 200, description: 'Charte déjà acceptée précédemment' })
  @ApiHeader({ name: 'x-correlation-id', required: false })
  async acceptCharter(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { status, alreadyAccepted } = await this.forumsService.acceptCharter(currentUser.id);
    res.status(alreadyAccepted ? HttpStatus.OK : HttpStatus.CREATED);
    return status;
  }

  // ─── Image d'illustration ─────────────────────────────────────────────

  @Get('image-constraints')
  @ApiOperation({
    summary: "Contraintes de l'image d'illustration d'un forum",
    description: 'À lire avant l\'affichage du sélecteur de fichier — jamais codé en dur côté front.',
  })
  @ApiResponse({ status: 200, description: 'Contraintes courantes' })
  @ApiHeader({ name: 'x-correlation-id', required: false })
  async getImageConstraints() {
    return {
      maxSizeBytes: FORUM_IMAGE_MAX_SIZE_BYTES,
      allowedMimeTypes: FORUM_IMAGE_ALLOWED_MIME_TYPES,
    };
  }

  // Placée ici (après les routes littérales à un segment `charter` et
  // `image-constraints`), et non juste après `findAllForums` : Express
  // résout les routes dans leur ordre d'enregistrement, une déclaration plus
  // haute de `:id` capturerait ces chemins littéraux comme un identifiant.
  @Get(':id')
  @ApiOperation({
    summary: 'Détail d\'un forum',
    description:
      'Même masquage 404 que GET /forums pour un rôle non autorisé sur ce forum — ne révèle jamais ' +
      "l'existence d'un forum auquel l'appelant n'a pas accès.",
  })
  @ApiParam({ name: 'id', description: 'UUID du forum' })
  @ApiResponse({ status: 200, description: 'Détail du forum' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 404, description: 'Forum introuvable ou non accessible à ce rôle' })
  @ApiHeader({ name: 'x-correlation-id', required: false })
  async findOneForum(
    @Param('id') forumId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.forumsService.getForum(forumId, currentUser.role);
  }

  @Post(':id/image')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @ApiOperation({
    summary: "Téléverser (ou remplacer) l'image d'illustration d'un forum",
    description: 'Réservé au RP. Réencodage systématique, type détecté sur les octets réels, SVG refusé.',
  })
  @ApiParam({ name: 'id', description: 'UUID du forum' })
  @ApiResponse({ status: 200, description: 'Image enregistrée, forum renvoyé' })
  @ApiResponse({ status: 400, description: 'Fichier absent, trop volumineux ou format non supporté' })
  @ApiResponse({ status: 403, description: 'Rôle insuffisant (réservé au RP)' })
  @ApiResponse({ status: 404, description: 'Forum introuvable' })
  @ApiHeader({ name: 'x-correlation-id', required: false })
  async uploadForumImage(
    @Param('id') forumId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    if (!file) {
      throw new BadRequestException('Aucun fichier envoyé (champ attendu : file)');
    }
    if (file.size > FORUM_IMAGE_MAX_SIZE_BYTES) {
      throw new BadRequestException(
        `Fichier trop volumineux (${file.size} octets, limite ${FORUM_IMAGE_MAX_SIZE_BYTES} octets)`,
      );
    }
    return this.forumsService.uploadForumImage(forumId, file.buffer, currentUser.role);
  }

  @Get(':id/image')
  @ApiOperation({
    summary: "Lire l'image d'illustration d'un forum",
    description:
      'Réapplique la restriction de rôle du forum : un forum masqué pour ce rôle masque aussi son image (404, jamais 403).',
  })
  @ApiParam({ name: 'id', description: 'UUID du forum' })
  @ApiResponse({ status: 200, description: 'Contenu binaire de l\'image' })
  @ApiResponse({ status: 404, description: "Forum introuvable, non accessible, ou sans image" })
  @ApiHeader({ name: 'x-correlation-id', required: false })
  async getForumImage(
    @Param('id') forumId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { buffer, mimeType } = await this.forumsService.getForumImage(forumId, currentUser.role);
    res.set({ 'Content-Type': mimeType });
    return new StreamableFile(buffer);
  }

  // ─── Commentaires ──────────────────────────────────────────────────────

  @Post(':id/comments')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Commenter un forum',
    description:
      "Le rôle de l'appelant doit être autorisé sur ce forum, il ne doit pas être exclu, et il doit avoir " +
      'accepté la charte de bonne conduite au préalable (voir POST /forums/charter/acceptance).',
  })
  @ApiParam({ name: 'id', description: 'UUID du forum' })
  @ApiResponse({ status: 201, description: 'Commentaire ajouté' })
  @ApiResponse({
    status: 403,
    description:
      "Exclu du forum, ou charte non acceptée (voir le champ `code: CHARTER_NOT_ACCEPTED` du corps de réponse)",
  })
  @ApiResponse({ status: 404, description: 'Forum introuvable ou non accessible à ce rôle' })
  @ApiHeader({ name: 'x-correlation-id', required: false })
  async addComment(
    @Param('id') forumId: string,
    @Body() createCommentDto: CreateForumCommentDto,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.forumsService.addComment(
      forumId,
      createCommentDto,
      currentUser.id,
      currentUser.role,
    );
  }

  @Get(':id/comments')
  @ApiOperation({
    summary: "Lister les commentaires d'un forum",
    description:
      "Ordre chronologique, du plus ancien au plus récent. Mêmes droits de lecture que le détail " +
      'du forum (même masquage 404). Paginé dès l\'origine, mêmes conventions que le reste du projet ' +
      '(page défaut 1, limit défaut 20, plafond 100).',
  })
  @ApiParam({ name: 'id', description: 'UUID du forum' })
  @ApiQuery({ name: 'page', required: false, description: 'Page, défaut 1' })
  @ApiQuery({ name: 'limit', required: false, description: 'Taille de page, défaut 20, maximum 100' })
  @ApiResponse({ status: 200, description: 'Page de commentaires' })
  @ApiResponse({ status: 400, description: '"page"/"limit" invalide ou "limit" > 100' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 404, description: 'Forum introuvable ou non accessible à ce rôle' })
  @ApiHeader({ name: 'x-correlation-id', required: false })
  async getForumComments(
    @Param('id') forumId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    const pagination = parsePagination(page, limit);
    return this.forumsService.getForumComments(forumId, currentUser.role, pagination);
  }

  @Delete(':id/comments/:commentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Supprimer un commentaire a posteriori',
    description: 'Réservé au RP. Suppression physique, définitive.',
  })
  @ApiParam({ name: 'id', description: 'UUID du forum' })
  @ApiParam({ name: 'commentId', description: 'UUID du commentaire' })
  @ApiResponse({ status: 204, description: 'Commentaire supprimé' })
  @ApiResponse({ status: 403, description: 'Rôle insuffisant (réservé au RP)' })
  @ApiResponse({ status: 404, description: 'Commentaire introuvable sur ce forum' })
  @ApiHeader({ name: 'x-correlation-id', required: false })
  async deleteComment(
    @Param('id') forumId: string,
    @Param('commentId') commentId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<void> {
    return this.forumsService.deleteComment(forumId, commentId, currentUser.role);
  }

  // ─── Exclusions ────────────────────────────────────────────────────────

  @Post(':id/exclusions')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Exclure un membre du forum',
    description: 'Exclut un membre d\'un forum. Réservé au propriétaire du forum ou à un RP.',
  })
  @ApiParam({ name: 'id', description: 'UUID du forum' })
  @ApiResponse({ status: 201, description: 'Membre exclu' })
  @ApiResponse({ status: 400, description: 'Membre déjà exclu' })
  @ApiResponse({ status: 403, description: 'Rôle insuffisant' })
  @ApiResponse({ status: 404, description: 'Forum introuvable' })
  @ApiHeader({ name: 'x-correlation-id', required: false })
  async excludeMember(
    @Param('id') forumId: string,
    @Body() createExclusionDto: CreateForumExclusionDto,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.forumsService.excludeMember(
      forumId,
      createExclusionDto,
      currentUser.id,
      currentUser.role,
    );
  }
}
