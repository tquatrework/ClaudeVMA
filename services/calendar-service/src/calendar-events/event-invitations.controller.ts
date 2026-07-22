import {
  Controller,
  Post,
  Param,
  ParseUUIDPipe,
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
import { EventInvitation } from './entities/event-invitation.entity';

/** Resource root: event invitations (`/events/{id}/invitees/{userId}`). */
@ApiTags('event-invitations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('events/:id/invitees/:userId')
export class EventInvitationsController {
  constructor(private readonly calendarEventsService: CalendarEventsService) {}

  @Post('accept')
  @Roles(UserRole.ELEVE, UserRole.PARENT_FINANCEUR, UserRole.FORMATEUR, UserRole.ANIMATEUR_PEDAGOGIQUE, UserRole.RESPONSABLE_PEDAGOGIQUE, UserRole.TECHNICIEN_INFORMATIQUE, UserRole.ADMINISTRATEUR_FINANCIER) // ownership vérifiée dans le service
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
  @ApiResponse({ status: 403, description: 'Forbidden — not the invitee' })
  @ApiResponse({ status: 404, description: 'Event or invitation not found' })
  @ApiResponse({ status: 409, description: 'Invitation already processed' })
  acceptInvitation(
    @Param('id', ParseUUIDPipe) eventId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() actor: AuthenticatedUser,
    @CorrelationId() correlationId?: string,
  ): Promise<EventInvitation> {
    return this.calendarEventsService.acceptInvitation(eventId, userId, actor, correlationId);
  }

  @Post('decline')
  @Roles(UserRole.ELEVE, UserRole.PARENT_FINANCEUR, UserRole.FORMATEUR, UserRole.ANIMATEUR_PEDAGOGIQUE, UserRole.RESPONSABLE_PEDAGOGIQUE, UserRole.TECHNICIEN_INFORMATIQUE, UserRole.ADMINISTRATEUR_FINANCIER) // ownership vérifiée dans le service
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
  @ApiResponse({ status: 403, description: 'Forbidden — not the invitee' })
  @ApiResponse({ status: 404, description: 'Event or invitation not found' })
  @ApiResponse({ status: 409, description: 'Invitation already processed' })
  declineInvitation(
    @Param('id', ParseUUIDPipe) eventId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() actor: AuthenticatedUser,
    @CorrelationId() correlationId?: string,
  ): Promise<EventInvitation> {
    return this.calendarEventsService.declineInvitation(eventId, userId, actor, correlationId);
  }
}
