import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { ChapterService } from './chapter.service';
import { CreateChapterDto } from './dto/create-chapter.dto';
import { UpdateChapterDto } from './dto/update-chapter.dto';

/**
 * Routes chapitres de mémo — étiquettes de classement optionnelles
 *
 * IMPORTANT: Ces routes sont déclarées sous le préfixe 'memos/chapters' pour éviter
 * tout conflit avec le paramètre ':id' de MemoController.
 * Elles doivent être enregistrées AVANT MemoController dans le module.
 *
 * GET    /memos/chapters        → eleve uniquement (liste ses chapitres)
 * POST   /memos/chapters        → eleve uniquement
 * GET    /memos/chapters/:id    → eleve propriétaire + formateur/RP/AP en lecture seule
 * PUT    /memos/chapters/:id    → eleve propriétaire uniquement
 * DELETE /memos/chapters/:id    → eleve propriétaire (mémos → chapterId = null)
 *
 * docs/routes.md — section "Chapitres de mémo".
 */
@ApiTags('memos-chapters')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('memos/chapters')
export class ChapterController {
  constructor(private readonly chapterService: ChapterService) {}

  @Get()
  @Roles(UserRole.ELEVE)
  @ApiOperation({
    summary: 'Lister les chapitres de l\'élève connecté',
    description:
      'Retourne tous les chapitres appartenant à l\'élève connecté (filtre studentId = userId JWT). ' +
      'Tout autre rôle reçoit 403.',
  })
  @ApiResponse({ status: 200, description: 'Liste des chapitres' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: 'Interdit — réservé à l\'élève' })
  findAll(@Req() req: any) {
    return this.chapterService.findByStudent(req.user.id);
  }

  @Post()
  @Roles(UserRole.ELEVE)
  @ApiOperation({
    summary: 'Créer un chapitre',
    description:
      'Crée un chapitre de classement pour l\'élève connecté. ' +
      'Seul l\'élève peut créer ses chapitres (PLOG-BR-003). ' +
      'Un formateur ou RP tentant cette route reçoit 403.',
  })
  @ApiResponse({ status: 201, description: 'Chapitre créé — {id, title, studentId, createdAt}' })
  @ApiResponse({ status: 400, description: 'Erreur de validation' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: 'Interdit — réservé à l\'élève' })
  create(@Body() dto: CreateChapterDto, @Req() req: any) {
    return this.chapterService.create(dto, req.user.id);
  }

  @Get(':id')
  @Roles(
    UserRole.ELEVE,
    UserRole.FORMATEUR,
    UserRole.RESPONSABLE_PEDAGOGIQUE,
    UserRole.ANIMATEUR_PEDAGOGIQUE,
  )
  @ApiParam({ name: 'id', description: 'UUID du chapitre' })
  @ApiOperation({
    summary: 'Détail d\'un chapitre et ses mémos',
    description:
      'Retourne le chapitre et la liste de ses mémos. ' +
      'L\'élève propriétaire peut toujours accéder. ' +
      'Le formateur lié, le RP et l\'AP peuvent lire en lecture seule. ' +
      'Le parent financeur et les autres rôles sont refusés (403).',
  })
  @ApiResponse({ status: 200, description: 'Chapitre trouvé avec ses mémos — {id, title, studentId, createdAt, memos: [Memo]}' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: 'Interdit' })
  @ApiResponse({ status: 404, description: 'Chapitre introuvable' })
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.chapterService.findOne(id, req.user.id, req.user.role);
  }

  @Put(':id')
  @Roles(UserRole.ELEVE)
  @ApiParam({ name: 'id', description: 'UUID du chapitre' })
  @ApiOperation({
    summary: 'Renommer un chapitre',
    description:
      'Seul l\'élève propriétaire peut renommer son chapitre (PLOG-BR-003). ' +
      'Tout autre rôle reçoit 403.',
  })
  @ApiResponse({ status: 200, description: 'Chapitre renommé — {id, title, studentId, createdAt}' })
  @ApiResponse({ status: 400, description: 'Erreur de validation' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: 'Interdit — seul l\'élève propriétaire peut renommer' })
  @ApiResponse({ status: 404, description: 'Chapitre introuvable' })
  update(@Param('id') id: string, @Body() dto: UpdateChapterDto, @Req() req: any) {
    return this.chapterService.update(id, dto, req.user.id);
  }

  @Delete(':id')
  @Roles(UserRole.ELEVE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiParam({ name: 'id', description: 'UUID du chapitre' })
  @ApiOperation({
    summary: 'Supprimer un chapitre',
    description:
      'Supprime le chapitre. Les mémos associés passent à chapterId = null (catégorie "Général"). ' +
      'Seul l\'élève propriétaire peut supprimer (PLOG-BR-003). ' +
      'Tout autre rôle reçoit 403.',
  })
  @ApiResponse({ status: 204, description: 'Chapitre supprimé — mémos passent à chapterId = null' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: 'Interdit — seul l\'élève propriétaire peut supprimer' })
  @ApiResponse({ status: 404, description: 'Chapitre introuvable' })
  remove(@Param('id') id: string, @Req() req: any) {
    return this.chapterService.remove(id, req.user.id);
  }
}
