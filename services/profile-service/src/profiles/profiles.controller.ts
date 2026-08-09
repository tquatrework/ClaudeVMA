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
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { UpdateAdministrativeProfileDto } from './dto/update-administrative-profile.dto';
import {
  UpdateStudentPedagogicalProfileDto,
  UpdateTeacherPedagogicalProfileDto,
} from './dto/update-pedagogical-profile.dto';
import { UpdateVisibilityPreferenceDto } from './dto/update-visibility-preference.dto';

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
  constructor(private readonly profilesService: ProfilesService) {}

  @Get(':userId')
  @ApiOperation({
    summary: 'Get profile',
    description:
      'Returns the administrative and pedagogical profile for a user. ' +
      'Strictly read-only: this endpoint never creates anything in database. ' +
      'PROF-FB-003: a formateur may only access profiles of linked students. ' +
      'Internal notes are never included in this response.',
  })
  @ApiParam({ name: 'userId', description: 'Target user UUID' })
  @ApiResponse({
    status: 200,
    description:
      'Profile data (fields filtered by actor role). ' +
      'Includes loginIdentifier fetched from identity-access-service; null if unavailable. ' +
      '`pedagogical` is null when the user has not filled in their pedagogical profile yet — ' +
      'this is a normal state, the pedagogical profile being optional.',
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
      'Users may update their own profile; RP, TI and AdministrateurFinancier may update any.',
  })
  @ApiParam({ name: 'userId', description: 'Target user UUID' })
  @ApiResponse({ status: 200, description: 'Updated administrative profile' })
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
    summary: 'Update pedagogical profile',
    description:
      'Upsert the pedagogical profile. Accepts student fields (niveauScolaire, matieres…) ' +
      'or teacher fields (niveauxEnseignes, matieresEnseignees…) depending on the payload. ' +
      'Users may update their own; RP and TI may update any.',
  })
  @ApiParam({ name: 'userId', description: 'Target user UUID' })
  @ApiResponse({ status: 200, description: 'Updated pedagogical profile' })
  @ApiResponse({ status: 403, description: 'Forbidden — may only update own profile' })
  updatePedagogical(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: UpdateStudentPedagogicalProfileDto | UpdateTeacherPedagogicalProfileDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<Awaited<ReturnType<ProfilesService['updatePedagogicalProfile']>>> {
    return this.profilesService.updatePedagogicalProfile(userId, dto, actor);
  }

  @Get(':userId/statistics')
  @ApiOperation({
    summary: 'Get pedagogical statistics for a user',
    description:
      'Returns consolidated pedagogical statistics. ' +
      'Phase 1: returns data embedded in the pedagogical profile. ' +
      'Access rules mirror GET /profiles/:userId.',
  })
  @ApiParam({ name: 'userId', description: 'Target user UUID' })
  @ApiResponse({ status: 200, description: 'Pedagogical statistics snapshot' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient rights' })
  @ApiResponse({ status: 404, description: 'No pedagogical profile found' })
  getPedagogicalStatistics(
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<Awaited<ReturnType<ProfilesService['getPedagogicalStatistics']>>> {
    return this.profilesService.getPedagogicalStatistics(userId, actor);
  }

  @Get(':userId/visibility-preferences')
  @ApiOperation({
    summary: 'Get visibility preferences for an élève',
    description:
      'Returns the confidentiality settings for an élève profile (PROF-FN-004). ' +
      'Accessible to the élève themselves and privileged roles.',
  })
  @ApiParam({ name: 'userId', description: 'Élève UUID' })
  @ApiResponse({ status: 200, description: 'Visibility preferences' })
  @ApiResponse({ status: 403, description: 'Forbidden — own account or admin only' })
  getVisibilityPreferences(
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<Awaited<ReturnType<ProfilesService['getVisibilityPreferences']>>> {
    return this.profilesService.getVisibilityPreferences(userId, actor);
  }

  @Patch(':userId/visibility-preferences')
  @ApiOperation({
    summary: 'Update visibility preferences for an élève',
    description:
      'Sets confidentiality flags for an élève (PROF-FN-004): ' +
      'whether to hide difficulties/comments from non-priority contacts.',
  })
  @ApiParam({ name: 'userId', description: 'Élève UUID' })
  @ApiResponse({ status: 200, description: 'Updated visibility preferences' })
  @ApiResponse({ status: 403, description: 'Forbidden — own account or admin only' })
  updateVisibilityPreferences(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: UpdateVisibilityPreferenceDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<Awaited<ReturnType<ProfilesService['updateVisibilityPreferences']>>> {
    return this.profilesService.updateVisibilityPreferences(userId, dto, actor);
  }
}
