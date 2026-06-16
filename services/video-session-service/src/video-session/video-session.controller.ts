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
import { DeclareRecordingDto } from './dto/declare-recording.dto';
import { AddCommentDto } from './dto/add-comment.dto';
import { PublishSummaryDto } from './dto/publish-summary.dto';
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

  // ─── Recordings ─────────────────────────────────────────────────────────────

  /**
   * POST /video/rooms/:roomId/recordings — Declare a recording for an ended session.
   * VID-AC-001: expires 30 days after creation; parent_financeur is blocked.
   */
  @Post('rooms/:roomId/recordings')
  @ApiParam({ name: 'roomId', description: 'Room UUID' })
  @ApiOperation({
    summary: 'Declare a recording',
    description:
      'Declares that a recording is available for an ended session. ' +
      'The recording expires automatically 30 days after declaration. ' +
      'Only formateur, RP, AP and TI may declare recordings (VID-AC-001).',
  })
  @ApiResponse({ status: 201, description: 'Recording declared with expiry date' })
  @ApiResponse({ status: 400, description: 'Room is not ended' })
  @ApiResponse({ status: 401, description: 'Unauthenticated' })
  @ApiResponse({ status: 403, description: 'Insufficient role' })
  @ApiResponse({ status: 404, description: 'Room not found' })
  declareRecording(
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @Body() dto: DeclareRecordingDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.declareRecording(roomId, dto, user.sub, user.role);
  }

  /**
   * GET /video/rooms/:roomId/recordings — List recordings visible to the user.
   * VID-FB-001: parent_financeur is blocked.
   */
  @Get('rooms/:roomId/recordings')
  @ApiParam({ name: 'roomId', description: 'Room UUID' })
  @ApiOperation({
    summary: 'List recordings',
    description:
      'Returns all recordings declared for a room. ' +
      'Parent financeurs are explicitly denied (VID-FB-001). ' +
      'Formateurs and staff see all recordings including expired ones.',
  })
  @ApiResponse({ status: 200, description: 'List of recordings' })
  @ApiResponse({ status: 401, description: 'Unauthenticated' })
  @ApiResponse({ status: 403, description: 'Role not allowed to view recordings' })
  @ApiResponse({ status: 404, description: 'Room not found' })
  listRecordings(
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.listRecordings(roomId, user.sub, user.role);
  }

  /**
   * POST /video/rooms/:roomId/summary — Publish a course summary.
   * VID-AC-002: summaries are permanent and survive video expiry.
   */
  @Post('rooms/:roomId/summary')
  @ApiParam({ name: 'roomId', description: 'Room UUID' })
  @ApiOperation({
    summary: 'Publish a course summary',
    description:
      'Publishes a pedagogical summary for a completed session. ' +
      'The summary is permanent (isPermanent: true) and survives recording expiry. ' +
      'Only formateur, RP and AP may publish summaries (VID-AC-002).',
  })
  @ApiResponse({ status: 201, description: 'Course summary published' })
  @ApiResponse({ status: 401, description: 'Unauthenticated' })
  @ApiResponse({ status: 403, description: 'Insufficient role' })
  @ApiResponse({ status: 404, description: 'Room not found' })
  publishSummary(
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @Body() dto: PublishSummaryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.publishSummary(roomId, dto, user.sub, user.role);
  }
}

// ─── Recording comments controller ───────────────────────────────────────────

@ApiTags('recordings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('recordings')
export class RecordingCommentsController {
  constructor(private readonly service: VideoSessionService) {}

  /**
   * POST /recordings/:recordingId/comments — Add a timestamped comment.
   * VID-FB-001: parent_financeur is blocked.
   */
  @Post(':recordingId/comments')
  @ApiParam({ name: 'recordingId', description: 'Recording UUID' })
  @ApiOperation({
    summary: 'Add a timestamped comment on a recording',
    description:
      'Adds a comment at a specific position in the recording (seconds). ' +
      'Parent financeurs are blocked (VID-FB-001). ' +
      'Students may only comment on non-expired recordings.',
  })
  @ApiResponse({ status: 201, description: 'Comment added' })
  @ApiResponse({ status: 400, description: 'Recording has expired (for restricted roles)' })
  @ApiResponse({ status: 401, description: 'Unauthenticated' })
  @ApiResponse({ status: 403, description: 'Role not allowed' })
  @ApiResponse({ status: 404, description: 'Recording not found' })
  addComment(
    @Param('recordingId', ParseUUIDPipe) recordingId: string,
    @Body() dto: AddCommentDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.addComment(recordingId, dto, user.sub, user.role);
  }
}
