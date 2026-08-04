import {
  Controller,
  Get,
  Put,
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
import { CalendarsService } from './calendars.service';
import { UpdateAvailabilityDto } from './dto/update-availability.dto';
import { Calendar } from './entities/calendar.entity';
import { PaymentScheduleEntry } from './entities/payment-schedule-entry.entity';

@ApiTags('calendars')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('calendars')
export class CalendarsController {
  constructor(private readonly calendarsService: CalendarsService) {}

  @Get(':ownerId')
  @Roles(UserRole.ELEVE, UserRole.PARENT_FINANCEUR, UserRole.FORMATEUR, UserRole.ANIMATEUR_PEDAGOGIQUE, UserRole.RESPONSABLE_PEDAGOGIQUE, UserRole.TECHNICIEN_INFORMATIQUE, UserRole.ADMINISTRATEUR_FINANCIER) // accès filtré par ownership/relation dans le service
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
    @Param('ownerId', ParseUUIDPipe) ownerId: string,
    @CurrentUser() actor: AuthenticatedUser,
    @CorrelationId() correlationId?: string,
  ): Promise<Calendar & { paymentEntries?: PaymentScheduleEntry[] }> {
    return this.calendarsService.getCalendar(ownerId, actor, correlationId);
  }

  @Put(':ownerId/availability')
  @Roles(UserRole.FORMATEUR, UserRole.RESPONSABLE_PEDAGOGIQUE, UserRole.ANIMATEUR_PEDAGOGIQUE) // accès filtré par ownership/relation dans le service
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
    @Param('ownerId', ParseUUIDPipe) ownerId: string,
    @Body() dto: UpdateAvailabilityDto,
    @CurrentUser() actor: AuthenticatedUser,
    @CorrelationId() correlationId?: string,
  ): Promise<Calendar> {
    return this.calendarsService.updateAvailability(ownerId, dto, actor, correlationId);
  }
}
