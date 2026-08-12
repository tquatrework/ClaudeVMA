import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { UserRole } from '../common/enums/user-role.enum';
import { TeacherDirectoryService, ValidatedTeachersPage } from './teacher-directory.service';
import {
  TeachersPageQueryDto,
  TEACHERS_PAGE_DEFAULT_LIMIT,
  TEACHERS_PAGE_MAX_LIMIT,
} from './dto/teachers-page.query.dto';

/**
 * Adaptateur HTTP de l'ANNUAIRE DES FORMATEURS VALIDÉS (arbitrage du
 * 2026-08-12). Contrôleur dédié plutôt qu'une route de plus sur
 * `TeacherValidationController` : celui-ci porte le CYCLE DE VALIDATION d'un
 * formateur (statut, promotion AP), l'annuaire porte une LISTE de personnes à
 * solliciter. Deux ressources, deux fichiers
 * (`docs/conventions/controllers-convention.md`).
 *
 * CHEMIN — `teachers/validated`, deux segments, et jamais `/profiles/teachers`.
 * Ce dernier entre en collision avec `GET /profiles/:userId` : c'est exactement
 * ce qui faisait répondre `400` (« teachers » n'est pas un UUID) à la tentative
 * du 2026-08-12 relevée dans le hook front. Toute route de liste ajoutée sous
 * `/profiles` doit donc comporter au moins deux segments, comme
 * `teachers/pending-validation` avant elle.
 */
@ApiTags('profiles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('profiles')
export class TeacherDirectoryController {
  constructor(private readonly teacherDirectoryService: TeacherDirectoryService) {}

  @Get('teachers/validated')
  @Roles(
    UserRole.RESPONSABLE_PEDAGOGIQUE,
    UserRole.ADMINISTRATEUR_FINANCIER,
    UserRole.TECHNICIEN_INFORMATIQUE,
  )
  @ApiOperation({
    summary: 'Lister les formateurs validés (annuaire, rôles administratifs)',
    description:
      "Annuaire des formateurs dont la validation est `validated`. Sert à DÉSIGNER les " +
      'formateurs destinataires d\'une proposition à l\'étape 3 du flow « demande de ' +
      'professeur » : sans elle, le responsable pédagogique devrait saisir un UUID, ce que ' +
      "l'arbitrage du 2026-08-09 interdit.\n\n" +
      '**À ne pas confondre avec `GET /profiles/teachers/pending-validation`**, qui liste les ' +
      'formateurs *en attente* — précisément ceux qu\'on ne propose pas.\n\n' +
      '**PÉRIMÈTRE ÉTROIT ET ASSUMÉ** (arbitrage du 2026-08-12) : formateurs *validés* ' +
      'seulement, pour les **rôles administratifs** seulement (RP, AF, TI). Ce n\'est pas ' +
      "l'annuaire global de tous les utilisateurs ; cette question reste ouverte.\n\n" +
      '**CONTENU LIMITÉ AU SOCLE DE VISIBILITÉ** : `userId`, `firstName`, `lastName`, plus ' +
      '`levels` et `subjects`, qui aident à choisir. Rien de plus, bien que les ' +
      'administrateurs soient exemptés du filtrage champ par champ : servir la fiche entière ' +
      'ferait de cette liste une porte dérobée à ce filtrage. Tout autre champ passe par ' +
      '`GET /profiles/:userId`.\n\n' +
      "**LISTE BORNÉE.** `page` (défaut 1) et `limit` (défaut " +
      `${TEACHERS_PAGE_DEFAULT_LIMIT}, maximum ${TEACHERS_PAGE_MAX_LIMIT}). Un ` +
      '`limit` supérieur au plafond est refusé en `400` avec un message en français — il ' +
      "n'est jamais ramené en silence au plafond. Une page au-delà de la dernière renvoie " +
      '`200` avec `data: []`, pas `404` : aucun formateur à cet endroit de la liste n\'est ' +
      'pas une erreur.\n\n' +
      'La recherche par niveau, disponibilités et points reste en **phase 2** : cette route ' +
      "livre une liste, pas un moteur. `userId` sert à désigner le formateur dans l'appel " +
      "suivant ; il n'est jamais affiché (arbitrage du 2026-08-09).",
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
      `Nombre de formateurs par page. Défaut : ${TEACHERS_PAGE_DEFAULT_LIMIT}, ` +
      `maximum : ${TEACHERS_PAGE_MAX_LIMIT}.`,
  })
  @ApiResponse({
    status: 200,
    description:
      'Enveloppe `{data, page, limit, total, totalPages}` — jamais un tableau nu, sans quoi ' +
      'le front ne saurait pas combien de formateurs restent à afficher. Chaque entrée : ' +
      '`{userId, firstName, lastName, levels, subjects}`, triée par nom puis prénom sur ' +
      "l'ensemble de la liste (et non page par page). `levels`/`subjects` valent `null` " +
      'quand le profil pédagogique — facultatif — ne les porte pas ; `firstName`/`lastName` ' +
      'à `null` signalent une incohérence de données journalisée côté serveur, jamais un ' +
      'formateur retiré de la liste en silence. `total` et `totalPages` valent `0` quand ' +
      'aucun formateur validé n\'existe.',
  })
  @ApiResponse({
    status: 400,
    description:
      '`page` ou `limit` non entier, inférieur à 1, ou `limit` au-dessus du plafond ; ' +
      'paramètre de requête inconnu (`forbidNonWhitelisted`)',
  })
  @ApiResponse({ status: 401, description: 'Sans jeton' })
  @ApiResponse({
    status: 403,
    description: 'Rôle non autorisé — RP, AF et TI seulement',
  })
  listValidatedTeachers(
    @Query() query: TeachersPageQueryDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<ValidatedTeachersPage> {
    return this.teacherDirectoryService.listValidatedTeachers(query, actor);
  }
}
