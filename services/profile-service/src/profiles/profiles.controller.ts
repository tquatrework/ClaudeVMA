import {
  Controller,
  Get,
  Put,
  Patch,
  Param,
  Body,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { ProfilesService } from './profiles.service';
import { FieldVisibilityService } from './field-visibility.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { OwnerAccess } from '../common/decorators/owner-access.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { UserRole } from '../common/enums/user-role.enum';
import { UpdateAdministrativeProfileDto } from './dto/update-administrative-profile.dto';
import { UpdatePedagogicalProfileDto } from './dto/update-pedagogical-profile.dto';
import { UpdatePrescriptionDto } from './dto/update-prescription.dto';
import { UpdateFieldVisibilityDto } from './dto/update-field-visibility.dto';

/**
 * Thin HTTP adapter for the core profile resource: administrative profile,
 * pedagogical profile, statistics and visibility preferences. Internal notes
 * and teacher validation live in their own controllers/files
 * (controllers-convention: "un fichier contient un seul contrôleur et une
 * seule racine de ressource cohérente").
 */
@ApiTags('profiles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('profiles')
export class ProfilesController {
  constructor(
    private readonly profilesService: ProfilesService,
    private readonly fieldVisibilityService: FieldVisibilityService,
  ) {}

  @Get(':userId')
  @ApiOperation({
    summary: 'Get profile',
    description:
      'Returns the administrative and pedagogical profile for a user. ' +
      'Strictly read-only: this endpoint never creates anything in database. ' +
      'PROF-FB-003: a formateur may only access profiles of linked students. ' +
      'Internal notes are never included in this response.\n\n' +
      'PER-FIELD VISIBILITY (arbitrage du 2026-08-09) — the response is filtered ' +
      'according to the owner\'s per-field settings (PUT /profiles/:userId/field-visibility), ' +
      'EXCEPT for readers who are exempt:\n' +
      '  • the owner themselves — always sees the whole record, prescription included;\n' +
      '  • the linked FINANCE OWNER (parent) — "the parent sees everything about their ' +
      'students, except the personal notebook", which belongs to pedagogical-log-service ' +
      'and is not covered here. A student cannot hide a profile field from their finance owner;\n' +
      '  • the administrative roles (RP, AP, TI, AdministrateurFinancier), each within the ' +
      'read scope already enforced above.\n' +
      'Every other linked contact — today the formateur — IS subject to the settings. ' +
      'The PRINCIPAL TEACHER is treated as any other linked contact: that case has not been ' +
      'arbitrated, so no exemption is granted.',
  })
  @ApiParam({ name: 'userId', description: 'Target user UUID' })
  @ApiResponse({
    status: 200,
    description:
      'Response shape: { userId, loginIdentifier, administrative, pedagogical, pedagogicalType, ' +
      'visibility }. ' +
      '`pedagogical` carries the COMPLETE pedagogical profile, both sections merged flat: ' +
      'the declarative fields the owner fills in AND the prescription fields written by the RP. ' +
      'The owner reads their prescription here but can never write it (see ' +
      'PUT /profiles/:userId/prescription). ' +
      '`pedagogicalType` is "student", "teacher", or null when no pedagogical profile exists yet — ' +
      'a normal state, the pedagogical profile being optional. ' +
      '`loginIdentifier` comes from identity-access-service; null if unavailable.\n\n' +
      '`visibility` = { isFiltered: boolean, hiddenFields: string[] } reports the outcome of the ' +
      'per-field filtering. A HIDDEN FIELD IS ABSENT from its block and its name is listed in ' +
      '`hiddenFields` — it is never replaced by null or an empty string, so that "hidden" stays ' +
      'distinguishable from "not filled in": a key present at null means empty, a key missing ' +
      'and named in `hiddenFields` means hidden. `isFiltered: false` means the whole record was ' +
      'returned, which is NOT the same information as an empty `hiddenFields` on a filtered ' +
      'reader whose fields all happen to be visible.\n' +
      'Structural fields are never hidden: `userId`, `createdAt`, `updatedAt`, `pedagogicalType` ' +
      'and `isAnimateurPedagogique` (a right granted by the RP, not a declaration). ' +
      '`filledBy`/`filledAt` follow the prescription section: they are returned only when at ' +
      'least one prescription field is visible to the reader.',
  })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role or not linked' })
  @ApiResponse({
    status: 404,
    description: 'No account known to identity-access-service for this userId',
  })
  @ApiResponse({
    status: 500,
    description:
      'Data inconsistency — the account exists but has no administrative profile, ' +
      'which is mandatory and created at signup. Logged server-side as an anomaly.',
  })
  getProfile(
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<Awaited<ReturnType<ProfilesService['getProfile']>>> {
    return this.profilesService.getProfile(userId, actor);
  }

  @Put(':userId/administrative')
  @ApiOperation({
    summary: 'Update administrative profile',
    description:
      'Upsert the administrative profile (name, address, phone, avatar…). ' +
      'Users may update their own profile; RP, TI and AdministrateurFinancier may update any. ' +
      'All field names are in English and match the response payload exactly: ' +
      'firstName, lastName, birthDate, phone, addressLine1, addressLine2, postalCode, ' +
      'city, country, avatarUrl, passions. ' +
      '`department` was REMOVED on 2026-08-11 and is now refused with a 400.',
  })
  @ApiParam({ name: 'userId', description: 'Target user UUID' })
  @ApiResponse({ status: 200, description: 'Updated administrative profile' })
  @ApiResponse({
    status: 400,
    description:
      'Unknown field in the body (forbidNonWhitelisted), empty firstName/lastName, ' +
      'or invalid field type',
  })
  @ApiResponse({ status: 403, description: 'Forbidden — may only update own profile' })
  updateAdministrative(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: UpdateAdministrativeProfileDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<Awaited<ReturnType<ProfilesService['updateAdministrativeProfile']>>> {
    return this.profilesService.updateAdministrativeProfile(userId, dto, actor);
  }

  @Put(':userId/pedagogical')
  @ApiOperation({
    summary: 'Update the declarative section of the pedagogical profile',
    description:
      'Upsert the DECLARATIVE section only — what the profile owner states about themselves. ' +
      'Student fields: level, schoolName, subjects, goals, specificNeeds, difficulties, ' +
      'familyContext, schoolContext, equipment. The former single field `context` was ' +
      'split into `familyContext` and `schoolContext` on 2026-08-11 and is now refused ' +
      'with a 400. ' +
      'Teacher fields: levels, subjects, experience, diplomas, specialties, particularities, ' +
      'cvDocumentId. `subjects` exists on both profiles and never discriminates.\n\n' +
      'This route NEVER accepts a prescription field (generalAssessment, recommendedPace, ' +
      'recommendedTeacherProfile, recommendedPath, recommendedActivities, maxValidatedLevel, ' +
      'audienceType, testResults, testComments) nor filledBy/filledAt: sending one returns 400. ' +
      'Use PUT /profiles/:userId/prescription (RP only) instead. ' +
      '`isAnimateurPedagogique` is likewise refused here — it is a right granted through ' +
      'POST /profiles/:teacherId/ap-status, not a declaration.\n\n' +
      'Target role is resolved from the account role held by identity-access-service, then ' +
      'from the fields present. Sending fields of the other role returns 400 rather than ' +
      'silently ignoring them. Users may update their own profile; RP and TI may update any.',
  })
  @ApiParam({ name: 'userId', description: 'Target user UUID' })
  @ApiResponse({ status: 200, description: 'Updated pedagogical profile (declarative section)' })
  @ApiResponse({
    status: 400,
    description:
      'Unknown field, prescription field, or field belonging to the other role ' +
      '(student fields on a teacher profile and vice versa); invalid field type',
  })
  @ApiResponse({ status: 403, description: 'Forbidden — may only update own profile' })
  updatePedagogical(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: UpdatePedagogicalProfileDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<Awaited<ReturnType<ProfilesService['updatePedagogicalProfile']>>> {
    return this.profilesService.updatePedagogicalProfile(userId, dto, actor);
  }

  @Put(':userId/prescription')
  @Roles(UserRole.RESPONSABLE_PEDAGOGIQUE)
  @ApiOperation({
    summary: 'Update the prescription section of the pedagogical profile (RP only)',
    description:
      'Upsert the PRESCRIPTION section of a pedagogical profile — what the responsable ' +
      'pédagogique prescribes ABOUT the person, in the same profile but under different ' +
      'write rights.\n\n' +
      'Student fields: generalAssessment, recommendedPace, recommendedTeacherProfile, ' +
      'recommendedPath, recommendedActivities. ' +
      'Teacher fields: maxValidatedLevel, audienceType, testResults, testComments.\n\n' +
      'RESERVED TO THE RESPONSABLE PÉDAGOGIQUE, including when the target is the caller ' +
      'themselves: a student must not be able to write their own recommendations, nor a ' +
      'teacher their own test results. Any other role gets 403.\n\n' +
      '`filledBy` and `filledAt` are set server-side from the authenticated actor and the ' +
      'server clock; sending them in the body returns 400. They are what makes the ' +
      'prescription binding — who prescribed what, and when.\n\n' +
      'The owner READS this section through GET /profiles/:userId, merged into `pedagogical`.',
  })
  @ApiParam({ name: 'userId', description: 'Target user UUID (student or teacher)' })
  @ApiResponse({
    status: 200,
    description:
      'Updated pedagogical profile, prescription section included, with filledBy/filledAt set',
  })
  @ApiResponse({
    status: 400,
    description:
      'Unknown field (including filledBy/filledAt or any declarative field), fields mixing ' +
      'both roles, or fields belonging to the other role than the resolved profile',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden — responsable pédagogique only, owner included',
  })
  updatePrescription(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: UpdatePrescriptionDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<Awaited<ReturnType<ProfilesService['updatePrescription']>>> {
    return this.profilesService.updatePrescription(userId, dto, actor);
  }

  @Get(':userId/statistics')
  @OwnerAccess()
  @ApiOperation({
    summary: 'Lire les statistiques pédagogiques d\'une personne',
    description:
      'Statistiques pédagogiques consolidées. Phase 1 : les données portées par le profil ' +
      'pédagogique.\n\n' +
      '**DROIT D\'ACCÈS PILOTÉ PAR LA RELATION** (arbitrage du 2026-08-11), pas par une liste ' +
      'de rôles — une liste oublie un rôle à chaque évolution. Y ont accès :\n' +
      '- le **titulaire** ;\n' +
      '- les **administrateurs** : RP, AF, TI (accès à tout, sans distinction pour l\'instant) ;\n' +
      '- toute personne **reliée** à la cible : formateur ↔ élève (dans les deux sens), parent ' +
      'financeur ↔ élève (dans les deux sens), parent financeur ↔ formateur de son élève (lien ' +
      'indirect), AP → formateur qu\'il anime, coordinateur ↔ élève coordonné.\n\n' +
      '**Un refus faute de relation renvoie `404`, jamais `403`** — même code et même message ' +
      'qu\'une absence de statistiques. Un `403` révélerait l\'existence de ce qu\'on refuse de ' +
      'montrer (même règle que les médias masqués, 2026-08-10).\n\n' +
      'Cette route sert les MÊMES champs (`level`, `subjects`, `levels`) que le bloc ' +
      '`pedagogical` de `GET /profiles/:userId` : elle applique donc le MÊME filtrage champ par ' +
      'champ, sans quoi elle en serait le contournement exact. Le titulaire, les administrateurs, ' +
      'le parent financeur DIRECT de la cible et l\'AP qui l\'anime en sont exemptés ; les autres ' +
      'contacts liés y sont soumis — un parent voit donc du formateur de son élève ce que ce ' +
      'formateur partage avec ses contacts liés, pas plus. `isAnimateurPedagogique` est ' +
      'structurel et n\'est jamais masqué.',
  })
  @ApiParam({ name: 'userId', description: 'UUID de la personne consultée' })
  @ApiResponse({
    status: 200,
    description:
      'Forme : `{userId, profileType, statistics, visibility}`. `visibility` suit le même ' +
      'contrat que `GET /profiles/:userId` : un champ masqué est ABSENT de `statistics` et ' +
      'NOMMÉ dans `visibility.hiddenFields`, jamais remplacé par une valeur trompeuse.',
  })
  @ApiResponse({ status: 401, description: 'Sans jeton' })
  @ApiResponse({
    status: 404,
    description:
      'Aucune statistique pédagogique pour cette personne — **ou** aucune relation ouvrant ce ' +
      'droit. Les deux cas sont volontairement indiscernables.',
  })
  getPedagogicalStatistics(
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<Awaited<ReturnType<ProfilesService['getPedagogicalStatistics']>>> {
    return this.profilesService.getPedagogicalStatistics(userId, actor);
  }

  @Get(':userId/field-visibility')
  @ApiOperation({
    summary: 'Get per-field visibility settings',
    description:
      'Returns the effective visibility of EVERY field of the visibility catalog, so that a ' +
      'confidentiality screen can be built from a single call without duplicating the ' +
      'catalog or the defaults on the client.\n\n' +
      'Shape: { userId, fields: [{ fieldName, block, audience, defaultAudience, isExplicit, ' +
      'isPrescription, isReserved }] }.\n' +
      '`audience` is what actually applies; `defaultAudience` is the block default, useful to ' +
      'offer a "reset" action; `isExplicit` tells whether the user set it themselves.\n' +
      '`block` is one of administrative | pedagogical-student | pedagogical-teacher.\n\n' +
      'Default baseline (validated 2026-08-09): firstName, lastName, avatarUrl, level and ' +
      'subjects are visible to linked people; everything else is `self` by default.\n\n' +
      'These settings ARE enforced on reads since the 2026-08-09 arbitrage (see ' +
      'GET /profiles/:userId). They apply to linked contacts only: the finance owner and the ' +
      'administrative roles are exempt, and the owner always sees their own record in full — ' +
      'so a field set to `self` still appears here and on the owner\'s own profile read.\n\n' +
      'Replaces GET /profiles/:userId/visibility-preferences, removed with its two hard-coded ' +
      'booleans; existing settings were migrated into rows without loss.',
  })
  @ApiParam({ name: 'userId', description: 'Profile owner UUID' })
  @ApiResponse({ status: 200, description: 'Effective per-field visibility settings' })
  @ApiResponse({ status: 403, description: 'Forbidden — own account or admin roles only' })
  getFieldVisibility(
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<Awaited<ReturnType<FieldVisibilityService['getFieldVisibility']>>> {
    return this.fieldVisibilityService.getFieldVisibility(userId, actor);
  }

  @Put(':userId/field-visibility')
  @ApiOperation({
    summary: 'Update per-field visibility settings',
    description:
      'Partial upsert: body is { fields: [{ fieldName, audience }] } and ONLY the listed ' +
      'fields are modified — a field left out keeps its current setting rather than being ' +
      'reset, so a screen that knows part of the catalog cannot wipe the rest. ' +
      'To go back to a default, send that field with its `defaultAudience`.\n\n' +
      '`audience` ∈ self | linked | all. `fieldName` must belong to the visibility catalog: ' +
      'an unknown name returns 400 listing the accepted names, never a silent no-op. ' +
      'A field name repeated twice in the same body also returns 400.\n\n' +
      'EFFECT ON READS (since the 2026-08-09 arbitrage): setting a field to `self` hides it ' +
      'from linked contacts (today the formateur) on GET /profiles/:userId and ' +
      'GET /profiles/:userId/statistics. It does NOT hide it from the linked finance owner ' +
      '(parent), from the administrative roles, nor from the owner — a student cannot hide a ' +
      'profile field from their finance owner.\n\n' +
      'Returns the same payload as GET /profiles/:userId/field-visibility.',
  })
  @ApiParam({ name: 'userId', description: 'Profile owner UUID' })
  @ApiResponse({ status: 200, description: 'Updated per-field visibility settings' })
  @ApiResponse({
    status: 400,
    description:
      'Unknown fieldName, duplicated fieldName, invalid audience, empty or malformed fields array',
  })
  @ApiResponse({ status: 403, description: 'Forbidden — own account or admin roles only' })
  updateFieldVisibility(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: UpdateFieldVisibilityDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<Awaited<ReturnType<FieldVisibilityService['updateFieldVisibility']>>> {
    return this.fieldVisibilityService.updateFieldVisibility(userId, dto, actor);
  }
}
