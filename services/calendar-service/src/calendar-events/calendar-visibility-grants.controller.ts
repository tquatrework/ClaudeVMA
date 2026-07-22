import {
  Controller,
  Post,
  Delete,
  Param,
  ParseUUIDPipe,
  Body,
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
import { CalendarEventsService } from './calendar-events.service';
import { CreateVisibilityGrantDto } from './dto/create-visibility-grant.dto';
import { CalendarVisibilityGrant } from './entities/calendar-visibility-grant.entity';

export interface RevokeVisibilityGrantResponse {
  revoked: boolean;
}

/** Resource root: calendar visibility grants (`/calendars/{ownerId}/grants`), RP only. */
@ApiTags('calendar-visibility-grants')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('calendars/:ownerId/grants')
export class CalendarVisibilityGrantsController {
  constructor(private readonly calendarEventsService: CalendarEventsService) {}

  @Post()
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
    @Param('ownerId', ParseUUIDPipe) ownerId: string,
    @Body() dto: CreateVisibilityGrantDto,
    @CurrentUser() actor: AuthenticatedUser,
    @CorrelationId() correlationId?: string,
  ): Promise<CalendarVisibilityGrant> {
    return this.calendarEventsService.createVisibilityGrant(
      ownerId,
      dto,
      actor.id,
      actor.role,
      correlationId,
    );
  }

  @Delete(':granteeId')
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
    @Param('ownerId', ParseUUIDPipe) ownerId: string,
    @Param('granteeId', ParseUUIDPipe) granteeId: string,
    @CurrentUser() actor: AuthenticatedUser,
    @CorrelationId() correlationId?: string,
  ): Promise<RevokeVisibilityGrantResponse> {
    return this.calendarEventsService.revokeVisibilityGrant(
      ownerId,
      granteeId,
      actor.role,
      correlationId,
    );
  }
}
