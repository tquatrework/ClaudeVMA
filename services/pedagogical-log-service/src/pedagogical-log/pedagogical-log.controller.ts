import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Body,
  Param,
  Query,
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
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { PedagogicalLogService } from './pedagogical-log.service';
import { CreateLogDto } from './dto/create-log.dto';
import { CreateSpecialPageDto } from './dto/create-special-page.dto';
import { UpdateLogDto } from './dto/update-log.dto';
import { FindLogsQueryDto } from './dto/find-logs-query.dto';

/**
 * Cahier de texte — routes alignées sur le XML spec candidateApis :
 *
 * GET  /students/:studentId/pedagogical-log              → Lire cahier de texte autorisé
 * POST /students/:studentId/pedagogical-log              → Ajouter page cahier de texte
 * POST /students/:studentId/pedagogical-log/special-pages → Créer page spéciale (RP uniquement)
 * GET  /logs/session/:sessionId                          → Logs d'une séance (filtrés par rôle)
 * GET  /logs/:id                                         → Détail d'un log
 * PATCH /logs/:id                                        → Modifier un log (auteur formateur, ou RP/TI pour les pages spéciales)
 *
 * Routes de lecture complémentaires (legacy, maintenues sans régression) :
 * GET    /pedagogical-logs/student/:studentId → logs d'un élève filtrés par rôle
 * GET    /pedagogical-logs/session/:sessionId → logs d'une séance filtrés par rôle
 * PATCH  /pedagogical-logs/:id               → modify (auteur ou RP/TI) — maintenu pour compatibilité
 *
 * Pages spéciales RP :
 * POST   /students/:studentId/pedagogical-log/special-pages → responsable_pedagogique
 *
 * Règles (refonte du 2026-08-20) :
 * PLOG-RA-003: seul un FORMATEUR peut créer/modifier une entrée normale, et seulement
 *   s'il est titulaire de la relation avec l'élève (vérifié auprès de profile-service).
 *   Le RP n'écrit plus d'entrée normale — il reste lecteur, comme l'élève et le parent.
 * PLOG-RA-001 / PLOG-RA-002: lecture filtrée par visibilité selon rôle.
 * PLOG-FB-003: tout rôle autre que formateur reçoit 403 explicite en écriture.
 */
@ApiTags('pedagogical-log')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class PedagogicalLogController {
  constructor(private readonly service: PedagogicalLogService) {}

  /**
   * POST /students/:studentId/pedagogical-log
   * Formateur titulaire de la relation avec l'élève — seul rôle autorisé à écrire
   * (refonte du 2026-08-20, point 3 : le RP est retiré de cette route).
   */
  @Post('students/:studentId/pedagogical-log')
  @Roles(UserRole.FORMATEUR)
  @ApiParam({ name: 'studentId', description: 'UUID de l\'élève' })
  @ApiOperation({
    summary: 'Ajouter une page de cahier de texte',
    description:
      'Crée une nouvelle page de cahier de texte pour l\'élève spécifié. ' +
      'Réservé au formateur titulaire de la relation avec cet élève (PLOG-RA-003) — ' +
      'le RP, l\'élève et le parent sont en lecture seule sur ces entrées. ' +
      'studentId est dérivé du paramètre de chemin, jamais redemandé dans le corps. ' +
      'PLOG-BR-006: la visibilité contrôle qui peut lire l\'entrée. ' +
      'Le champ hiddenFromStudent masque la page à l\'élève (XML spec func 003).',
  })
  @ApiResponse({ status: 201, description: 'Page créée' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({
    status: 403,
    description: 'Rôle non autorisé à écrire, ou formateur non titulaire de la relation avec cet élève',
  })
  @ApiResponse({ status: 503, description: 'profile-service injoignable — vérification de la relation impossible' })
  createForStudent(
    @Param('studentId') studentId: string,
    @Body() dto: CreateLogDto,
    @Req() req: any,
  ) {
    return this.service.create(studentId, dto, req.user.id, req.user.role);
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
      'Réservé au RP. Crée une page spéciale pouvant être masquée à l\'élève. ' +
      'XML spec func 003: pages spéciales parent/financeur invisibles à l\'élève si hiddenFromStudent=true.',
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
   * Triées de la plus récente à la plus ancienne (par date de séance, puis createdAt).
   * `from`/`to` filtrent optionnellement sur la date de séance (ISO 8601).
   */
  @Get('students/:studentId/pedagogical-log')
  @Roles(
    UserRole.ELEVE,
    UserRole.PARENT_FINANCEUR,
    UserRole.FORMATEUR,
    UserRole.ANIMATEUR_PEDAGOGIQUE,
    UserRole.RESPONSABLE_PEDAGOGIQUE,
    UserRole.TECHNICIEN_INFORMATIQUE,
    UserRole.ADMINISTRATEUR_FINANCIER,
  ) // accès filtré par relation/visibilité dans le service
  @ApiParam({ name: 'studentId', description: 'UUID de l\'élève' })
  @ApiQuery({ name: 'from', required: false, description: 'Filtre : date de séance minimale (ISO 8601)' })
  @ApiQuery({ name: 'to', required: false, description: 'Filtre : date de séance maximale (ISO 8601)' })
  @ApiOperation({
    summary: 'Lire le cahier de texte d\'un élève',
    description:
      'Retourne les pages du cahier de texte, filtrées selon le rôle, triées de la plus ' +
      'récente à la plus ancienne (date de séance, puis date de création). ' +
      'Élève: pages eleve_parent_formateur visibles pour lui (hiddenFromStudent=false). ' +
      'Parent: pages eleve_parent_formateur et parent_formateur, et special (sauf hiddenFromStudent). ' +
      'RP/Formateur/TI/AP: toutes les pages. ' +
      'PLOG-BR-008: les entrées de carnet personnel ne sont jamais retournées ici.',
  })
  @ApiResponse({ status: 200, description: 'Liste des pages (filtrée par visibilité, triée par date)' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  findByStudent(
    @Param('studentId') studentId: string,
    @Query() query: FindLogsQueryDto,
    @Req() req: any,
  ) {
    // S3: un élève ne peut lire que son propre cahier de texte (PLOG-RA-001)
    if (req.user.role === UserRole.ELEVE && req.user.id !== studentId) {
      throw new ForbiddenException(
        "Un élève ne peut consulter que son propre cahier de texte — PLOG-RA-001",
      );
    }
    return this.service.findByStudent(studentId, req.user.role, { from: query.from, to: query.to });
  }

  /**
   * GET /logs/session/:sessionId
   * Logs d'une séance, filtrés par rôle.
   */
  @Get('logs/session/:sessionId')
  @Roles(
    UserRole.ELEVE,
    UserRole.PARENT_FINANCEUR,
    UserRole.FORMATEUR,
    UserRole.ANIMATEUR_PEDAGOGIQUE,
    UserRole.RESPONSABLE_PEDAGOGIQUE,
    UserRole.TECHNICIEN_INFORMATIQUE,
    UserRole.ADMINISTRATEUR_FINANCIER,
  ) // accès filtré par relation/visibilité dans le service
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
  @Roles(
    UserRole.ELEVE,
    UserRole.PARENT_FINANCEUR,
    UserRole.FORMATEUR,
    UserRole.ANIMATEUR_PEDAGOGIQUE,
    UserRole.RESPONSABLE_PEDAGOGIQUE,
    UserRole.TECHNICIEN_INFORMATIQUE,
    UserRole.ADMINISTRATEUR_FINANCIER,
  ) // accès filtré par relation/visibilité dans le service
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
   * Modifier une page. Entrée normale : formateur auteur uniquement (titulaire de la
   * relation). Page spéciale RP : auteur ou RP/TI (mécanisme inchangé, hors périmètre).
   */
  @Patch('logs/:id')
  @Roles(
    UserRole.FORMATEUR,
    UserRole.ANIMATEUR_PEDAGOGIQUE,
    UserRole.RESPONSABLE_PEDAGOGIQUE,
    UserRole.TECHNICIEN_INFORMATIQUE,
  ) // le service applique la restriction fine (formateur auteur pour une entrée normale)
  @ApiParam({ name: 'id', description: 'UUID de la page' })
  @ApiOperation({
    summary: 'Modifier une page du cahier de texte',
    description:
      'Entrée normale : seul le formateur auteur, toujours titulaire de la relation avec ' +
      'l\'élève, peut modifier (PLOG-RA-003, refonte du 2026-08-20). Page spéciale RP : ' +
      'l\'auteur ou un RP/TI (mécanisme inchangé).',
  })
  @ApiResponse({ status: 200, description: 'Page modifiée' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: 'Non autorisé (pas le formateur auteur titulaire de la relation)' })
  @ApiResponse({ status: 404, description: 'Page introuvable' })
  @ApiResponse({ status: 503, description: 'profile-service injoignable — vérification de la relation impossible' })
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
      'Modification partielle — maintenu pour compatibilité. Mêmes règles que ' +
      'PATCH /logs/:id ci-dessus.',
  })
  @ApiResponse({ status: 200, description: 'Entrée modifiée' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: 'Interdit' })
  @ApiResponse({ status: 404, description: 'Entrée introuvable' })
  partialUpdate(@Param('id') id: string, @Body() dto: UpdateLogDto, @Req() req: any) {
    return this.service.update(id, dto, req.user.id, req.user.role);
  }

  /**
   * DELETE /logs/:id
   *
   * Correctif du 2026-08-20 (bug réel signalé par l'orchestrateur, testé contre
   * la gateway réelle) : `api-gateway` ne proxy vers ce service que des chemins
   * sous les préfixes connus `/pedagogical-logs`, `/students`, `/logs` — un
   * chemin nu comme l'ancien `DELETE /:id` (voir ci-dessous, conservé pour
   * compatibilité) n'est structurellement jamais atteignable depuis l'extérieur,
   * quel que soit son code HTTP en direct dans le conteneur. Mirror exact de
   * `PATCH /logs/:id` ci-dessus (même garde, même logique métier déléguée à
   * `service.remove()`) — c'est cette route que le front doit appeler.
   */
  @Delete('logs/:id')
  @Roles(
    UserRole.FORMATEUR,
    UserRole.RESPONSABLE_PEDAGOGIQUE,
  ) // le service applique la restriction fine (formateur auteur titulaire pour une entrée normale)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiParam({ name: 'id', description: 'UUID de l\'entrée' })
  @ApiOperation({
    summary: 'Supprimer une entrée de cahier de texte',
    description:
      'Entrée normale : seul le formateur auteur, toujours titulaire de la relation avec ' +
      'l\'élève, peut supprimer (PLOG-RA-003, correctif du 2026-08-20 — le RP a perdu ce ' +
      'droit, il reste lecteur). Page spéciale RP : l\'auteur ou un RP (mécanisme inchangé).',
  })
  @ApiResponse({ status: 204, description: 'Entrée supprimée' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: 'Interdit (pas le formateur auteur titulaire de la relation)' })
  @ApiResponse({ status: 404, description: 'Entrée introuvable' })
  @ApiResponse({ status: 503, description: 'profile-service injoignable — vérification de la relation impossible (entrée normale)' })
  removeViaLogsPrefix(@Param('id') id: string, @Req() req: any) {
    return this.service.remove(id, req.user.id, req.user.role);
  }

  /**
   * DELETE /:id — alias historique, conservé pour compatibilité. Jamais
   * atteignable depuis l'extérieur via api-gateway (voir DELETE /logs/:id
   * ci-dessus) : ne pas s'y fier pour un appel réel, seulement pour un appel
   * direct au service (tests, autre service interne).
   */
  @Delete(':id')
  @Roles(
    UserRole.FORMATEUR,
    UserRole.RESPONSABLE_PEDAGOGIQUE,
  ) // le service applique la restriction fine (formateur auteur titulaire pour une entrée normale)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiParam({ name: 'id', description: 'UUID de l\'entrée' })
  @ApiOperation({
    summary: 'Supprimer une entrée de cahier de texte (alias historique, non exposé par api-gateway)',
    description:
      'Mêmes règles que DELETE /logs/:id ci-dessus. Conservé pour compatibilité, mais ' +
      'inatteignable depuis l\'extérieur (api-gateway ne proxy pas les chemins nus vers ' +
      'ce service) — DELETE /logs/:id est la route à utiliser.',
  })
  @ApiResponse({ status: 204, description: 'Entrée supprimée' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: 'Interdit (pas le formateur auteur titulaire de la relation)' })
  @ApiResponse({ status: 404, description: 'Entrée introuvable' })
  @ApiResponse({ status: 503, description: 'profile-service injoignable — vérification de la relation impossible (entrée normale)' })
  remove(@Param('id') id: string, @Req() req: any) {
    return this.service.remove(id, req.user.id, req.user.role);
  }
}
