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
import { CancelRequestDto } from './dto/cancel-request.dto';
import { CancellationRequest } from './entities/cancellation-request.entity';

/** Resource root: event cancellation requests (`/events/{id}/cancel-request`). */
@ApiTags('event-cancellations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('events/:id/cancel-request')
export class EventCancellationsController {
  constructor(private readonly calendarEventsService: CalendarEventsService) {}

  @Post()
  @Roles(UserRole.ELEVE, UserRole.FORMATEUR, UserRole.ANIMATEUR_PEDAGOGIQUE, UserRole.RESPONSABLE_PEDAGOGIQUE) // accès filtré dans le service
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
    @Param('id', ParseUUIDPipe) eventId: string,
    @Body() dto: CancelRequestDto,
    @CurrentUser() actor: AuthenticatedUser,
    @CorrelationId() correlationId?: string,
  ): Promise<CancellationRequest> {
    return this.calendarEventsService.requestCancellation(
      eventId,
      dto,
      actor.id,
      actor.role,
      correlationId,
    );
  }
}
