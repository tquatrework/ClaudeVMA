import {
  Controller,
  Get,
  Put,
  Patch,
  Post,
  Param,
  Body,
  UseGuards,
  Request,
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
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { UpdateAdministrativeProfileDto } from './dto/update-administrative-profile.dto';
import {
  UpdateStudentPedagogicalProfileDto,
  UpdateTeacherPedagogicalProfileDto,
} from './dto/update-pedagogical-profile.dto';
import { CreateInternalNoteDto } from './dto/create-internal-note.dto';
import { UpdateTeacherValidationDto } from './dto/update-teacher-validation.dto';
import { UpdateVisibilityPreferenceDto } from './dto/update-visibility-preference.dto';

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
      'PROF-FB-003: a formateur may only access profiles of linked students. ' +
      'Internal notes are never included in this response.',
  })
  @ApiParam({ name: 'userId', description: 'Target user UUID' })
  @ApiResponse({ status: 200, description: 'Profile data (fields filtered by actor role)' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role or not linked' })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  getProfile(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Request() req,
  ) {
    return this.profilesService.getProfile(userId, req.user);
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
    @Request() req,
  ) {
    return this.profilesService.updateAdministrativeProfile(userId, dto, req.user);
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
    @Request() req,
  ) {
    return this.profilesService.updatePedagogicalProfile(userId, dto, req.user);
  }

  @Get(':userId/internal-notes')
  @Roles(UserRole.RESPONSABLE_PEDAGOGIQUE, UserRole.ADMINISTRATEUR_FINANCIER)
  @ApiOperation({
    summary: 'List internal notes',
    description:
      'Returns internal notes written about a user. ' +
      'Restricted to RP and AdministrateurFinancier only (PROF-FB-002).',
  })
  @ApiParam({ name: 'userId', description: 'Target user UUID' })
  @ApiResponse({ status: 200, description: 'List of internal notes (newest first)' })
  @ApiResponse({ status: 403, description: 'Forbidden — RP or AdministrateurFinancier only' })
  getInternalNotes(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Request() req,
  ) {
    return this.profilesService.getInternalNotes(userId, req.user);
  }

  @Post(':userId/internal-notes')
  @Roles(UserRole.RESPONSABLE_PEDAGOGIQUE, UserRole.ADMINISTRATEUR_FINANCIER)
  @ApiOperation({
    summary: 'Create internal note',
    description:
      'Append an internal note about a user. ' +
      'Restricted to RP and AdministrateurFinancier only (PROF-FB-002).',
  })
  @ApiParam({ name: 'userId', description: 'Target user UUID' })
  @ApiResponse({ status: 201, description: 'Internal note created' })
  @ApiResponse({ status: 403, description: 'Forbidden — RP or AdministrateurFinancier only' })
  createInternalNote(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: CreateInternalNoteDto,
    @Request() req,
  ) {
    return this.profilesService.createInternalNote(userId, dto, req.user);
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
    @Request() req,
  ) {
    return this.profilesService.promoteToAnimateurPedagogique(teacherId, req.user);
  }

  @Patch(':teacherId/validation')
  @Roles(UserRole.RESPONSABLE_PEDAGOGIQUE, UserRole.TECHNICIEN_INFORMATIQUE)
  @ApiOperation({
    summary: 'Update teacher validation status',
    description:
      'Sets the validation status (pending / validated / rejected) for a formateur. ' +
      'Restricted to RP and TI only. Publishes TeacherValidated event when status = validated.',
  })
  @ApiParam({ name: 'teacherId', description: 'Teacher (formateur) UUID' })
  @ApiResponse({ status: 200, description: 'Validation record updated' })
  @ApiResponse({ status: 403, description: 'Forbidden — RP or TI only' })
  updateTeacherValidation(
    @Param('teacherId', ParseUUIDPipe) teacherId: string,
    @Body() dto: UpdateTeacherValidationDto,
    @Request() req,
  ) {
    return this.profilesService.updateTeacherValidation(teacherId, dto, req.user);
  }

  @Get(':teacherId/validation')
  @ApiOperation({
    summary: 'Get teacher validation status',
    description:
      'Returns the current validation record for a formateur. ' +
      'Accessible to RP, TI, AdministrateurFinancier and the teacher themselves.',
  })
  @ApiParam({ name: 'teacherId', description: 'Teacher (formateur) UUID' })
  @ApiResponse({ status: 200, description: 'Validation record' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient rights' })
  getTeacherValidation(
    @Param('teacherId', ParseUUIDPipe) teacherId: string,
    @Request() req,
  ) {
    return this.profilesService.getTeacherValidation(teacherId, req.user);
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
    @Request() req,
  ) {
    return this.profilesService.getPedagogicalStatistics(userId, req.user);
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
    @Request() req,
  ) {
    return this.profilesService.getVisibilityPreferences(userId, req.user);
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
    @Request() req,
  ) {
    return this.profilesService.updateVisibilityPreferences(userId, dto, req.user);
  }
}
