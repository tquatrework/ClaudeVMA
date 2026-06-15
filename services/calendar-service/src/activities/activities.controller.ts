import {
  Controller,
  Post,
  Put,
  Get,
  Param,
  Body,
  UseGuards,
  Req,
  Headers,
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
import { ActivitiesService } from './activities.service';
import { CreateActivityDto } from './dto/create-activity.dto';
import { UpdateActivityDto } from './dto/update-activity.dto';

@ApiTags('activities')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('activities')
export class ActivitiesController {
  constructor(private readonly activitiesService: ActivitiesService) {}

  @Post()
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
    @Req() req: any,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.activitiesService.create(dto, req.user.id, req.user.role, correlationId);
  }

  @Put(':activityId')
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
    @Param('activityId') activityId: string,
    @Body() dto: UpdateActivityDto,
    @Req() req: any,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.activitiesService.update(activityId, dto, req.user.id, req.user.role, correlationId);
  }

  @Get(':activityId')
  @ApiParam({ name: 'activityId', description: 'Activity UUID' })
  @ApiOperation({ summary: 'Get an activity by ID' })
  @ApiResponse({ status: 200, description: 'Activity found' })
  @ApiResponse({ status: 404, description: 'Not found' })
  @ApiResponse({ status: 403, description: 'Forbidden — IDOR check' })
  getActivity(@Param('activityId') activityId: string, @Req() req: any) {
    return this.activitiesService.findOne(activityId, req.user.id, req.user.role);
  }
}
