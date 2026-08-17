import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiExcludeController, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { InternalGuard } from './internal.guard';
import { InternalService } from './internal.service';
import { DisplayName, DisplayNameBatch } from './display-name';
import { ResolveDisplayNamesDto } from './dto/resolve-display-names.dto';
import { CreateAdministrativeProfileDto } from './dto/create-administrative-profile.dto';
import { CreateStudentProfilesDto } from './dto/create-student-profiles.dto';
import { CreateTeacherProfilesDto } from './dto/create-teacher-profiles.dto';
import { LinkParentDto } from './dto/link-parent.dto';
import { CreateTeacherStudentRelationDto } from './dto/create-teacher-student-relation.dto';
import { EnsureTeacherValidationsDto } from './dto/ensure-teacher-validations.dto';
import { LinkCoordinatorDto } from './dto/link-coordinator.dto';
import { ResolveRelationQueryDto } from './dto/resolve-relation.query.dto';

/**
 * System-to-system routes consumed by orchestration-service during account
 * onboarding, et depuis le 2026-08-12 par teacher-request-service pour le flow
 * « demande de professeur ». Protected by InternalGuard (X-Internal-Secret)
 * instead of the JWT guard — there is no human actor for these calls.
 *
 * `@ApiExcludeController` est délibéré et le reste : ces routes ne sont jamais
 * exposées par `api-gateway`, elles n'ont donc pas à figurer dans un catalogue
 * public. Les `@ApiOperation` / `@ApiResponse` posés plus bas documentent le
 * contrat dans le code et prendraient effet si l'exclusion tombait un jour ;
 * la référence lisible reste `docs/routes.md`.
 */
@ApiExcludeController()
@UseGuards(InternalGuard)
@Controller('internal')
export class InternalController {
  constructor(private readonly internalService: InternalService) {}

  @Post('create-administrative-profile')
  createAdministrativeProfile(
    @Body() dto: CreateAdministrativeProfileDto,
  ): Promise<Awaited<ReturnType<InternalService['createAdministrativeProfile']>>> {
    return this.internalService.createAdministrativeProfile(dto);
  }

  @Post('create-student-profiles')
  createStudentProfiles(
    @Body() dto: CreateStudentProfilesDto,
  ): Promise<Awaited<ReturnType<InternalService['createStudentProfiles']>>> {
    return this.internalService.createStudentProfiles(dto);
  }

  @Post('create-teacher-profiles')
  createTeacherProfiles(
    @Body() dto: CreateTeacherProfilesDto,
  ): Promise<Awaited<ReturnType<InternalService['createTeacherProfiles']>>> {
    return this.internalService.createTeacherProfiles(dto);
  }

  @Post('link-parent')
  linkParent(
    @Body() dto: LinkParentDto,
  ): Promise<Awaited<ReturnType<InternalService['linkParent']>>> {
    return this.internalService.linkParent(dto);
  }

  /**
   * `POST /internal/create-teacher-student-relation`
   *
   * Crée le lien élève↔formateur à la validation du RP. `profile-service` en
   * est l'unique propriétaire (arbitrage du 2026-08-12, point 5).
   *
   * IDEMPOTENTE : rejouer la validation d'un RP ne crée pas de second lien et
   * n'échoue pas. Le code HTTP dit lequel des deux cas s'est produit —
   * `201` création, `200` le lien existait déjà à l'identique — et le corps est
   * le même dans les deux cas. L'appelant n'a donc plus à traiter un `409`
   * comme un succès : le seul `409` restant est un vrai conflit (lien existant
   * avec un statut de professeur principal différent), qu'il doit remonter.
   */
  @ApiOperation({
    summary: 'Créer le lien élève↔formateur (idempotent)',
    description:
      "Crée le lien dont profile-service est l'unique propriétaire. 201 si le lien est créé, " +
      '200 si le lien identique existait déjà (rejeu), 409 si un lien existe avec un statut de ' +
      'professeur principal différent.',
  })
  @ApiResponse({ status: 201, description: 'Lien créé.' })
  @ApiResponse({ status: 200, description: 'Lien déjà existant à l’identique (rejeu).' })
  @ApiResponse({ status: 409, description: 'Lien existant avec un professeur principal différent.' })
  @ApiResponse({ status: 401, description: 'X-Internal-Secret absent ou invalide.' })
  @Post('create-teacher-student-relation')
  async createTeacherStudentRelation(
    @Body() dto: CreateTeacherStudentRelationDto,
    /**
     * `passthrough: true` : Nest continue de sérialiser la valeur retournée,
     * on n'emprunte la réponse que pour poser le code du rejeu. Sans cela, le
     * `201` par défaut d'un POST annoncerait une création qui n'a pas eu lieu.
     */
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ teacherId: string; studentId: string; isPrincipalTeacher: boolean }> {
    const { isCreated, relation } = await this.internalService.createTeacherStudentRelation(dto);
    response.status(isCreated ? HttpStatus.CREATED : HttpStatus.OK);
    return relation;
  }

  /**
   * `POST /internal/teachers/ensure-validations`
   *
   * REPRISE DE STOCK des formateurs sans enregistrement de validation, invisibles
   * du responsable pédagogique (arbitrage du 2026-08-12, point 3).
   *
   * Route et non migration SQL : `profile-service` ne connaît pas les rôles, et
   * aucune de ses tables ne permet de dire qui est formateur sans le deviner
   * (voir `InternalService.ensureTeacherValidations`). La liste vient donc de
   * son propriétaire, identity-access-service, via
   * `scripts/maintenance/backfill-teacher-validations.ts`.
   *
   * `200` et non `201` : l'opération est idempotente et ne crée rien dans le cas
   * nominal d'un rejeu. Le corps dit précisément ce qui a été créé et ce qui
   * existait déjà — un décompte muet ne permettrait pas de vérifier la reprise.
   */
  @ApiOperation({
    summary: 'Créer les enregistrements de validation manquants (reprise de stock)',
    description:
      'Idempotente et NON DESTRUCTRICE : un formateur déjà `validated` ou `rejected` est ' +
      'laissé strictement intact et compté dans `alreadyPresent`. Ne repasse jamais un ' +
      'statut existant à `pending`.',
  })
  @ApiResponse({
    status: 200,
    description: '`{created: string[], alreadyPresent: string[]}`',
  })
  @ApiResponse({ status: 400, description: 'Liste vide, au-delà du plafond, ou UUID invalide.' })
  @ApiResponse({ status: 401, description: 'X-Internal-Secret absent ou invalide.' })
  @HttpCode(HttpStatus.OK)
  @Post('teachers/ensure-validations')
  ensureTeacherValidations(
    @Body() dto: EnsureTeacherValidationsDto,
  ): Promise<{ created: string[]; alreadyPresent: string[] }> {
    return this.internalService.ensureTeacherValidations(dto.teacherIds);
  }

  @Post('link-coordinator')
  linkCoordinator(
    @Body() dto: LinkCoordinatorDto,
  ): Promise<Awaited<ReturnType<InternalService['linkCoordinator']>>> {
    return this.internalService.linkCoordinator(dto);
  }

  /**
   * `GET /internal/profiles/:userId/display-name`
   *
   * RÉSOLUTION DE NOM entre services : renvoie `{userId, firstName, lastName}`
   * et RIEN D'AUTRE. Cette limite n'est pas une étape, c'est le contrat
   * (arbitrage du 2026-08-12, `docs/architecture.md` > « Resolution des noms
   * entre services ») : la route est servie SANS lecteur et SANS filtrage champ
   * par champ, si bien que tout champ ajouté ici deviendrait accessible sans
   * aucun contrôle de droit à quiconque détient `INTERNAL_SECRET`. Tout besoin
   * d'un champ supplémentaire passe par la route publique
   * `GET /profiles/:userId` et ses règles de droit.
   *
   * Elle n'est jamais exposée par `api-gateway`.
   *
   * `x-correlation-id` est accepté et propagé aux appels sortants.
   */
  @ApiOperation({
    summary: 'Résoudre le prénom et le nom d’une personne (interservices)',
    description:
      'Renvoie UNIQUEMENT firstName et lastName. Ne doit jamais être étendue à un autre champ : ' +
      'servie sans lecteur et sans filtrage de visibilité, elle deviendrait une porte dérobée. ' +
      'Jamais exposée par api-gateway.',
  })
  @ApiResponse({ status: 200, description: '{userId, firstName, lastName} — valeurs string|null.' })
  @ApiResponse({ status: 400, description: 'userId n’est pas un UUID.' })
  @ApiResponse({ status: 401, description: 'X-Internal-Secret absent ou invalide.' })
  @ApiResponse({ status: 404, description: 'userId inconnu de identity-access-service.' })
  @ApiResponse({
    status: 500,
    description: 'Compte connu mais sans profil administratif : incohérence de données.',
  })
  @Get('profiles/:userId/display-name')
  resolveDisplayName(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Headers('x-correlation-id') correlationId?: string,
  ): Promise<DisplayName> {
    return this.internalService.resolveDisplayName(userId, correlationId);
  }

  /**
   * `POST /internal/profiles/display-names`
   *
   * Variante PAR LOT de la route ci-dessus, pour qu'une liste de N lignes ne
   * coûte pas N appels HTTP. Même contrat, même limite : prénom et nom, rien
   * de plus.
   *
   * `POST` alors que l'opération est une LECTURE : le corps porte la liste
   * d'identifiants, qu'une query string ne peut pas transporter sans limite de
   * longueur. D'où le `200` explicite — aucune ressource n'est créée.
   *
   * Un `userId` sans profil administratif est simplement ABSENT de la réponse :
   * un identifiant douteux ne prive pas l'appelant des autres noms.
   */
  @ApiOperation({
    summary: 'Résoudre prénoms et noms par lot (interservices)',
    description:
      'Lecture par lot ; le corps porte les identifiants. Même contrat que la route unitaire : ' +
      'firstName et lastName uniquement. Les userIds sans profil administratif sont absents de ' +
      'la réponse.',
  })
  @ApiResponse({ status: 200, description: '{displayNames: [{userId, firstName, lastName}]}' })
  @ApiResponse({ status: 400, description: 'Liste vide, trop longue, ou identifiant non-UUID.' })
  @ApiResponse({ status: 401, description: 'X-Internal-Secret absent ou invalide.' })
  @HttpCode(HttpStatus.OK)
  @Post('profiles/display-names')
  resolveDisplayNames(@Body() dto: ResolveDisplayNamesDto): Promise<DisplayNameBatch> {
    return this.internalService.resolveDisplayNames(dto.userIds);
  }

  /**
   * `GET /internal/relations/finance-owners/:studentId`
   *
   * Résout les PARENTS FINANCEURS d'un élève pour un appelant interservices —
   * arbitrage du 2026-08-14 (`docs/architecture.md` > « Systeme de
   * notifications transversal », point 5). Premier consommateur :
   * `dashboard-notification-service`, pour notifier les parents financeurs
   * quand un professeur est validé pour leur élève.
   *
   * DÉCLARÉE AVANT `GET /internal/relations/:viewerId/:targetId` ci-dessous :
   * les deux routes ont le même nombre de segments, et `:viewerId` capturerait
   * silencieusement le littéral `finance-owners` si la route paramétrée était
   * enregistrée en premier — Express résout dans l'ordre de déclaration, pas
   * par spécificité du segment. Ne jamais réordonner sans vérifier ce point.
   *
   * PÉRIMÈTRE VOLONTAIREMENT ÉTROIT : ne renvoie que les `userId`, rien
   * d'autre — pas de nom, pas de statut du lien. Les noms se résolvent via
   * `GET /internal/profiles/:userId/display-name` /
   * `POST /internal/profiles/display-names`, séparément. Réutilise
   * directement `RelationsService.getFinanceOwnersByStudent`, qui ne renvoie
   * que les liens ACTIFS (un parent délié n'apparaît plus).
   *
   * Jamais exposée par `api-gateway`.
   */
  @ApiOperation({
    summary: 'Résoudre les parents financeurs d’un élève (interservices)',
    description:
      'Renvoie {studentId, financeOwnerUserIds}. Liens actifs uniquement. Aucun nom, aucun ' +
      'statut de lien — la résolution de nom passe par les routes dédiées. Jamais exposée par ' +
      'api-gateway.',
  })
  @ApiResponse({ status: 200, description: '{studentId, financeOwnerUserIds: string[]}' })
  @ApiResponse({ status: 400, description: 'studentId n’est pas un UUID.' })
  @ApiResponse({ status: 401, description: 'X-Internal-Secret absent ou invalide.' })
  @Get('relations/finance-owners/:studentId')
  getFinanceOwnersByStudent(
    @Param('studentId', ParseUUIDPipe) studentId: string,
  ): Promise<Awaited<ReturnType<InternalService['getFinanceOwnersByStudent']>>> {
    return this.internalService.getFinanceOwnersByStudent(studentId);
  }

  /**
   * `GET /internal/relations/:viewerId/:targetId?viewerRole=<rôle>`
   *
   * Renvoie la NATURE et le SENS des relations entre deux personnes, pour qu'un
   * service appelant applique sa propre règle sans tenir de copie des relations
   * (`archive-document-service` en premier). Voir `InternalService.resolveRelation`.
   *
   * `viewerRole` est obligatoire (`400` s'il manque ou s'il est inconnu) : le
   * rôle accompagne systématiquement les appels interservices.
   */
  @Get('relations/:viewerId/:targetId')
  resolveRelation(
    @Param('viewerId', ParseUUIDPipe) viewerId: string,
    @Param('targetId', ParseUUIDPipe) targetId: string,
    @Query() query: ResolveRelationQueryDto,
  ): Promise<Awaited<ReturnType<InternalService['resolveRelation']>>> {
    return this.internalService.resolveRelation(viewerId, targetId, query.viewerRole);
  }
}
