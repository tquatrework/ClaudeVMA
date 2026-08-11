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
import { Roles } from '../common/decorators/roles.decorator';
import { OwnerAccess } from '../common/decorators/owner-access.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { ArchiveService } from './archive.service';
import { AddArchiveLinkDto } from './dto/add-archive-link.dto';
import { ArchiveItemResponseDto } from './dto/archive-item-response.dto';
import { PaginationQueryDto } from './dto/pagination-query.dto';
import { PaginatedResponseDto } from './dto/paginated-response.dto';

/**
 * Description commune des droits de lecture, reprise dans chaque `ApiOperation`
 * pour que Swagger dise la règle réelle et non une liste de rôles périmée.
 */
const READ_ACCESS_DESCRIPTION =
  'DROITS — pilotés par la RELATION, jamais par une liste de rôles (arbitrage du 2026-08-11). ' +
  'Accèdent aux archives pédagogiques d\'une personne : elle-même ; les administrateurs ' +
  '(RP, AF, TI, sans distinction pour l\'instant) ; son formateur ; son parent financeur ; ' +
  'son coordinateur pédagogique ; l\'AP qui l\'anime lorsqu\'elle est formatrice. ' +
  'REFUSÉ dans le sens inverse : un élève et le parent de cet élève voient les STATISTIQUES ' +
  'du formateur (profile-service) mais PAS ses archives pédagogiques — elles portent son ' +
  'historique d\'exercice, elles ne regardent pas ses élèves. ' +
  'Les relations sont demandées à profile-service, unique propriétaire ; ce service n\'en ' +
  'tient aucune copie.';

const NOT_FOUND_DESCRIPTION =
  'Aucune archive, OU aucune relation ouvrant ce droit — les deux cas sont volontairement ' +
  'indiscernables, même message : un 403 révélerait l\'existence de ce qu\'on refuse de montrer ' +
  '(arbitrage du 2026-08-11, point 5). Cette route ne renvoie donc jamais 403 en lecture.';

@ApiTags('archives')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('archives')
export class ArchiveController {
  constructor(private readonly archiveService: ArchiveService) {}

  // ─── GET /archives/students/:studentId/pedagogical-archives ─────────────────

  @Get('students/:studentId/pedagogical-archives')
  @OwnerAccess()
  @ApiOperation({
    summary: 'Lister les archives pédagogiques d\'une personne',
    description:
      'Retourne la liste chronologique paginée des archives pédagogiques du titulaire désigné. ' +
      'Spec XML fonctionnalités 001 et 007. ' +
      READ_ACCESS_DESCRIPTION +
      ' Le carnet personnel est exclu pour le parent financeur. ' +
      'Pagination : paramètres page et limit (défaut : page=1, limit=20, max=100).',
  })
  @ApiParam({
    name: 'studentId',
    description:
      'UUID du TITULAIRE des archives. Élève dans la quasi-totalité des cas ; formateur ' +
      'lorsqu\'un AP consulte les archives d\'un formateur qu\'il anime.',
  })
  @ApiQuery({ name: 'page', required: false, description: 'Numéro de page (défaut : 1)', type: Number })
  @ApiQuery({ name: 'limit', required: false, description: 'Éléments par page (défaut : 20, max : 100)', type: Number })
  @ApiHeader({ name: 'x-correlation-id', required: false, description: 'Corrélation ID de traçabilité' })
  @ApiResponse({
    status: 200,
    description: 'Liste paginée des archives retournée',
    type: PaginatedResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 404, description: NOT_FOUND_DESCRIPTION })
  @ApiResponse({
    status: 503,
    description:
      'profile-service injoignable : les relations n\'ont pas pu être vérifiées. On échoue ' +
      'bruyamment plutôt que de deviner un droit.',
  })
  listPedagogicalArchives(
    @Param('studentId') archiveOwnerId: string,
    @Query() paginationQuery: PaginationQueryDto,
    @Req() request: any,
    @Headers('x-correlation-id') correlationId?: string,
  ): Promise<PaginatedResponseDto<ArchiveItemResponseDto>> {
    return this.archiveService.listPedagogicalArchives(
      archiveOwnerId,
      request.user.id,
      request.user.role,
      paginationQuery,
      correlationId,
    );
  }

  // ─── POST /archives/students/:studentId/archive-links ────────────────────────

  @Post('students/:studentId/archive-links')
  @Roles(
    UserRole.FORMATEUR,
    UserRole.ANIMATEUR_PEDAGOGIQUE,
    UserRole.RESPONSABLE_PEDAGOGIQUE,
    UserRole.TECHNICIEN_INFORMATIQUE,
    UserRole.ADMINISTRATEUR_FINANCIER,
  )
  @ApiOperation({
    summary: 'Ajouter un lien archive depuis un service source',
    description:
      'Enregistre un nouveau lien archive pour un titulaire, fourni par un service source ' +
      '(pedagogical-log-service, video-session-service, content-catalog-service…). ' +
      'Spec XML fonctionnalités 001–006. ' +
      'DROITS : liste de rôles explicite (formateur, AP, RP, TI, AF) et non relation — une ' +
      'relation ouvre la lecture, jamais l\'écriture (arbitrage du 2026-08-07). ' +
      'Supporte une clé d\'idempotence pour les commandes rejouables. ' +
      'Le champ isParentVisible est forcé à false pour les entrées de type carnet_personnel.',
  })
  @ApiParam({ name: 'studentId', description: 'UUID du titulaire des archives' })
  @ApiHeader({ name: 'x-correlation-id', required: false, description: 'Corrélation ID de traçabilité' })
  @ApiResponse({ status: 201, description: 'Lien archive créé', type: ArchiveItemResponseDto })
  @ApiResponse({ status: 200, description: 'Déjà créé — retour idempotent', type: ArchiveItemResponseDto })
  @ApiResponse({ status: 400, description: 'Erreur de validation' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: 'Rôle non autorisé à écrire dans les archives' })
  @ApiResponse({ status: 409, description: 'Conflit — clé d\'idempotence appartenant à un autre titulaire' })
  addArchiveLink(
    @Param('studentId') archiveOwnerId: string,
    @Body() dto: AddArchiveLinkDto,
    @Req() request: any,
    @Headers('x-correlation-id') _correlationId?: string,
  ): Promise<ArchiveItemResponseDto> {
    return this.archiveService.addArchiveLink(archiveOwnerId, dto, request.user.role);
  }

  // ─── GET /archives/students/:studentId/archive-timeline ──────────────────────

  @Get('students/:studentId/archive-timeline')
  @OwnerAccess()
  @ApiOperation({
    summary: 'Vue calendrier des archives pédagogiques',
    description:
      'Retourne les archives d\'un titulaire groupées par date d\'occurrence, ' +
      'pour affichage sous forme de calendrier. ' +
      'Spec XML fonctionnalité 001 (vue calendrier). ' +
      READ_ACCESS_DESCRIPTION +
      ' Le carnet personnel est exclu pour le parent financeur. ' +
      'La pagination s\'applique sur les groupes de dates.',
  })
  @ApiParam({ name: 'studentId', description: 'UUID du titulaire des archives' })
  @ApiQuery({ name: 'page', required: false, description: 'Numéro de page (défaut : 1)', type: Number })
  @ApiQuery({ name: 'limit', required: false, description: 'Groupes de dates par page (défaut : 20, max : 100)', type: Number })
  @ApiHeader({ name: 'x-correlation-id', required: false, description: 'Corrélation ID de traçabilité' })
  @ApiResponse({
    status: 200,
    description: 'Vue calendrier paginée retournée',
    type: PaginatedResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 404, description: NOT_FOUND_DESCRIPTION })
  @ApiResponse({ status: 503, description: 'profile-service injoignable' })
  getArchiveTimeline(
    @Param('studentId') archiveOwnerId: string,
    @Query() paginationQuery: PaginationQueryDto,
    @Req() request: any,
    @Headers('x-correlation-id') correlationId?: string,
  ): Promise<PaginatedResponseDto<{ date: string; items: object[] }>> {
    return this.archiveService.getArchiveTimeline(
      archiveOwnerId,
      request.user.id,
      request.user.role,
      paginationQuery,
      correlationId,
    );
  }
}

/**
 * Le téléchargement vit sous `/documents`, préfixe distinct exposé par la
 * gateway (`/api/v1/documents`). Deux préfixes, donc deux contrôleurs : Nest ne
 * sait pas mélanger deux racines dans une même classe.
 */
@ApiTags('archives')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('documents')
export class ArchiveDocumentController {
  constructor(private readonly archiveService: ArchiveService) {}

  // ─── GET /documents/:id/download ─────────────────────────────────────────────

  @Get(':id/download')
  @OwnerAccess()
  @ApiOperation({
    summary: 'Télécharger un document archivé autorisé',
    description:
      'Redirige (302) vers l\'URL de téléchargement du document archivé dans son service source. ' +
      READ_ACCESS_DESCRIPTION +
      ' Le carnet personnel n\'est jamais accessible au parent financeur. ' +
      'Tous les refus répondent le même 404 avec le même message que l\'absence de document.',
  })
  @ApiParam({ name: 'id', description: 'UUID de l\'élément archive' })
  @ApiHeader({ name: 'x-correlation-id', required: false, description: 'Corrélation ID de traçabilité' })
  @ApiResponse({ status: 302, description: 'Redirection vers l\'URL de téléchargement' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({
    status: 404,
    description:
      'Document introuvable, aucune relation ouvrant ce droit, carnet personnel demandé par un ' +
      'parent financeur, ou aucune URL de téléchargement — quatre cas, un seul message.',
  })
  @ApiResponse({ status: 503, description: 'profile-service injoignable' })
  @Redirect()
  async downloadArchiveDocument(
    @Param('id') archiveItemId: string,
    @Req() request: any,
    @Headers('x-correlation-id') correlationId?: string,
  ): Promise<{ url: string }> {
    const archiveItem = await this.archiveService.getArchiveItemForDownload(
      archiveItemId,
      request.user.id,
      request.user.role,
      correlationId,
    );
    return { url: archiveItem.downloadUrl };
  }
}
