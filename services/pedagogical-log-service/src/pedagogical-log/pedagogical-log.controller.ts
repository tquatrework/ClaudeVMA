import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Body,
  Param,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  ForbiddenException,
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
import { PedagogicalLogService } from './pedagogical-log.service';
import { CreateLogDto } from './dto/create-log.dto';
import { CreateSpecialPageDto } from './dto/create-special-page.dto';
import { UpdateLogDto } from './dto/update-log.dto';

/**
 * Cahier de texte — routes alignées sur le XML spec candidateApis :
 *
 * GET  /students/:studentId/pedagogical-log              → Lire cahier de texte autorisé
 * POST /students/:studentId/pedagogical-log              → Ajouter page cahier de texte
 * POST /students/:studentId/pedagogical-log/special-pages → Créer page spéciale (RP uniquement)
 * GET  /logs/session/:sessionId                          → Logs d'une séance (filtrés par rôle)
 * GET  /logs/:id                                         → Détail d'un log
 * PATCH /logs/:id                                        → Modifier un log (auteur ou RP/TI)
 *
 * Routes de lecture complémentaires (legacy, maintenues sans régression) :
 * GET    /pedagogical-logs/student/:studentId → logs d'un élève filtrés par rôle
 * GET    /pedagogical-logs/session/:sessionId → logs d'une séance filtrés par rôle
 * PATCH  /pedagogical-logs/:id               → modify (auteur ou RP/TI) — maintenu pour compatibilité
 *
 * Pages spéciales RP :
 * POST   /students/:studentId/pedagogical-log/special-pages → responsable_pedagogique
 *
 * Règles :
 * PLOG-RA-003 / PLOG-RA-004: seuls formateur et RP peuvent créer.
 * PLOG-RA-001 / PLOG-RA-002: lecture filtrée par visibilité selon rôle.
 * PLOG-FB-003: formateur non lié ne doit pas écrire (délégué au profile-service).
 */
@ApiTags('pedagogical-log')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class PedagogicalLogController {
  constructor(private readonly service: PedagogicalLogService) {}

  /**
   * POST /students/:studentId/pedagogical-log
   * Formateur ou RP — ajouter une page de cahier de texte pour un élève lié.
   */
  @Post('students/:studentId/pedagogical-log')
  @Roles(
    UserRole.FORMATEUR,
    UserRole.RESPONSABLE_PEDAGOGIQUE,
  )
  @ApiParam({ name: 'studentId', description: 'UUID de l\'élève' })
  @ApiOperation({
    summary: 'Ajouter une page de cahier de texte',
    description:
      'Crée une nouvelle page de cahier de texte pour l\'élève spécifié. ' +
      'PLOG-RA-003: formateur peut écrire. PLOG-RA-004: RP peut écrire. ' +
      'PLOG-BR-006: la visibilité contrôle qui peut lire l\'entrée. ' +
      'Le champ hiddenFromStudent masque la page à l\'élève (XML spec func 003).',
  })
  @ApiResponse({ status: 201, description: 'Page créée' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: 'Rôle non autorisé à écrire' })
  createForStudent(
    @Param('studentId') studentId: string,
    @Body() dto: CreateLogDto,
    @Req() req: any,
  ) {
    // Override studentId from path param (canonical source of truth)
    return this.service.create({ ...dto, studentId }, req.user.id, req.user.role);
  }

  /**
   * POST /students/:studentId/pedagogical-log/special-pages
   * RP uniquement — créer une page spéciale avec visibilité contrôlée.
   * XML spec functionality 003: pages spéciales parent/financeur non visibles par l'élève si choisies.
   */
  @Post('students/:studentId/pedagogical-log/special-pages')
  @Roles(UserRole.RESPONSABLE_PEDAGOGIQUE)
  @ApiParam({ name: 'studentId', description: 'UUID de l\'élève' })
  @ApiOperation({
    summary: 'Créer une page spéciale (RP uniquement)',
    description:
      'Crée une page spéciale dans le cahier de texte, avec contrôle de visibilité. ' +
      'hiddenFromStudent=true rend la page invisible à l\'élève (ex: communication parent). ' +
      'XML spec functionality 003.',
  })
  @ApiResponse({ status: 201, description: 'Page spéciale créée' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: 'Réservé au Responsable Pédagogique' })
  createSpecialPage(
    @Param('studentId') studentId: string,
    @Body() dto: CreateSpecialPageDto,
    @Req() req: any,
  ) {
    return this.service.createSpecialPage(studentId, dto, req.user.id, req.user.role);
  }

  /**
   * GET /students/:studentId/pedagogical-log
   * Lire les pages du cahier de texte, filtrées selon le rôle du demandeur.
   */
  @Get('students/:studentId/pedagogical-log')
  @ApiParam({ name: 'studentId', description: 'UUID de l\'élève' })
  @ApiOperation({
    summary: 'Lire le cahier de texte d\'un élève',
    description:
      'Retourne les pages du cahier de texte, filtrées selon le rôle. ' +
      'Élève: pages visibles pour lui (hiddenFromStudent=false). ' +
      'Parent: pages eleve_parent_formateur et special (sauf hiddenFromStudent). ' +
      'RP/Formateur/TI: toutes les pages. ' +
      'PLOG-BR-008: les entrées de carnet personnel ne sont jamais retournées ici.',
  })
  @ApiResponse({ status: 200, description: 'Liste des pages (filtrée par visibilité)' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  findByStudent(@Param('studentId') studentId: string, @Req() req: any) {
    // S3: un élève ne peut lire que son propre cahier de texte (PLOG-RA-001)
    if (req.user.role === UserRole.ELEVE && req.user.id !== studentId) {
      throw new ForbiddenException(
        "Un élève ne peut consulter que son propre cahier de texte — PLOG-RA-001",
      );
    }
    return this.service.findByStudent(studentId, req.user.role);
  }

  /**
   * GET /logs/session/:sessionId
   * Logs d'une séance, filtrés par rôle.
   */
  @Get('logs/session/:sessionId')
  @ApiParam({ name: 'sessionId', description: 'UUID de la session' })
  @ApiOperation({
    summary: 'Logs d\'une séance',
    description: 'Retourne toutes les pages de cahier de texte liées à une session, filtrées par rôle.',
  })
  @ApiResponse({ status: 200, description: 'Liste des pages' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  findBySession(@Param('sessionId') sessionId: string, @Req() req: any) {
    return this.service.findBySession(sessionId, req.user.role);
  }

  /**
   * GET /logs/:id
   * Détail d'une page.
   */
  @Get('logs/:id')
  @ApiParam({ name: 'id', description: 'UUID de la page' })
  @ApiOperation({ summary: 'Détail d\'une page du cahier de texte' })
  @ApiResponse({ status: 200, description: 'Page trouvée' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: 'Visibilité non autorisée pour ce rôle' })
  @ApiResponse({ status: 404, description: 'Page introuvable' })
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.service.findOne(id, req.user.role);
  }

  /**
   * PATCH /logs/:id
   * Modifier une page (auteur ou RP/TI).
   */
  @Patch('logs/:id')
  @ApiParam({ name: 'id', description: 'UUID de la page' })
  @ApiOperation({
    summary: 'Modifier une page du cahier de texte',
    description: 'Seuls l\'auteur original, un RP ou un TI peuvent modifier une page.',
  })
  @ApiResponse({ status: 200, description: 'Page modifiée' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: 'Non autorisé (pas l\'auteur)' })
  @ApiResponse({ status: 404, description: 'Page introuvable' })
  update(@Param('id') id: string, @Body() dto: UpdateLogDto, @Req() req: any) {
    return this.service.update(id, dto, req.user.id, req.user.role);
  }

  @Patch(':id')
  @Roles(
    UserRole.FORMATEUR,
    UserRole.RESPONSABLE_PEDAGOGIQUE,
    UserRole.TECHNICIEN_INFORMATIQUE,
  )
  @ApiParam({ name: 'id', description: 'UUID de l\'entrée' })
  @ApiOperation({
    summary: 'Modifier partiellement une entrée de cahier de texte (PATCH)',
    description:
      'Modification partielle — maintenu pour compatibilité. ' +
      'Seul l\'auteur original, un RP ou un TI peut modifier.',
  })
  @ApiResponse({ status: 200, description: 'Entrée modifiée' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: 'Interdit — pas l\'auteur' })
  @ApiResponse({ status: 404, description: 'Entrée introuvable' })
  partialUpdate(@Param('id') id: string, @Body() dto: UpdateLogDto, @Req() req: any) {
    return this.service.update(id, dto, req.user.id, req.user.role);
  }

  @Delete(':id')
  @Roles(
    UserRole.FORMATEUR,
    UserRole.RESPONSABLE_PEDAGOGIQUE,
  )
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiParam({ name: 'id', description: 'UUID de l\'entrée' })
  @ApiOperation({
    summary: 'Supprimer une entrée de cahier de texte',
    description:
      'L\'auteur peut supprimer sa propre entrée. ' +
      'Le RP peut supprimer n\'importe quelle entrée.',
  })
  @ApiResponse({ status: 204, description: 'Entrée supprimée' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: 'Interdit' })
  @ApiResponse({ status: 404, description: 'Entrée introuvable' })
  remove(@Param('id') id: string, @Req() req: any) {
    return this.service.remove(id, req.user.id, req.user.role);
  }
}
