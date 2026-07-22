import {
  Controller,
  Post,
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
import { CalendarEventsService } from './calendar-events.service';
import { ConfigureReminderDto } from './dto/configure-reminder.dto';
import { ReminderRule } from './entities/reminder-rule.entity';

/** Resource root: per-event reminder rules (`/events/{id}/reminders`). */
@ApiTags('event-reminders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('events/:id/reminders')
export class EventRemindersController {
  constructor(private readonly calendarEventsService: CalendarEventsService) {}

  @Post()
  @Roles(UserRole.ELEVE, UserRole.PARENT_FINANCEUR, UserRole.FORMATEUR, UserRole.ANIMATEUR_PEDAGOGIQUE, UserRole.RESPONSABLE_PEDAGOGIQUE, UserRole.TECHNICIEN_INFORMATIQUE, UserRole.ADMINISTRATEUR_FINANCIER) // accès filtré par ownership dans le service
  @ApiParam({ name: 'id', description: 'Event UUID' })
  @ApiHeader({ name: 'x-correlation-id', required: false })
  @ApiOperation({
    summary: 'Configure a reminder rule for an event',
    description:
      'Sets a reminder rule for the requesting user on a specific event. ' +
      'Valid delays: 1week, 1day, 1hour, 15min, none. ' +
      'Choosing "none" removes any existing reminder rule.',
  })
  @ApiResponse({ status: 201, description: 'Reminder rule configured' })
  @ApiResponse({ status: 400, description: 'Validation error — invalid delay value' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  configureReminder(
    @Param('id', ParseUUIDPipe) eventId: string,
    @Body() dto: ConfigureReminderDto,
    @CurrentUser() actor: AuthenticatedUser,
    @CorrelationId() correlationId?: string,
  ): Promise<ReminderRule> {
    return this.calendarEventsService.configureReminder(
      eventId,
      dto,
      actor.id,
      actor.role,
      correlationId,
    );
  }
}
