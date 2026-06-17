import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
  Headers,
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
import { UserRole } from '../common/enums/user-role.enum';
import { CalendarEventsService } from './calendar-events.service';
import { CreateCalendarEventDto } from './dto/create-calendar-event.dto';
import { ListEventsQueryDto } from './dto/list-events-query.dto';
import { CancelRequestDto } from './dto/cancel-request.dto';
import { ConfigureReminderDto } from './dto/configure-reminder.dto';
import { CreateVisibilityGrantDto } from './dto/create-visibility-grant.dto';

@ApiTags('calendar-events')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class CalendarEventsController {
  constructor(private readonly calendarEventsService: CalendarEventsService) {}

  // ── /calendars/{ownerId}/events ──────────────────────────────────────────

  @Get('calendars/:ownerId/events')
  @ApiParam({ name: 'ownerId', description: 'Calendar owner user ID' })
  @ApiHeader({ name: 'x-correlation-id', required: false })
  @ApiOperation({
    summary: 'List authorized calendar events',
    description:
      'Returns events for the given owner calendar filtered by the requester\'s role. ' +
      'PARENT_FINANCEUR and ADMINISTRATEUR_FINANCIER see only FINANCIER events. ' +
      'Supports optional filters: type and personId.',
  })
  @ApiResponse({ status: 200, description: 'List of events returned' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient access to this calendar' })
  listEvents(
    @Param('ownerId') ownerId: string,
    @Query() query: ListEventsQueryDto,
    @Req() req: any,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.calendarEventsService.listEvents(
      ownerId,
      req.user.id,
      req.user.role,
      query,
      correlationId,
    );
  }

  @Post('calendars/:ownerId/events')
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
    @Param('ownerId') ownerId: string,
    @Body() dto: CreateCalendarEventDto,
    @Req() req: any,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.calendarEventsService.createEvent(
      ownerId,
      dto,
      req.user.id,
      req.user.role,
      correlationId,
    );
  }

  // ── /events/{id}/invitees/{userId} ────────────────────────────────────────

  @Post('events/:id/invitees/:userId/accept')
  @ApiParam({ name: 'id', description: 'Event UUID' })
  @ApiParam({ name: 'userId', description: 'Invitee user ID' })
  @ApiHeader({ name: 'x-correlation-id', required: false })
  @ApiOperation({
    summary: 'Accept an event invitation',
    description:
      'Marks the invitation as accepted. ' +
      'The requesting user must be the invitee. ' +
      'Publishes InvitationAccepted event.',
  })
  @ApiResponse({ status: 201, description: 'Invitation accepted — emits InvitationAccepted event' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Event or invitation not found' })
  @ApiResponse({ status: 409, description: 'Invitation already processed' })
  acceptInvitation(
    @Param('id') eventId: string,
    @Param('userId') userId: string,
    @Req() req: any,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.calendarEventsService.acceptInvitation(eventId, userId, correlationId);
  }

  @Post('events/:id/invitees/:userId/decline')
  @ApiParam({ name: 'id', description: 'Event UUID' })
  @ApiParam({ name: 'userId', description: 'Invitee user ID' })
  @ApiHeader({ name: 'x-correlation-id', required: false })
  @ApiOperation({
    summary: 'Decline an event invitation',
    description:
      'Marks the invitation as declined. ' +
      'A declined invitation removes the event from the invitee\'s calendar view. ' +
      'Publishes InvitationDeclined event.',
  })
  @ApiResponse({ status: 201, description: 'Invitation declined — emits InvitationDeclined event' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Event or invitation not found' })
  @ApiResponse({ status: 409, description: 'Invitation already processed' })
  declineInvitation(
    @Param('id') eventId: string,
    @Param('userId') userId: string,
    @Req() req: any,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.calendarEventsService.declineInvitation(eventId, userId, correlationId);
  }

  // ── /events/{id}/cancel-request ──────────────────────────────────────────

  @Post('events/:id/cancel-request')
  @ApiParam({ name: 'id', description: 'Event UUID' })
  @ApiHeader({ name: 'x-correlation-id', required: false })
  @ApiOperation({
    summary: 'Request or apply event cancellation',
    description:
      'Requests cancellation of an event. ' +
      'Business rule: if the event starts within 48h, the request status is PENDING_APPROVAL. ' +
      'Otherwise cancellation is applied immediately (APPROVED). ' +
      'Only the event creator, RP, or TI can cancel. ' +
      'Publishes CancellationRequested event.',
  })
  @ApiResponse({ status: 201, description: 'Cancellation request created — emits CancellationRequested event' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — only creator, RP or TI can cancel' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  @ApiResponse({ status: 409, description: 'Event already cancelled' })
  requestCancellation(
    @Param('id') eventId: string,
    @Body() dto: CancelRequestDto,
    @Req() req: any,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.calendarEventsService.requestCancellation(
      eventId,
      dto,
      req.user.id,
      req.user.role,
      correlationId,
    );
  }

  // ── /events/{id}/reminders ────────────────────────────────────────────────

  @Post('events/:id/reminders')
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
    @Param('id') eventId: string,
    @Body() dto: ConfigureReminderDto,
    @Req() req: any,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.calendarEventsService.configureReminder(
      eventId,
      dto,
      req.user.id,
      correlationId,
    );
  }

  // ── /calendars/{ownerId}/availability (GET) ───────────────────────────────

  // ── /calendars/{ownerId}/grants ──────────────────────────────────────────

  @Post('calendars/:ownerId/grants')
  @Roles(UserRole.RESPONSABLE_PEDAGOGIQUE)
  @ApiParam({ name: 'ownerId', description: 'Calendar owner user ID' })
  @ApiHeader({ name: 'x-correlation-id', required: false })
  @ApiOperation({
    summary: 'Grant calendar visibility to a user (RP only)',
    description:
      'Creates a CalendarVisibilityGrant allowing the grantee to read the owner\'s calendar. ' +
      'Only RESPONSABLE_PEDAGOGIQUE can call this endpoint.',
  })
  @ApiResponse({ status: 201, description: 'Visibility grant created' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — only RP can grant visibility' })
  createVisibilityGrant(
    @Param('ownerId') ownerId: string,
    @Body() dto: CreateVisibilityGrantDto,
    @Req() req: any,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.calendarEventsService.createVisibilityGrant(
      ownerId,
      dto,
      req.user.id,
      req.user.role,
      correlationId,
    );
  }

  @Delete('calendars/:ownerId/grants/:granteeId')
  @Roles(UserRole.RESPONSABLE_PEDAGOGIQUE)
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'ownerId', description: 'Calendar owner user ID' })
  @ApiParam({ name: 'granteeId', description: 'User whose access to revoke' })
  @ApiHeader({ name: 'x-correlation-id', required: false })
  @ApiOperation({
    summary: 'Revoke calendar visibility grant (RP only)',
    description:
      'Removes the CalendarVisibilityGrant for the specified grantee on the owner\'s calendar. ' +
      'Only RESPONSABLE_PEDAGOGIQUE can call this endpoint.',
  })
  @ApiResponse({ status: 200, description: 'Visibility grant revoked' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — only RP can revoke visibility' })
  @ApiResponse({ status: 404, description: 'Grant not found' })
  revokeVisibilityGrant(
    @Param('ownerId') ownerId: string,
    @Param('granteeId') granteeId: string,
    @Req() req: any,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.calendarEventsService.revokeVisibilityGrant(
      ownerId,
      granteeId,
      req.user.role,
      correlationId,
    );
  }
}
