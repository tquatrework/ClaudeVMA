import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
  Headers,
  Redirect,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiHeader,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { ArchiveService } from './archive.service';
import { AddArchiveLinkDto } from './dto/add-archive-link.dto';
import { ArchiveItemResponseDto } from './dto/archive-item-response.dto';
import { ArchiveTimelineEntryDto } from './dto/archive-timeline-entry.dto';
import { PaginationQueryDto } from './dto/pagination-query.dto';
import { PaginatedResponseDto } from './dto/paginated-response.dto';

@ApiTags('archive-documents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class ArchiveController {
  constructor(private readonly archiveService: ArchiveService) {}

  // ─── GET /students/:studentId/pedagogical-archives ──────────────────────────

  @Get('students/:studentId/pedagogical-archives')
  @ApiOperation({
    summary: 'Lister les archives pédagogiques d\'un élève',
    description:
      'Retourne la liste chronologique paginée des archives pédagogiques d\'un élève. ' +
      'Spec XML fonctionnalité 001 et 007. ' +
      'Accès : élève (ses propres archives), parent financeur (sauf carnet personnel), ' +
      'formateur (élèves rattachés), RP/TI/AF (accès large). ' +
      'Le carnet personnel est automatiquement exclu pour les parents financeurs. ' +
      'Pagination : paramètres page et limit (défaut : page=1, limit=20, max=100).',
  })
  @ApiParam({ name: 'studentId', description: 'UUID de l\'élève' })
  @ApiQuery({ name: 'page', required: false, description: 'Numéro de page (défaut : 1)', type: Number })
  @ApiQuery({ name: 'limit', required: false, description: 'Éléments par page (défaut : 20, max : 100)', type: Number })
  @ApiHeader({ name: 'x-correlation-id', required: false, description: 'Corrélation ID de traçabilité' })
  @ApiResponse({ status: 200, description: 'Liste paginée des archives retournée' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: 'Accès interdit pour ce rôle' })
  listPedagogicalArchives(
    @Param('studentId') studentId: string,
    @Query() paginationQuery: PaginationQueryDto,
    @Req() request: any,
    @Headers('x-correlation-id') _correlationId?: string,
  ): Promise<PaginatedResponseDto<ArchiveItemResponseDto>> {
    return this.archiveService.listPedagogicalArchives(
      studentId,
      request.user.id,
      request.user.role,
      paginationQuery,
    );
  }

  // ─── POST /students/:studentId/archive-links ─────────────────────────────────

  @Post('students/:studentId/archive-links')
  @ApiOperation({
    summary: 'Ajouter un lien archive depuis un service source',
    description:
      'Enregistre un nouveau lien archive pour un élève, fourni par un service source ' +
      '(pedagogical-log-service, video-session-service, content-catalog-service…). ' +
      'Spec XML fonctionnalités 001–006. ' +
      'Supporte une clé d\'idempotence pour les commandes rejouables. ' +
      'Le champ isParentVisible est forcé à false pour les entrées de type carnet_personnel.',
  })
  @ApiParam({ name: 'studentId', description: 'UUID de l\'élève concerné' })
  @ApiHeader({ name: 'x-correlation-id', required: false, description: 'Corrélation ID de traçabilité' })
  @ApiResponse({ status: 201, description: 'Lien archive créé', type: ArchiveItemResponseDto })
  @ApiResponse({ status: 200, description: 'Déjà créé — retour idempotent', type: ArchiveItemResponseDto })
  @ApiResponse({ status: 400, description: 'Erreur de validation' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: 'Accès interdit' })
  @ApiResponse({ status: 409, description: 'Conflit — clé d\'idempotence appartenant à un autre élève' })
  addArchiveLink(
    @Param('studentId') studentId: string,
    @Body() dto: AddArchiveLinkDto,
    @Req() request: any,
    @Headers('x-correlation-id') _correlationId?: string,
  ): Promise<ArchiveItemResponseDto> {
    return this.archiveService.addArchiveLink(studentId, dto, request.user.id, request.user.role);
  }

  // ─── GET /students/:studentId/archive-timeline ───────────────────────────────

  @Get('students/:studentId/archive-timeline')
  @ApiOperation({
    summary: 'Vue calendrier des archives pédagogiques',
    description:
      'Retourne les archives d\'un élève groupées par date d\'occurrence, ' +
      'pour affichage sous forme de calendrier. ' +
      'Spec XML fonctionnalité 001 (vue calendrier). ' +
      'Les mêmes règles d\'accès que la liste s\'appliquent. ' +
      'Le carnet personnel est exclu pour les parents financeurs. ' +
      'La pagination s\'applique sur les groupes de dates.',
  })
  @ApiParam({ name: 'studentId', description: 'UUID de l\'élève' })
  @ApiQuery({ name: 'page', required: false, description: 'Numéro de page (défaut : 1)', type: Number })
  @ApiQuery({ name: 'limit', required: false, description: 'Groupes de dates par page (défaut : 20, max : 100)', type: Number })
  @ApiHeader({ name: 'x-correlation-id', required: false, description: 'Corrélation ID de traçabilité' })
  @ApiResponse({ status: 200, description: 'Vue calendrier paginée retournée', type: [ArchiveTimelineEntryDto] })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: 'Accès interdit pour ce rôle' })
  getArchiveTimeline(
    @Param('studentId') studentId: string,
    @Query() paginationQuery: PaginationQueryDto,
    @Req() request: any,
    @Headers('x-correlation-id') _correlationId?: string,
  ): Promise<PaginatedResponseDto<{ date: string; items: object[] }>> {
    return this.archiveService.getArchiveTimeline(
      studentId,
      request.user.id,
      request.user.role,
      paginationQuery,
    );
  }

  // ─── GET /archive-documents/:id/download ─────────────────────────────────────

  @Get('archive-documents/:id/download')
  @ApiOperation({
    summary: 'Télécharger un document archivé autorisé',
    description:
      'Redirige vers l\'URL de téléchargement du document archivé dans son service source. ' +
      'Spec XML fonctionnalité candidateApi GET /archive-documents/{id}/download. ' +
      'Vérifie les droits d\'accès selon le rôle. ' +
      'Le carnet personnel n\'est jamais accessible aux parents financeurs. ' +
      'Retourne 302 vers downloadUrl si disponible, sinon 404.',
  })
  @ApiParam({ name: 'id', description: 'UUID de l\'élément archive' })
  @ApiHeader({ name: 'x-correlation-id', required: false, description: 'Corrélation ID de traçabilité' })
  @ApiResponse({ status: 302, description: 'Redirection vers l\'URL de téléchargement' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: 'Accès interdit — carnet personnel non accessible au parent' })
  @ApiResponse({ status: 404, description: 'Document non trouvé ou pas de téléchargement disponible' })
  @Redirect()
  async downloadArchiveDocument(
    @Param('id') archiveItemId: string,
    @Req() request: any,
    @Headers('x-correlation-id') _correlationId?: string,
  ): Promise<{ url: string }> {
    const archiveItem = await this.archiveService.getArchiveItemForDownload(
      archiveItemId,
      request.user.id,
      request.user.role,
    );
    return { url: archiveItem.downloadUrl };
  }
}
