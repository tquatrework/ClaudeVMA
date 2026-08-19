import {
  Controller,
  Post,
  Put,
  Get,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Body,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiHeader,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CorrelationId } from '../common/decorators/correlation-id.decorator';
import { CurrentUser } from '../common/current-user.decorator';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { UserRole } from '../common/enums/user-role.enum';
import { ActivitiesService } from './activities.service';
import { CreateActivityDto } from './dto/create-activity.dto';
import { UpdateActivityDto } from './dto/update-activity.dto';
import { ScheduledActivity } from './entities/scheduled-activity.entity';

@ApiTags('activities')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('activities')
export class ActivitiesController {
  constructor(private readonly activitiesService: ActivitiesService) {}

  @Post()
  @Roles(UserRole.FORMATEUR, UserRole.ANIMATEUR_PEDAGOGIQUE, UserRole.RESPONSABLE_PEDAGOGIQUE)
  @ApiHeader({ name: 'x-correlation-id', required: false })
  @ApiOperation({
    summary: 'Schedule an activity',
    description:
      'Creates a scheduled activity (cours, reunion_pedagogique, entretien_rp…). ' +
      'CAL-BR-007: one or more students as participants. ' +
      'CAL-BR-008: AP or RP can propose to teachers. ' +
      'CAL-FB-002: at least one participant and a time range are mandatory. ' +
      'CAL-FB-003: AP can only create reunion_pedagogique.',
  })
  @ApiResponse({ status: 201, description: 'Activity scheduled — emits ActivityScheduled event' })
  @ApiResponse({ status: 400, description: 'Validation error — CAL-FB-002' })
  @ApiResponse({ status: 403, description: 'Forbidden — CAL-FB-003' })
  createActivity(
    @Body() dto: CreateActivityDto,
    @CurrentUser() actor: AuthenticatedUser,
    @CorrelationId() correlationId?: string,
  ): Promise<ScheduledActivity> {
    return this.activitiesService.create(dto, actor, correlationId);
  }

  @Put(':activityId')
  @Roles(UserRole.FORMATEUR, UserRole.ANIMATEUR_PEDAGOGIQUE, UserRole.RESPONSABLE_PEDAGOGIQUE) // accès filtré par ownership/relation dans le service
  @ApiParam({ name: 'activityId', description: 'Activity UUID' })
  @ApiHeader({ name: 'x-correlation-id', required: false })
  @ApiOperation({
    summary: 'Update a scheduled activity',
    description:
      'Modifies an existing activity. ' +
      'CAL-BR-010: publishes ActivityUpdated event. ' +
      'CAL-FB-001: only creator, RP, or TI can update.',
  })
  @ApiResponse({ status: 200, description: 'Activity updated — emits ActivityUpdated event' })
  @ApiResponse({ status: 403, description: 'Forbidden — CAL-FB-001' })
  @ApiResponse({ status: 404, description: 'Activity not found' })
  updateActivity(
    @Param('activityId', ParseUUIDPipe) activityId: string,
    @Body() dto: UpdateActivityDto,
    @CurrentUser() actor: AuthenticatedUser,
    @CorrelationId() correlationId?: string,
  ): Promise<ScheduledActivity> {
    return this.activitiesService.update(activityId, dto, actor, correlationId);
  }

  @Delete(':activityId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.FORMATEUR, UserRole.ANIMATEUR_PEDAGOGIQUE, UserRole.RESPONSABLE_PEDAGOGIQUE) // même politique que PUT — accès filtré par ownership/relation dans le service
  @ApiParam({ name: 'activityId', description: 'Activity UUID' })
  @ApiHeader({ name: 'x-correlation-id', required: false })
  @ApiOperation({
    summary: 'Delete a scheduled activity',
    description:
      'Deletes an existing activity (hard delete). ' +
      'CAL-FB-001: only creator, RP, or TI can delete — same policy as PUT. ' +
      'Emits ActivityDeleted event.',
  })
  @ApiResponse({ status: 204, description: 'Activity deleted — emits ActivityDeleted event' })
  @ApiResponse({ status: 403, description: 'Forbidden — CAL-FB-001' })
  @ApiResponse({ status: 404, description: 'Activity not found' })
  deleteActivity(
    @Param('activityId', ParseUUIDPipe) activityId: string,
    @CurrentUser() actor: AuthenticatedUser,
    @CorrelationId() correlationId?: string,
  ): Promise<void> {
    return this.activitiesService.remove(activityId, actor, correlationId);
  }

  @Get(':activityId')
  @Roles(UserRole.ELEVE, UserRole.PARENT_FINANCEUR, UserRole.FORMATEUR, UserRole.ANIMATEUR_PEDAGOGIQUE, UserRole.RESPONSABLE_PEDAGOGIQUE, UserRole.TECHNICIEN_INFORMATIQUE, UserRole.ADMINISTRATEUR_FINANCIER) // accès filtré par relation dans le service
  @ApiParam({ name: 'activityId', description: 'Activity UUID' })
  @ApiOperation({ summary: 'Get an activity by ID' })
  @ApiResponse({ status: 200, description: 'Activity found' })
  @ApiResponse({ status: 404, description: 'Not found' })
  @ApiResponse({ status: 403, description: 'Forbidden — IDOR check' })
  getActivity(
    @Param('activityId', ParseUUIDPipe) activityId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<ScheduledActivity> {
    return this.activitiesService.findOne(activityId, actor);
  }

  @Post(':activityId/accept')
  @Roles(UserRole.ELEVE, UserRole.PARENT_FINANCEUR, UserRole.FORMATEUR, UserRole.ANIMATEUR_PEDAGOGIQUE, UserRole.RESPONSABLE_PEDAGOGIQUE, UserRole.TECHNICIEN_INFORMATIQUE, UserRole.ADMINISTRATEUR_FINANCIER) // seul le destinataire visé peut répondre, vérifié dans le service
  @ApiParam({ name: 'activityId', description: 'Activity UUID' })
  @ApiHeader({ name: 'x-correlation-id', required: false })
  @ApiOperation({
    summary: 'Accept a proposed activity (course/pedagogical meeting slot)',
    description:
      'Chantier calendrier de disponibilités, point 3. Transitions a PROPOSED ' +
      'activity to CONFIRMED. The requesting user must be the targeted recipient ' +
      "(present in participantIds) — the activity's creator cannot accept their " +
      'own proposal. Publishes ActivityConfirmed event.',
  })
  @ApiResponse({ status: 201, description: 'Activity confirmed — emits ActivityConfirmed event' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — not the targeted recipient' })
  @ApiResponse({ status: 404, description: 'Activity not found' })
  @ApiResponse({ status: 409, description: 'Activity already processed (status is not PROPOSED)' })
  acceptActivity(
    @Param('activityId', ParseUUIDPipe) activityId: string,
    @CurrentUser() actor: AuthenticatedUser,
    @CorrelationId() correlationId?: string,
  ): Promise<ScheduledActivity> {
    return this.activitiesService.accept(activityId, actor, correlationId);
  }

  @Post(':activityId/decline')
  @Roles(UserRole.ELEVE, UserRole.PARENT_FINANCEUR, UserRole.FORMATEUR, UserRole.ANIMATEUR_PEDAGOGIQUE, UserRole.RESPONSABLE_PEDAGOGIQUE, UserRole.TECHNICIEN_INFORMATIQUE, UserRole.ADMINISTRATEUR_FINANCIER) // seul le destinataire visé peut répondre, vérifié dans le service
  @ApiParam({ name: 'activityId', description: 'Activity UUID' })
  @ApiHeader({ name: 'x-correlation-id', required: false })
  @ApiOperation({
    summary: 'Decline a proposed activity (course/pedagogical meeting slot)',
    description:
      'Chantier calendrier de disponibilités, point 3. Transitions a PROPOSED ' +
      'activity to CANCELLED. The requesting user must be the targeted recipient ' +
      '(present in participantIds). Publishes ActivityDeclined event.',
  })
  @ApiResponse({ status: 201, description: 'Activity cancelled — emits ActivityDeclined event' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — not the targeted recipient' })
  @ApiResponse({ status: 404, description: 'Activity not found' })
  @ApiResponse({ status: 409, description: 'Activity already processed (status is not PROPOSED)' })
  declineActivity(
    @Param('activityId', ParseUUIDPipe) activityId: string,
    @CurrentUser() actor: AuthenticatedUser,
    @CorrelationId() correlationId?: string,
  ): Promise<ScheduledActivity> {
    return this.activitiesService.decline(activityId, actor, correlationId);
  }
}
