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
import { UpdateLogDto } from './dto/update-log.dto';
import { CreateSpecialPageDto } from './dto/create-special-page.dto';

/**
 * Routes cahier de texte — tenu par le formateur ou le RP, lisible selon le rôle.
 *
 * GET    /pedagogical-logs               → formateur, RP, AP, eleve, parent_financeur
 * POST   /pedagogical-logs               → formateur, responsable_pedagogique
 * GET    /pedagogical-logs/:id           → selon visibilité et rôle
 * PUT    /pedagogical-logs/:id           → auteur uniquement
 * DELETE /pedagogical-logs/:id           → auteur + responsable_pedagogique
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
 * PLOG-BR-006: visibilité différenciée (formateur_rp invisible au parent et à l'élève).
 * PLOG-FB-003: formateur non lié ne doit pas écrire (vérifié côté service métier).
 */
@ApiTags('pedagogical-logs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('pedagogical-logs')
export class PedagogicalLogController {
  constructor(private readonly service: PedagogicalLogService) {}

  @Post()
  @Roles(
    UserRole.FORMATEUR,
    UserRole.RESPONSABLE_PEDAGOGIQUE,
  )
  @ApiOperation({
    summary: 'Créer une entrée de cahier de texte',
    description:
      'Enregistre une entrée pédagogique après une séance. ' +
      'PLOG-RA-003: le formateur peut écrire. PLOG-RA-004: le RP peut écrire. ' +
      'PLOG-BR-006: la visibilité contrôle qui peut lire l\'entrée.',
  })
  @ApiResponse({ status: 201, description: 'Entrée créée' })
  @ApiResponse({ status: 400, description: 'Erreur de validation' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: 'Interdit — rôle non autorisé à écrire' })
  create(@Body() dto: CreateLogDto, @Req() req: any) {
    return this.service.create(dto, req.user.id, req.user.role);
  }

  @Get()
  @Roles(
    UserRole.FORMATEUR,
    UserRole.RESPONSABLE_PEDAGOGIQUE,
    UserRole.ANIMATEUR_PEDAGOGIQUE,
    UserRole.ELEVE,
    UserRole.PARENT_FINANCEUR,
  )
  @ApiOperation({
    summary: 'Lister les entrées du cahier de texte',
    description:
      'Retourne les entrées visibles selon le rôle appelant. ' +
      'L\'élève ne voit pas les pages formateur_rp ni les pages hiddenFromStudent. ' +
      'Le parent ne voit que les pages de visibilité eleve_parent_formateur.',
  })
  @ApiResponse({ status: 200, description: 'Liste des entrées (filtrée par rôle)' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: 'Interdit' })
  findAll(@Req() req: any) {
    return this.service.findAll(req.user.role);
  }

  @Get('student/:studentId')
  @ApiParam({ name: 'studentId', description: 'UUID de l\'élève' })
  @ApiOperation({
    summary: 'Lister les entrées cahier d\'un élève',
    description:
      'Retourne les entrées de cahier de texte pour un élève donné, filtrées par le rôle appelant. ' +
      'PLOG-RA-001: l\'élève voit les pages autorisées. ' +
      'PLOG-RA-002: le parent_financeur voit uniquement les pages eleve_parent_formateur. ' +
      'PLOG-BR-008: les entrées de carnet personnel ne sont jamais retournées ici.',
  })
  @ApiResponse({ status: 200, description: 'Liste des entrées (filtrée par visibilité)' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  findByStudent(@Param('studentId') studentId: string, @Req() req: any) {
    return this.service.findByStudent(studentId, req.user.role);
  }

  @Get('session/:sessionId')
  @ApiParam({ name: 'sessionId', description: 'UUID de la session visio' })
  @ApiOperation({
    summary: 'Lister les entrées cahier d\'une séance',
    description: 'Retourne toutes les entrées pour une séance donnée, filtrées par rôle.',
  })
  @ApiResponse({ status: 200, description: 'Liste des entrées' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  findBySession(@Param('sessionId') sessionId: string, @Req() req: any) {
    return this.service.findBySession(sessionId, req.user.role);
  }

  @Get(':id')
  @Roles(
    UserRole.FORMATEUR,
    UserRole.RESPONSABLE_PEDAGOGIQUE,
    UserRole.ANIMATEUR_PEDAGOGIQUE,
    UserRole.ELEVE,
    UserRole.PARENT_FINANCEUR,
  )
  @ApiParam({ name: 'id', description: 'UUID de l\'entrée' })
  @ApiOperation({
    summary: 'Lire une entrée de cahier de texte',
    description:
      'Retourne une entrée selon la visibilité et le rôle. ' +
      'PLOG-BR-006: un parent ne peut pas lire une page formateur_rp → 403. ' +
      'XML spec func 003: un élève ne peut pas lire une page hiddenFromStudent → 403.',
  })
  @ApiResponse({ status: 200, description: 'Entrée trouvée' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: 'Interdit — règle de visibilité bloque l\'accès' })
  @ApiResponse({ status: 404, description: 'Entrée introuvable' })
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.service.findOne(id, req.user.role);
  }

  @Put(':id')
  @Roles(
    UserRole.FORMATEUR,
    UserRole.RESPONSABLE_PEDAGOGIQUE,
  )
  @ApiParam({ name: 'id', description: 'UUID de l\'entrée' })
  @ApiOperation({
    summary: 'Modifier une entrée de cahier de texte',
    description:
      'Seul l\'auteur original peut modifier. ' +
      'Le RP peut également modifier n\'importe quelle entrée.',
  })
  @ApiResponse({ status: 200, description: 'Entrée modifiée' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: 'Interdit — pas l\'auteur' })
  @ApiResponse({ status: 404, description: 'Entrée introuvable' })
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
