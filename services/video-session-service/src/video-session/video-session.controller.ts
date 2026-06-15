import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { VideoSessionService } from './video-session.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { RecordAttendanceDto } from './dto/record-attendance.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../common/guards/jwt-auth.guard';

@ApiTags('video')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('video')
export class VideoSessionController {
  constructor(private readonly service: VideoSessionService) {}

  /**
   * POST /video/rooms — Create a new video room linked to a calendar activity.
   * VID-BR-004: calendarSessionId is mandatory.
   * Only formateur, RP, AP and TI may create a room (VID-RA-002, VID-RA-004).
   */
  @Post('rooms')
  @ApiOperation({
    summary: 'Create a video room',
    description:
      'Creates a video room linked to a calendar session. ' +
      'Only formateurs and pedagogical staff (RP, AP, TI) may create a room (VID-BR-004).',
  })
  @ApiResponse({ status: 201, description: 'Room created with unique token' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthenticated' })
  @ApiResponse({ status: 403, description: 'Insufficient role' })
  createRoom(
    @Body() dto: CreateRoomDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.create(dto, user.sub, user.role);
  }

  /**
   * GET /video/rooms/:roomId — Get room details.
   * All authenticated users may query a room.
   */
  @Get('rooms/:roomId')
  @ApiParam({ name: 'roomId', description: 'Room UUID' })
  @ApiOperation({
    summary: 'Get room info',
    description: 'Returns the details of a video room by its UUID.',
  })
  @ApiResponse({ status: 200, description: 'Room details' })
  @ApiResponse({ status: 401, description: 'Unauthenticated' })
  @ApiResponse({ status: 404, description: 'Room not found' })
  getRoom(@Param('roomId', ParseUUIDPipe) roomId: string) {
    return this.service.findOne(roomId);
  }

  /**
   * GET /video/rooms/:roomId/join — Obtain an access token to join the room.
   * VID-BR-005: only authorised participants obtain a token.
   * VID-FB-001: parent_financeur is blocked.
   */
  @Get('rooms/:roomId/join')
  @ApiParam({ name: 'roomId', description: 'Room UUID' })
  @ApiOperation({
    summary: 'Join a video room',
    description:
      'Generates a scoped access token for the requesting user. ' +
      'Transitions the room from WAITING to ACTIVE on first join. ' +
      'Parents are explicitly denied (VID-FB-001).',
  })
  @ApiResponse({ status: 200, description: 'Access token and room token' })
  @ApiResponse({ status: 400, description: 'Session already ended' })
  @ApiResponse({ status: 401, description: 'Unauthenticated' })
  @ApiResponse({ status: 403, description: 'Role not allowed to join' })
  @ApiResponse({ status: 404, description: 'Room not found' })
  joinRoom(
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.join(roomId, user.sub, user.role);
  }

  /**
   * POST /video/rooms/:roomId/attendance — Record presence for a participant.
   * VID-BR-006: presence data feeds pedagogical-log and finance after session close.
   */
  @Post('rooms/:roomId/attendance')
  @ApiParam({ name: 'roomId', description: 'Room UUID' })
  @ApiOperation({
    summary: 'Record attendance',
    description:
      'Records a participant join/leave timestamp. ' +
      'Data is used after session close to populate the pedagogical log (VID-BR-006).',
  })
  @ApiResponse({ status: 201, description: 'Attendance record created' })
  @ApiResponse({ status: 400, description: 'Session already ended' })
  @ApiResponse({ status: 401, description: 'Unauthenticated' })
  @ApiResponse({ status: 403, description: 'Role not allowed' })
  @ApiResponse({ status: 404, description: 'Room not found' })
  recordAttendance(
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @Body() dto: RecordAttendanceDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.recordAttendance(roomId, user.sub, user.role, dto);
  }

  /**
   * POST /video/rooms/:roomId/close — Close a video session.
   * VID-BR-006: publishes VideoSessionEnded for pedagogical-log-service.
   */
  @Post('rooms/:roomId/close')
  @ApiParam({ name: 'roomId', description: 'Room UUID' })
  @ApiOperation({
    summary: 'Close a video session',
    description:
      'Marks the room as ENDED and publishes VideoSessionEnded event. ' +
      'The event payload includes attendance records for pedagogical-log-service (VID-BR-006).',
  })
  @ApiResponse({ status: 201, description: 'Room closed with session ended event' })
  @ApiResponse({ status: 400, description: 'Room already ended' })
  @ApiResponse({ status: 401, description: 'Unauthenticated' })
  @ApiResponse({ status: 403, description: 'Insufficient role' })
  @ApiResponse({ status: 404, description: 'Room not found' })
  closeRoom(
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.end(roomId, user.sub, user.role);
  }
}
