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
  Req,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { MemoService } from './memo.service';
import { CreateMemoChapterDto } from './dto/create-memo-chapter.dto';
import { UpdateMemoChapterDto } from './dto/update-memo-chapter.dto';
import { CreateMemoItemDto } from './dto/create-memo-item.dto';
import { UpdateMemoItemDto } from './dto/update-memo-item.dto';
import { CreateMemoImageItemDto } from './dto/create-memo-image-item.dto';

/**
 * Mémo élève — outil personnel de l'élève (formules, trucs essentiels),
 * organisé par chapitres. Écriture réservée au titulaire élève ; lecture
 * ouverte au titulaire et aux tiers reliés (formateur, RP/AP coordinateur,
 * parent financeur) via `MemoService.assertCanRead` (chantier
 * feat/memo-formules, B3/B5/B6 — voir docs/routes.md > pedagogical-log-service
 * > « Mémo élève »).
 */
@ApiTags('memos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('memos')
export class MemoController {
  constructor(private readonly service: MemoService) {}

  // ─────────────────────────────────────────────────────────────────────
  // Mémo du titulaire connecté
  // ─────────────────────────────────────────────────────────────────────

  @Get()
  @Roles(UserRole.ELEVE)
  @ApiOperation({
    summary: 'Lister les chapitres et items du mémo',
    description:
      "Retourne tous les chapitres et items du mémo de l'élève courant. ÉLÈVE UNIQUEMENT " +
      "(un tiers relié utilise GET /memos/students/:studentId).",
  })
  @ApiResponse({ status: 200, description: 'Liste des chapitres avec leurs items' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: "Réservé à l'élève uniquement" })
  findChapters(@Req() req: any) {
    return this.service.findChapters(req.user.id, req.user.id, req.user.role);
  }

  @Get('search')
  @Roles(UserRole.ELEVE)
  @ApiQuery({ name: 'q', description: 'Terme de recherche dans le mémo', required: true })
  @ApiOperation({
    summary: 'Rechercher dans le mémo',
    description: "Recherche textuelle dans les items du mémo de l'élève courant. ÉLÈVE UNIQUEMENT.",
  })
  @ApiResponse({ status: 200, description: 'Items correspondant à la recherche' })
  @ApiResponse({ status: 400, description: 'Paramètre q manquant ou vide' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: "Réservé à l'élève uniquement" })
  search(@Query('q') query: string, @Req() req: any) {
    return this.service.search(req.user.id, query, req.user.id, req.user.role);
  }

  // ─────────────────────────────────────────────────────────────────────
  // Lecture consolidée pour un tiers relié (B6)
  // ─────────────────────────────────────────────────────────────────────

  @Get('students/:studentId')
  @Roles(
    UserRole.ELEVE,
    UserRole.FORMATEUR,
    UserRole.PARENT_FINANCEUR,
    UserRole.ANIMATEUR_PEDAGOGIQUE,
    UserRole.RESPONSABLE_PEDAGOGIQUE,
    UserRole.TECHNICIEN_INFORMATIQUE,
    UserRole.ADMINISTRATEUR_FINANCIER,
  ) // droit réel vérifié en service par assertCanRead (relation ou administrateur)
  @ApiParam({ name: 'studentId', description: "UUID de l'élève" })
  @ApiOperation({
    summary: "Lire le mémo consolidé d'un élève (tiers relié)",
    description:
      'Même forme que GET /memos, pour un formateur/RP/AP/parent relié à cet élève, ou un ' +
      'administrateur (RP/AF/TI). Vérifié à chaque appel auprès de profile-service, jamais en cache.',
  })
  @ApiResponse({ status: 200, description: 'Liste des chapitres avec leurs items' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: 'Aucune relation avec cet élève' })
  @ApiResponse({ status: 503, description: 'profile-service injoignable' })
  findByStudent(@Param('studentId') studentId: string, @Req() req: any) {
    return this.service.findByStudentForReader(studentId, req.user.id, req.user.role);
  }

  // ─────────────────────────────────────────────────────────────────────
  // Chapitres
  // ─────────────────────────────────────────────────────────────────────

  @Post('chapters')
  @Roles(UserRole.ELEVE)
  @ApiOperation({
    summary: 'Créer un chapitre de mémo',
    description: "Crée un nouveau chapitre dans le mémo de l'élève courant. ÉLÈVE UNIQUEMENT.",
  })
  @ApiResponse({ status: 201, description: 'Chapitre créé' })
  @ApiResponse({ status: 400, description: 'Validation, ou plafond de chapitres atteint' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: "Réservé à l'élève uniquement" })
  createChapter(@Body() dto: CreateMemoChapterDto, @Req() req: any) {
    return this.service.createChapter(req.user.id, dto, req.user.id, req.user.role);
  }

  @Get('chapters/:chapterId')
  @Roles(
    UserRole.ELEVE,
    UserRole.FORMATEUR,
    UserRole.PARENT_FINANCEUR,
    UserRole.ANIMATEUR_PEDAGOGIQUE,
    UserRole.RESPONSABLE_PEDAGOGIQUE,
    UserRole.TECHNICIEN_INFORMATIQUE,
    UserRole.ADMINISTRATEUR_FINANCIER,
  )
  @ApiParam({ name: 'chapterId', description: 'UUID du chapitre de mémo' })
  @ApiOperation({ summary: 'Détail d\'un chapitre et de ses items' })
  @ApiResponse({ status: 200, description: 'Chapitre avec ses items' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: 'Aucune relation avec cet élève' })
  @ApiResponse({ status: 404, description: 'Chapitre introuvable' })
  @ApiResponse({ status: 503, description: 'profile-service injoignable' })
  findOneChapter(@Param('chapterId') chapterId: string, @Req() req: any) {
    return this.service.findOneChapter(chapterId, req.user.id, req.user.role);
  }

  @Put('chapters/:chapterId')
  @Roles(UserRole.ELEVE)
  @ApiParam({ name: 'chapterId', description: 'UUID du chapitre de mémo' })
  @ApiOperation({ summary: 'Renommer un chapitre', description: 'Élève propriétaire uniquement.' })
  @ApiResponse({ status: 200, description: 'Chapitre modifié' })
  @ApiResponse({ status: 400, description: 'Validation' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: 'Réservé au propriétaire' })
  @ApiResponse({ status: 404, description: 'Chapitre introuvable' })
  updateChapter(
    @Param('chapterId') chapterId: string,
    @Body() dto: UpdateMemoChapterDto,
    @Req() req: any,
  ) {
    return this.service.updateChapter(chapterId, dto, req.user.id, req.user.role);
  }

  @Delete('chapters/:chapterId')
  @Roles(UserRole.ELEVE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiParam({ name: 'chapterId', description: 'UUID du chapitre de mémo' })
  @ApiOperation({
    summary: 'Supprimer un chapitre',
    description: 'Élève propriétaire uniquement. Les items du chapitre sont supprimés en cascade.',
  })
  @ApiResponse({ status: 204, description: 'Chapitre supprimé' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: 'Réservé au propriétaire' })
  @ApiResponse({ status: 404, description: 'Chapitre introuvable' })
  removeChapter(@Param('chapterId') chapterId: string, @Req() req: any) {
    return this.service.removeChapter(chapterId, req.user.id, req.user.role);
  }

  // ─────────────────────────────────────────────────────────────────────
  // Items — texte / formule
  // ─────────────────────────────────────────────────────────────────────

  @Post('chapters/:chapterId/items')
  @Roles(UserRole.ELEVE)
  @ApiParam({ name: 'chapterId', description: 'UUID du chapitre de mémo' })
  @ApiOperation({
    summary: 'Ajouter un item texte ou formule',
    description:
      "Élève propriétaire uniquement. Pour une image, utiliser " +
      "POST /memos/chapters/:chapterId/items/image.",
  })
  @ApiResponse({ status: 201, description: 'Item ajouté' })
  @ApiResponse({ status: 400, description: 'Validation, ou plafond d\'items atteint' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: 'Réservé au propriétaire' })
  @ApiResponse({ status: 404, description: 'Chapitre introuvable' })
  createItem(
    @Param('chapterId') chapterId: string,
    @Body() dto: CreateMemoItemDto,
    @Req() req: any,
  ) {
    return this.service.createItem(chapterId, dto, req.user.id, req.user.role);
  }

  @Post('chapters/:chapterId/items/image')
  @Roles(UserRole.ELEVE)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        caption: { type: 'string' },
        order: { type: 'string' },
      },
    },
  })
  @ApiParam({ name: 'chapterId', description: 'UUID du chapitre de mémo' })
  @ApiOperation({
    summary: 'Ajouter un item image',
    description:
      'Élève propriétaire uniquement. Multipart, champ `file`. Type détecté sur les octets ' +
      'réels — liste blanche JPEG/PNG/WebP/GIF, SVG explicitement refusé.',
  })
  @ApiResponse({ status: 201, description: 'Item image ajouté' })
  @ApiResponse({ status: 400, description: 'Fichier absent, format non reconnu, SVG, ou plafond d\'items atteint' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: 'Réservé au propriétaire' })
  @ApiResponse({ status: 404, description: 'Chapitre introuvable' })
  @ApiResponse({ status: 413, description: 'Image trop volumineuse' })
  createImageItem(
    @Param('chapterId') chapterId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreateMemoImageItemDto,
    @Req() req: any,
  ) {
    return this.service.createImageItem(chapterId, file, dto, req.user.id, req.user.role);
  }

  @Get('chapters/:chapterId/items/:itemId/image')
  @Roles(
    UserRole.ELEVE,
    UserRole.FORMATEUR,
    UserRole.PARENT_FINANCEUR,
    UserRole.ANIMATEUR_PEDAGOGIQUE,
    UserRole.RESPONSABLE_PEDAGOGIQUE,
    UserRole.TECHNICIEN_INFORMATIQUE,
    UserRole.ADMINISTRATEUR_FINANCIER,
  )
  @ApiParam({ name: 'chapterId', description: 'UUID du chapitre de mémo' })
  @ApiParam({ name: 'itemId', description: "UUID de l'item image" })
  @ApiOperation({ summary: "Télécharger les octets d'un item image" })
  @ApiResponse({ status: 200, description: 'Octets de l\'image' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: 'Aucune relation avec cet élève' })
  @ApiResponse({ status: 404, description: 'Chapitre ou image introuvable' })
  @ApiResponse({ status: 503, description: 'profile-service injoignable' })
  async downloadImage(
    @Param('chapterId') chapterId: string,
    @Param('itemId') itemId: string,
    @Req() req: any,
    @Res() res: Response,
  ) {
    const { item, buffer } = await this.service.getImageForDownload(
      chapterId,
      itemId,
      req.user.id,
      req.user.role,
    );
    res.set({
      'Content-Type': item.imageMimeType ?? 'application/octet-stream',
      'Content-Length': buffer.length,
    });
    res.send(buffer);
  }

  @Put('chapters/:chapterId/items/:itemId')
  @Roles(UserRole.ELEVE)
  @ApiParam({ name: 'chapterId', description: 'UUID du chapitre de mémo' })
  @ApiParam({ name: 'itemId', description: "UUID de l'item" })
  @ApiOperation({
    summary: 'Modifier un item',
    description:
      'Élève propriétaire uniquement. Le type n\'est pas modifiable ; pour une image, `content` ' +
      "porte la légende — les octets ne se remplacent pas ici.",
  })
  @ApiResponse({ status: 200, description: 'Item modifié' })
  @ApiResponse({ status: 400, description: 'Validation' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: 'Réservé au propriétaire' })
  @ApiResponse({ status: 404, description: 'Chapitre ou item introuvable' })
  updateItem(
    @Param('chapterId') chapterId: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateMemoItemDto,
    @Req() req: any,
  ) {
    return this.service.updateItem(chapterId, itemId, dto, req.user.id, req.user.role);
  }

  @Delete('chapters/:chapterId/items/:itemId')
  @Roles(UserRole.ELEVE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiParam({ name: 'chapterId', description: 'UUID du chapitre de mémo' })
  @ApiParam({ name: 'itemId', description: "UUID de l'item" })
  @ApiOperation({
    summary: 'Supprimer un item',
    description: 'Élève propriétaire uniquement. Supprime aussi le fichier image associé le cas échéant.',
  })
  @ApiResponse({ status: 204, description: 'Item supprimé' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: 'Réservé au propriétaire' })
  @ApiResponse({ status: 404, description: 'Chapitre ou item introuvable' })
  removeItem(
    @Param('chapterId') chapterId: string,
    @Param('itemId') itemId: string,
    @Req() req: any,
  ) {
    return this.service.removeItem(chapterId, itemId, req.user.id, req.user.role);
  }
}
