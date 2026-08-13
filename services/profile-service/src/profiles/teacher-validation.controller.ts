import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ProfilesService } from './profiles.service';
import {
  PendingTeachersPage,
  TeacherDirectoryService,
} from './teacher-directory.service';
import {
  TeachersPageQueryDto,
  TEACHERS_PAGE_DEFAULT_LIMIT,
  TEACHERS_PAGE_DEFAULT_PAGE,
  TEACHERS_PAGE_MAX_LIMIT,
} from './dto/teachers-page.query.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { UserRole } from '../common/enums/user-role.enum';
import { UpdateTeacherValidationDto } from './dto/update-teacher-validation.dto';

/**
 * Thin HTTP adapter for the formateur-validation and Animateur-Pédagogique
 * promotion sub-resource (PROF-BR-008). Split out of ProfilesController to
 * keep a single coherent resource per file (controllers-convention).
 */
@ApiTags('profiles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('profiles')
export class TeacherValidationController {
  constructor(
    private readonly profilesService: ProfilesService,
    /**
     * La FILE d'attente est servie par `TeacherDirectoryService`, qui porte
     * déjà la liste des formateurs validés : ce sont deux tranches de la même
     * population, et les tenir séparément avait laissé l'une bornée et paginée
     * quand l'autre renvoyait un tableau nu. Le CYCLE de validation
     * (statut, transitions, promotion AP) reste sur `ProfilesService`.
     */
    private readonly teacherDirectoryService: TeacherDirectoryService,
  ) {}

  @Get('teachers/pending-validation')
  @Roles(UserRole.RESPONSABLE_PEDAGOGIQUE)
  @ApiOperation({
    summary: 'Lister les formateurs en attente de validation (file du RP)',
    description:
      'File de travail du responsable pédagogique : les formateurs dont la validation est ' +
      '`pending`, **triés par ancienneté** — le premier inscrit est le premier examiné. ' +
      "Réservée au RP : instruire un dossier de formateur est son métier ; le TI peut " +
      'trancher un dossier ouvert sans avoir à disposer de la file.\n\n' +
      "**Tout formateur y figure dès son inscription** (arbitrage du 2026-08-12) : " +
      "l'enregistrement de validation est créé par le workflow d'onboarding, jamais par une " +
      'lecture. Avant cette correction, la lecture unitaire fabriquait un `pending` de ' +
      "synthèse pour une ligne absente, si bien qu'un formateur pouvait se croire en attente " +
      "d'examen sans apparaître ici — donc sans jamais être examiné.\n\n" +
      '**À ne pas confondre avec `GET /profiles/teachers/validated`**, qui liste les ' +
      'formateurs déjà validés, c\'est-à-dire ceux qu\'on peut solliciter.\n\n' +
      "**LISTE BORNÉE**, même forme et mêmes plafonds que l'annuaire des validés : `page` " +
      `(défaut ${TEACHERS_PAGE_DEFAULT_PAGE}) et \`limit\` (défaut ` +
      `${TEACHERS_PAGE_DEFAULT_LIMIT}, maximum ${TEACHERS_PAGE_MAX_LIMIT}). Un \`limit\` ` +
      "au-dessus du plafond est refusé en `400`, jamais ramené en silence.",
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: `Numéro de page, à partir de 1. Défaut : ${TEACHERS_PAGE_DEFAULT_PAGE}.`,
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
      'Enveloppe `{data, page, limit, total, totalPages}` — jamais un tableau nu. Chaque ' +
      'entrée : `{userId, firstName, lastName, levels, subjects, pendingSince}`. ' +
      "`pendingSince` est la date depuis laquelle le formateur attend (création de " +
      "l'enregistrement de validation, donc son inscription). `levels`/`subjects` valent " +
      '`null` quand le profil pédagogique — facultatif — ne les porte pas ; ' +
      '`firstName`/`lastName` à `null` signalent une incohérence de données journalisée côté ' +
      'serveur, jamais un formateur retiré de la file en silence.',
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
    description: 'Rôle non autorisé — responsable pédagogique seulement',
  })
  listTeachersPendingValidation(
    @Query() query: TeachersPageQueryDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<PendingTeachersPage> {
    return this.teacherDirectoryService.listTeachersPendingValidation(query, actor);
  }

  @Post(':teacherId/ap-status')
  @Roles(UserRole.RESPONSABLE_PEDAGOGIQUE)
  @ApiOperation({
    summary: 'Promote teacher to Animateur Pédagogique',
    description:
      'Sets isAnimateurPedagogique = true on the teacher pedagogical profile (PROF-BR-008). ' +
      'Restricted to RP only. Publishes TeacherPromotedToPedagogicalAnimator event.',
  })
  @ApiParam({ name: 'teacherId', description: 'Teacher (formateur) UUID' })
  @ApiResponse({ status: 201, description: 'Teacher promoted to AP' })
  @ApiResponse({ status: 403, description: 'Forbidden — RP only' })
  promoteToAP(
    @Param('teacherId', ParseUUIDPipe) teacherId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<Awaited<ReturnType<ProfilesService['promoteToAnimateurPedagogique']>>> {
    return this.profilesService.promoteToAnimateurPedagogique(teacherId, actor);
  }

  @Patch(':teacherId/validation')
  @Roles(UserRole.RESPONSABLE_PEDAGOGIQUE, UserRole.TECHNICIEN_INFORMATIQUE)
  @ApiOperation({
    summary: 'Update teacher validation status',
    description:
      'Sets the validation status for a formateur. Allowed transitions:\n' +
      '  pending → in_review : RP only\n' +
      '  in_review → validated or rejected : RP or TI\n' +
      '  pending → validated or rejected : TI only (bypass)\n' +
      'Restricted to RP and TI. Publishes TeacherValidated event when status = validated.',
  })
  @ApiParam({ name: 'teacherId', description: 'Teacher (formateur) UUID' })
  @ApiResponse({ status: 200, description: 'Validation record updated' })
  @ApiResponse({ status: 403, description: 'Forbidden — RP or TI only' })
  updateTeacherValidation(
    @Param('teacherId', ParseUUIDPipe) teacherId: string,
    @Body() dto: UpdateTeacherValidationDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<Awaited<ReturnType<ProfilesService['updateTeacherValidation']>>> {
    return this.profilesService.updateTeacherValidation(teacherId, dto, actor);
  }

  @Get(':teacherId/validation')
  @ApiOperation({
    summary: 'Get teacher validation status',
    description:
      'Returns the current (i.e. most recent) validation record for a formateur — the ' +
      "validation history is an append-only journal since the 2026-08-13 arbitrage. " +
      'Accessible to RP, TI, AdministrateurFinancier and the teacher themselves.\n\n' +
      "When the current status is `rejected`, the response includes `reapplyEligibleAt` " +
      '(ISO date, always a 1st of August at midnight UTC): the date from which the teacher ' +
      'may reapply via `POST /profiles/:teacherId/validation/reapply`. Absent for every ' +
      'other status.',
  })
  @ApiParam({ name: 'teacherId', description: 'Teacher (formateur) UUID' })
  @ApiResponse({ status: 200, description: 'Validation record (current = most recent)' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient rights' })
  getTeacherValidation(
    @Param('teacherId', ParseUUIDPipe) teacherId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<Awaited<ReturnType<ProfilesService['getTeacherValidation']>>> {
    return this.profilesService.getTeacherValidation(teacherId, actor);
  }

  @Post(':teacherId/validation/reapply')
  @ApiOperation({
    summary: 'Reprise de candidature après un refus (self-service)',
    description:
      "Permet au formateur REFUSÉ de relancer lui-même sa candidature, une fois l'échéance " +
      "de reprise atteinte (arbitrage du 2026-08-13, docs/architecture.md > « Reprise de " +
      "candidature après un refus formateur »). Réservée au formateur CONCERNÉ : ni le RP ni " +
      "le TI ne peuvent l'actionner pour un tiers (aucun droit de contournement n'est ouvert " +
      "par cette route — point non tranché, voir le rapport de session).\n\n" +
      'Année scolaire : du 1er août (inclus) au 31 juillet (inclus) de l’année suivante. ' +
      "L'échéance de reprise est le 1er août suivant la fin de l'année scolaire du refus.\n\n" +
      "Crée une NOUVELLE ligne `pending` — la ligne `rejected` précédente n'est jamais " +
      'réécrite ni supprimée : elle reste la preuve que le formateur a été refusé, puis ' +
      'autorisé à se représenter.',
  })
  @ApiParam({ name: 'teacherId', description: 'Teacher (formateur) UUID' })
  @ApiResponse({
    status: 201,
    description: 'Nouvelle candidature créée, statut `pending` (même forme que le GET)',
  })
  @ApiResponse({
    status: 400,
    description:
      "Statut courant différent de `rejected`, ou échéance de reprise pas encore atteinte " +
      '— message français citant la date',
  })
  @ApiResponse({ status: 401, description: 'Sans jeton' })
  @ApiResponse({
    status: 403,
    description: 'Formateur différent de :teacherId — y compris RP et TI',
  })
  reapplyTeacherValidation(
    @Param('teacherId', ParseUUIDPipe) teacherId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<Awaited<ReturnType<ProfilesService['reapplyTeacherValidation']>>> {
    return this.profilesService.reapplyTeacherValidation(teacherId, actor);
  }
}
