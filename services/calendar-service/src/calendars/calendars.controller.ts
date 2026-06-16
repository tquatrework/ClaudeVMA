import {
  Controller,
  Get,
  Put,
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
import { CalendarsService } from './calendars.service';
import { UpdateAvailabilityDto } from './dto/update-availability.dto';

@ApiTags('calendars')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('calendars')
export class CalendarsController {
  constructor(private readonly calendarsService: CalendarsService) {}

  @Get(':ownerId')
  @ApiParam({ name: 'ownerId', description: 'User ID whose calendar to read' })
  @ApiHeader({ name: 'x-correlation-id', required: false, description: 'Correlation ID for tracing' })
  @ApiOperation({
    summary: 'Get a user calendar',
    description:
      'Returns the calendar (availability slots + activities). ' +
      'CAL-FB-001: requester must be the owner or hold an internal role (RP, AP, TI, FINANCE_ADMIN). ' +
      'CAL-BR-003: PARENT_FINANCEUR also receives payment schedule entries.',
  })
  @ApiResponse({ status: 200, description: 'Calendar returned' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — CAL-FB-001' })
  @ApiResponse({ status: 404, description: 'Not found' })
  getCalendar(
    @Param('ownerId') ownerId: string,
    @Req() req: any,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.calendarsService.getCalendar(
      ownerId,
      req.user.id,
      req.user.role,
      correlationId,
    );
  }

  @Get(':ownerId/availability')
  @ApiParam({ name: 'ownerId', description: 'User ID whose availability to read' })
  @ApiHeader({ name: 'x-correlation-id', required: false })
  @ApiOperation({
    summary: 'Read availability slots',
    description:
      'Returns the availability slots for a user. ' +
      'CAL-FB-001: requester must be the owner or hold an internal role (RP, AP, TI, FINANCE_ADMIN).',
  })
  @ApiResponse({ status: 200, description: 'Availability slots returned' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — CAL-FB-001' })
  async getAvailability(
    @Param('ownerId') ownerId: string,
    @Req() req: any,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    const calendar = await this.calendarsService.getCalendar(
      ownerId,
      req.user.id,
      req.user.role,
      correlationId,
    );
    return { ownerId, availabilitySlots: calendar.availabilitySlots ?? [] };
  }

  @Put(':ownerId/availability')
  @ApiParam({ name: 'ownerId', description: 'User ID whose availability to update' })
  @ApiHeader({ name: 'x-correlation-id', required: false })
  @ApiOperation({
    summary: 'Update availability slots',
    description:
      'Replaces all availability slots for a user. ' +
      'CAL-BR-001 (student) / CAL-BR-002 (teacher). ' +
      'CAL-FB-001: only owner, RP, or TI can call this endpoint.',
  })
  @ApiResponse({ status: 200, description: 'Availability updated — emits AvailabilityUpdated event' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — CAL-FB-001' })
  updateAvailability(
    @Param('ownerId') ownerId: string,
    @Body() dto: UpdateAvailabilityDto,
    @Req() req: any,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.calendarsService.updateAvailability(
      ownerId,
      dto,
      req.user.id,
      req.user.role,
      correlationId,
    );
  }
}
