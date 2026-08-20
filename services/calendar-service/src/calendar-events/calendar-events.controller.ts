import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  ParseUUIDPipe,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
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
import { CalendarEventsService, CalendarEventView } from './calendar-events.service';
import { CreateCalendarEventDto } from './dto/create-calendar-event.dto';
import { ListEventsQueryDto } from './dto/list-events-query.dto';
import { CalendarEvent } from './entities/calendar-event.entity';

/**
 * Resource root: calendar events (`/calendars/{ownerId}/events`).
 * Invitations, cancellations, reminders and visibility grants are exposed
 * by their own dedicated controllers (see event-invitations.controller.ts,
 * event-cancellations.controller.ts, event-reminders.controller.ts,
 * calendar-visibility-grants.controller.ts).
 */
@ApiTags('calendar-events')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('calendars/:ownerId/events')
export class CalendarEventsController {
  constructor(private readonly calendarEventsService: CalendarEventsService) {}

  @Get()
  @Roles(UserRole.ELEVE, UserRole.PARENT_FINANCEUR, UserRole.FORMATEUR, UserRole.ANIMATEUR_PEDAGOGIQUE, UserRole.RESPONSABLE_PEDAGOGIQUE, UserRole.TECHNICIEN_INFORMATIQUE, UserRole.ADMINISTRATEUR_FINANCIER) // accès filtré par ownership/filtrage dans le service
  @ApiParam({ name: 'ownerId', description: 'Calendar owner user ID' })
  @ApiHeader({ name: 'x-correlation-id', required: false })
  @ApiOperation({
    summary: 'List authorized calendar events',
    description:
      'Returns events for the given owner calendar filtered by the requester\'s role. ' +
      'PARENT_FINANCEUR and ADMINISTRATEUR_FINANCIER see only FINANCIER events. ' +
      'Supports optional filters: type and personId. ' +
      'Bug corrigé le 2026-08-20 : renvoie désormais aussi les événements où ownerId ' +
      'est invité (pas seulement créateur), avec viewerInvitationStatus — voir docs/routes.md.',
  })
  @ApiResponse({ status: 200, description: 'List of events returned — see docs/routes.md for the exact CalendarEventView shape' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient access to this calendar' })
  listEvents(
    @Param('ownerId', ParseUUIDPipe) ownerId: string,
    @Query() query: ListEventsQueryDto,
    @CurrentUser() actor: AuthenticatedUser,
    @CorrelationId() correlationId?: string,
  ): Promise<CalendarEventView[]> {
    return this.calendarEventsService.listEvents(ownerId, actor, query, correlationId);
  }

  @Post()
  @Roles(UserRole.ELEVE, UserRole.FORMATEUR, UserRole.ANIMATEUR_PEDAGOGIQUE, UserRole.RESPONSABLE_PEDAGOGIQUE)
  @ApiParam({ name: 'ownerId', description: 'Calendar owner user ID' })
  @ApiHeader({ name: 'x-correlation-id', required: false })
  @ApiOperation({
    summary: 'Create a calendar event',
    description:
      'Creates an event on the specified calendar. ' +
      'Role-based type restrictions apply: ' +
      'ELEVE → rappel only; ' +
      'FORMATEUR → cours, masterclass, pedagogique, rappel; ' +
      'ANIMATEUR_PEDAGOGIQUE → pedagogique, rappel; ' +
      'RESPONSABLE_PEDAGOGIQUE → all types. ' +
      'PARENT_FINANCEUR and ADMINISTRATEUR_FINANCIER cannot create events.',
  })
  @ApiResponse({ status: 201, description: 'Event created — emits CalendarEventCreated event' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — role not allowed to create this event type' })
  createEvent(
    @Param('ownerId', ParseUUIDPipe) ownerId: string,
    @Body() dto: CreateCalendarEventDto,
    @CurrentUser() actor: AuthenticatedUser,
    @CorrelationId() correlationId?: string,
  ): Promise<CalendarEvent> {
    return this.calendarEventsService.createEvent(ownerId, dto, actor, correlationId);
  }

  @Delete(':eventId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.ELEVE, UserRole.FORMATEUR, UserRole.ANIMATEUR_PEDAGOGIQUE, UserRole.RESPONSABLE_PEDAGOGIQUE, UserRole.TECHNICIEN_INFORMATIQUE) // accès filtré par ownership dans le service (créateur, RP ou TI)
  @ApiParam({ name: 'ownerId', description: 'Calendar owner user ID' })
  @ApiParam({ name: 'eventId', description: 'Event UUID' })
  @ApiHeader({ name: 'x-correlation-id', required: false })
  @ApiOperation({
    summary: 'Delete a calendar event',
    description:
      'Ajoutée le 2026-08-20 (route absente jusqu\'ici, contrairement à ' +
      'DELETE /activities/:activityId). Hard delete — même politique que ' +
      'POST /events/:id/cancel-request : réservée au créateur, RP ou TI. ' +
      '404 si l\'événement n\'existe pas ou n\'appartient pas à cet ownerId ' +
      '(pas de fuite d\'existence). Émet CalendarEventDeleted.',
  })
  @ApiResponse({ status: 204, description: 'Event deleted — emits CalendarEventDeleted event' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — only the creator, RP or TI can delete' })
  @ApiResponse({ status: 404, description: 'Event not found for this owner' })
  deleteEvent(
    @Param('ownerId', ParseUUIDPipe) ownerId: string,
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @CurrentUser() actor: AuthenticatedUser,
    @CorrelationId() correlationId?: string,
  ): Promise<void> {
    return this.calendarEventsService.deleteEvent(ownerId, eventId, actor, correlationId);
  }
}
