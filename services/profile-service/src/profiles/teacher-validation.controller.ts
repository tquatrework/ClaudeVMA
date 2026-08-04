import {
  Controller,
  Get,
  Post,
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
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ProfilesService } from './profiles.service';
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
  constructor(private readonly profilesService: ProfilesService) {}

  @Get('teachers/pending-validation')
  @Roles(UserRole.RESPONSABLE_PEDAGOGIQUE)
  @ApiOperation({
    summary: 'List teachers pending validation',
    description:
      'Returns all formateurs whose validation status is pending. ' +
      'Restricted to RP only. ' +
      'Name fields are joined from administrative profiles when available.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of formateurs pending validation (may be empty)',
  })
  @ApiResponse({ status: 403, description: 'Forbidden — RP only' })
  listTeachersPendingValidation(
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<Awaited<ReturnType<ProfilesService['listTeachersPendingValidation']>>> {
    return this.profilesService.listTeachersPendingValidation(actor);
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
      'Returns the current validation record for a formateur. ' +
      'Accessible to RP, TI, AdministrateurFinancier and the teacher themselves.',
  })
  @ApiParam({ name: 'teacherId', description: 'Teacher (formateur) UUID' })
  @ApiResponse({ status: 200, description: 'Validation record' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient rights' })
  getTeacherValidation(
    @Param('teacherId', ParseUUIDPipe) teacherId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<Awaited<ReturnType<ProfilesService['getTeacherValidation']>>> {
    return this.profilesService.getTeacherValidation(teacherId, actor);
  }
}
