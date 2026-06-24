import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { MemoService } from './memo.service';
import { CreateMemoChapterDto } from './dto/create-memo-chapter.dto';
import { CreateMemoItemDto } from './dto/create-memo-item.dto';

/**
 * Mémo élève — outil EXCLUSIVEMENT réservé à l'élève.
 *
 * Routes alignées sur le XML spec candidateApis :
 *   GET  /memos                              → Lister chapitres + items (élève courant)
 *   POST /memos/chapters                     → Créer un chapitre (élève uniquement)
 *   POST /memos/chapters/:chapterId/items    → Ajouter un item (élève uniquement)
 *   GET  /memos/search?q=                    → Recherche dans le mémo (élève uniquement)
 *
 * CRITIQUE XML spec: seul l'élève peut écrire dans son mémo → 403 pour tout autre rôle.
 * XML spec functionality 004, 005, 007.
 */
@ApiTags('memos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('memos')
export class MemoController {
  constructor(private readonly service: MemoService) {}

  /**
   * GET /memos
   * Liste des chapitres et items du mémo — élève courant uniquement.
   * XML spec: "accessible facilement à tout moment, y compris pendant les visios".
   */
  @Get()
  @Roles(UserRole.ELEVE)
  @ApiOperation({
    summary: 'Lister les chapitres et items du mémo',
    description:
      'Retourne tous les chapitres et items du mémo de l\'élève courant. ' +
      'Accessible pendant les visios. ÉLÈVE UNIQUEMENT. ' +
      'XML spec functionality 004, 007.',
  })
  @ApiResponse({ status: 200, description: 'Liste des chapitres avec leurs items' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: 'Réservé à l\'élève uniquement' })
  findChapters(@Req() req: any) {
    // studentId = callerId (l'élève voit son propre mémo)
    return this.service.findChapters(req.user.id, req.user.id, req.user.role);
  }

  /**
   * GET /memos/search?q=
   * Recherche dans le mémo — élève courant uniquement.
   * Doit être déclaré AVANT /memos/chapters/:chapterId pour éviter le conflit de routes.
   */
  @Get('search')
  @Roles(UserRole.ELEVE)
  @ApiQuery({ name: 'q', description: 'Terme de recherche dans le mémo', required: true })
  @ApiOperation({
    summary: 'Rechercher dans le mémo',
    description:
      'Recherche textuelle dans les items du mémo de l\'élève courant. ' +
      'ÉLÈVE UNIQUEMENT. XML spec functionality 005.',
  })
  @ApiResponse({ status: 200, description: 'Items correspondant à la recherche' })
  @ApiResponse({ status: 400, description: 'Paramètre q manquant ou vide' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: 'Réservé à l\'élève uniquement' })
  search(@Query('q') query: string, @Req() req: any) {
    return this.service.search(req.user.id, query, req.user.id, req.user.role);
  }

  /**
   * POST /memos/chapters
   * Créer un chapitre de mémo — élève uniquement.
   * XML spec functionality 004: "chapitres libres créés par l'élève".
   */
  @Post('chapters')
  @Roles(UserRole.ELEVE)
  @ApiOperation({
    summary: 'Créer un chapitre de mémo',
    description:
      'Crée un nouveau chapitre dans le mémo de l\'élève courant. ' +
      'ÉLÈVE UNIQUEMENT — un formateur reçoit 403. XML spec functionality 004.',
  })
  @ApiResponse({ status: 201, description: 'Chapitre créé' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: 'Réservé à l\'élève uniquement' })
  createChapter(@Body() dto: CreateMemoChapterDto, @Req() req: any) {
    return this.service.createChapter(req.user.id, dto, req.user.id, req.user.role);
  }

  /**
   * POST /memos/chapters/:chapterId/items
   * Ajouter un item dans un chapitre — élève uniquement.
   * XML spec functionality 004: "formule, texte court ou image limitée".
   */
  @Post('chapters/:chapterId/items')
  @Roles(UserRole.ELEVE)
  @ApiParam({ name: 'chapterId', description: 'UUID du chapitre de mémo' })
  @ApiOperation({
    summary: 'Ajouter un item dans un chapitre de mémo',
    description:
      'Ajoute un item (texte, formule LaTeX ou image) dans un chapitre du mémo. ' +
      'Images limitées à 500 Ko. ÉLÈVE UNIQUEMENT. XML spec functionality 004.',
  })
  @ApiResponse({ status: 201, description: 'Item ajouté' })
  @ApiResponse({ status: 400, description: 'Validation error ou image trop grande' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: 'Réservé à l\'élève uniquement' })
  @ApiResponse({ status: 404, description: 'Chapitre introuvable' })
  createItem(
    @Param('chapterId') chapterId: string,
    @Body() dto: CreateMemoItemDto,
    @Req() req: any,
  ) {
    return this.service.createItem(chapterId, dto, req.user.id, req.user.role);
  }
}
