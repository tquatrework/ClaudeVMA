import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { UserRole } from '../common/enums/user-role.enum';
import { RoleDirectoryService, RoleDirectoryPage } from './role-directory.service';
import {
  RoleDirectoryPageQueryDto,
  DIRECTORY_ROLES,
  DIRECTORY_PAGE_DEFAULT_LIMIT,
  DIRECTORY_PAGE_MAX_LIMIT,
} from './dto/role-directory-page.query.dto';

/**
 * Adaptateur HTTP de l'ANNUAIRE « VISUALISATION » DU RP (arbitrage du
 * 2026-09-02, `docs/architecture.md` > « Reconstruction du rail gauche du
 * RP », précision après PR #207).
 *
 * CHEMIN — `directory/by-role`, DEUX segments et jamais `/profiles/directory`
 * seul : un segment unique entrerait en collision avec `GET /profiles/:userId`
 * exactement comme `/profiles/teachers` l'avait fait avant l'introduction de
 * `teachers/validated` (arbitrage du 2026-08-12, voir la note en tête de
 * `teacher-directory.controller.ts`) — Express route par NOMBRE DE SEGMENTS,
 * et un chemin à un seul segment sous `/profiles` est structurellement
 * identique à `/profiles/:userId`, quel que soit l'ordre de déclaration des
 * contrôleurs.
 * Déclaré dans `ProfilesModule` avant `ProfilesController` malgré tout, même
 * précaution que l'annuaire formateurs, pour rester robuste si ce chemin à
 * deux segments devait un jour se raccourcir.
 */
@ApiTags('profiles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('profiles')
export class RoleDirectoryController {
  constructor(private readonly roleDirectoryService: RoleDirectoryService) {}

  @Get('directory/by-role')
  @Roles(
    UserRole.RESPONSABLE_PEDAGOGIQUE,
    UserRole.ADMINISTRATEUR_FINANCIER,
    UserRole.TECHNICIEN_INFORMATIQUE,
  )
  @ApiOperation({
    summary: "Annuaire « Visualisation » par rôle (rôles administratifs)",
    description:
      'Liste paginée des utilisateurs `eleve`/`parent_financeur`/`formateur`/' +
      '`animateur_pedagogique`, pour le menu « Visualisation » du RP (tuiles avec liens vers ' +
      'profil/calendrier/cahier de texte). **PÉRIMÈTRE ÉTROIT** : réservée aux rôles ' +
      'administratifs (RP, AF, TI) — ce n\'est pas l\'annuaire global de tous les ' +
      "utilisateurs.\n\n" +
      "**`role: formateur` délègue à `GET /profiles/teachers/validated`** (même annuaire, " +
      "même contenu socle) plutôt que d'en dupliquer la logique.\n\n" +
      "**AUCUN UUID AFFICHABLE** (arbitrage du 2026-08-09) : `userId` est présent mais sert " +
      "uniquement à router vers les écrans liés, jamais à être lu par l'utilisateur.\n\n" +
      `**LISTE BORNÉE.** \`page\` (défaut 1) et \`limit\` (défaut ${DIRECTORY_PAGE_DEFAULT_LIMIT}, ` +
      `maximum ${DIRECTORY_PAGE_MAX_LIMIT}). Un \`limit\` supérieur au plafond est refusé en ` +
      "`400`, jamais ramené en silence au plafond.",
  })
  @ApiQuery({
    name: 'role',
    required: true,
    enum: DIRECTORY_ROLES,
    description: 'Rôle à lister — un seul à la fois.',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Numéro de page, à partir de 1. Défaut : 1.',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description:
      `Nombre d'utilisateurs par page. Défaut : ${DIRECTORY_PAGE_DEFAULT_LIMIT}, ` +
      `maximum : ${DIRECTORY_PAGE_MAX_LIMIT}.`,
  })
  @ApiResponse({
    status: 200,
    description:
      'Enveloppe `{data, page, limit, total, totalPages}`. Chaque entrée : ' +
      '`{userId, firstName, lastName, avatarUrl, level, levels, subjects}` — `level` non nul ' +
      "seulement pour `role=eleve`, `levels` seulement pour `formateur`/`animateur_pedagogique`, " +
      '`subjects` pour ces trois rôles, tous `null` pour `parent_financeur` (aucun bloc ' +
      'pédagogique). Triée par nom puis prénom.',
  })
  @ApiResponse({
    status: 400,
    description:
      '`role` absent ou hors de l\'enum autorisé ; `page`/`limit` invalides ou `limit` ' +
      'au-dessus du plafond',
  })
  @ApiResponse({ status: 401, description: 'Sans jeton' })
  @ApiResponse({ status: 403, description: 'Rôle non autorisé — RP, AF et TI seulement' })
  listByRole(
    @Query() query: RoleDirectoryPageQueryDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<RoleDirectoryPage> {
    return this.roleDirectoryService.listByRole(query, actor);
  }
}
