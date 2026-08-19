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
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../common/guards/jwt-auth.guard';

@ApiTags('video')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('video')
export class VideoSessionController {
  constructor(private readonly service: VideoSessionService) {}

  /**
   * POST /video/rooms — Create a new video room linked to a calendar activity.
   * VID-BR-004: calendarSessionId is mandatory.
   * Only formateur, RP, AP and TI may create a room (VID-RA-002, VID-RA-004).
   */
  @Post('rooms')
  @Roles(
    UserRole.FORMATEUR,
    UserRole.RESPONSABLE_PEDAGOGIQUE,
    UserRole.ANIMATEUR_PEDAGOGIQUE,
    UserRole.TECHNICIEN_INFORMATIQUE,
  )
  @ApiOperation({
    summary: 'Create a video room',
    description:
      'Creates a real LiveKit room linked to a calendar session. ' +
      'Only formateurs and pedagogical staff (RP, AP, TI) may create a room (VID-BR-004).',
  })
  @ApiResponse({ status: 201, description: 'Room created with unique token' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthenticated' })
  @ApiResponse({ status: 403, description: 'Insufficient role' })
  @ApiResponse({ status: 503, description: 'LiveKit is unreachable' })
  createRoom(
    @Body() dto: CreateRoomDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.create(dto, user.sub, user.role);
  }

  /**
   * GET /video/rooms/by-activity/:activityId — Resolve the room automatically
   * created for a confirmed calendar activity (chantier calendrier-visio-livekit,
   * point 4). Declared BEFORE `rooms/:roomId` below so the literal segment
   * `by-activity` is never captured as a `:roomId` value.
   */
  @Get('rooms/by-activity/:activityId')
  @ApiParam({ name: 'activityId', description: 'ScheduledActivity UUID (calendar-service)' })
  @ApiOperation({
    summary: 'Resolve the video room linked to a calendar activity',
    description:
      'Returns the room automatically created when the activity (type "cours") was ' +
      'confirmed. 404 if the activity has no room yet (not confirmed, not a "cours", ' +
      'or the event has not been consumed yet).',
  })
  @ApiResponse({ status: 200, description: 'Room details' })
  @ApiResponse({ status: 401, description: 'Unauthenticated' })
  @ApiResponse({ status: 404, description: 'No room for this activity' })
  getRoomByActivity(@Param('activityId', ParseUUIDPipe) activityId: string) {
    return this.service.findByActivityId(activityId);
  }

  /**
   * GET /video/rooms/:roomId — Get room details.
   * All authenticated users may query a room.
   * Droits contextuels vérifiés dans le service (aucun — tout utilisateur authentifié peut lire les détails d'une salle).
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
   * GET /video/rooms/:roomId/join — Obtain a real LiveKit access token to join the room.
   * VID-BR-005: only authorised participants obtain a token.
   * VID-FB-001: parent_financeur is blocked.
   * Droits contextuels vérifiés dans le service (rôle participant autorisé : eleve, formateur, RP, AP, TI — parent_financeur et administrateur_financier exclus par VID-FB-001).
   *
   * Contract change (2026-08-19): returns `{token, url}` for the LiveKit client
   * SDK. Replaces the previous `{accessToken, roomToken, status}` shape — see
   * docs/routes.md for the full note.
   */
  @Get('rooms/:roomId/join')
  @ApiParam({ name: 'roomId', description: 'Room UUID' })
  @ApiOperation({
    summary: 'Join a video room',
    description:
      'Generates a real LiveKit access token (JWT) and returns it together with the ' +
      'public LiveKit URL for the client SDK to connect to. Transitions the room from ' +
      'WAITING to ACTIVE on first join. Parents are explicitly denied (VID-FB-001).',
  })
  @ApiResponse({ status: 200, description: '{token, url}' })
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
   * Droits contextuels vérifiés dans le service (rôle participant autorisé : eleve, formateur, RP, AP, TI — parent_financeur et administrateur_financier exclus).
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
  @Roles(
    UserRole.FORMATEUR,
    UserRole.RESPONSABLE_PEDAGOGIQUE,
    UserRole.ANIMATEUR_PEDAGOGIQUE,
    UserRole.TECHNICIEN_INFORMATIQUE,
  )
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

  /**
   * POST /video/rooms/:roomId/recordings — Declare a recording (VID-AC-001).
   */
  @Post('rooms/:roomId/recordings')
  @Roles(
    UserRole.FORMATEUR,
    UserRole.RESPONSABLE_PEDAGOGIQUE,
    UserRole.ANIMATEUR_PEDAGOGIQUE,
    UserRole.TECHNICIEN_INFORMATIQUE,
  )
  @ApiParam({ name: 'roomId', description: 'Room UUID' })
  @ApiOperation({
    summary: 'Declare a recording',
    description: 'Declares that a recording is available; expires after 30 days (VID-AC-001).',
  })
  @ApiResponse({ status: 201, description: 'Recording declared' })
  @ApiResponse({ status: 400, description: 'Room not ended yet' })
  @ApiResponse({ status: 401, description: 'Unauthenticated' })
  @ApiResponse({ status: 403, description: 'Role not allowed' })
  @ApiResponse({ status: 404, description: 'Room not found' })
  declareRecording(
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @Body() dto: DeclareRecordingDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.declareRecording(roomId, dto, user.sub, user.role);
  }

  /**
   * GET /video/rooms/:roomId/recordings — List recordings visible for a room.
   */
  @Get('rooms/:roomId/recordings')
  @ApiParam({ name: 'roomId', description: 'Room UUID' })
  @ApiOperation({
    summary: 'List recordings',
    description: 'Lists recordings visible for this room (VID-FB-001, VID-AC-001).',
  })
  @ApiResponse({ status: 200, description: 'Recordings list' })
  @ApiResponse({ status: 401, description: 'Unauthenticated' })
  @ApiResponse({ status: 403, description: 'Role not allowed' })
  @ApiResponse({ status: 404, description: 'Room not found' })
  listRecordings(
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.listRecordings(roomId, user.sub, user.role);
  }

  /**
   * POST /video/rooms/:roomId/summary — Publish a permanent course summary (VID-AC-002).
   */
  @Post('rooms/:roomId/summary')
  @Roles(
    UserRole.FORMATEUR,
    UserRole.RESPONSABLE_PEDAGOGIQUE,
    UserRole.ANIMATEUR_PEDAGOGIQUE,
  )
  @ApiParam({ name: 'roomId', description: 'Room UUID' })
  @ApiOperation({
    summary: 'Publish a course summary',
    description:
      'Publishes a permanent course summary that survives video expiry (VID-AC-002).',
  })
  @ApiResponse({ status: 201, description: 'Summary published' })
  @ApiResponse({ status: 401, description: 'Unauthenticated' })
  @ApiResponse({ status: 403, description: 'Role not allowed' })
  @ApiResponse({ status: 404, description: 'Room not found' })
  publishSummary(
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @Body() dto: PublishSummaryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.publishSummary(roomId, dto, user.sub, user.role);
  }
}

/**
 * RecordingCommentsController — top-level `/recordings/:recordingId/comments`
 * route (not nested under `/video`, matching the documented contract in
 * docs/routes.md).
 */
@ApiTags('video')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('recordings')
export class RecordingCommentsController {
  constructor(private readonly service: VideoSessionService) {}

  /**
   * POST /recordings/:recordingId/comments — Add a timestamped comment (VID-FB-001).
   */
  @Post(':recordingId/comments')
  @ApiParam({ name: 'recordingId', description: 'Recording UUID' })
  @ApiOperation({
    summary: 'Add a timestamped comment',
    description:
      'Adds a timestamped comment on a recording. Eleve is refused once the ' +
      'recording has expired; formateur/RP/AP/TI may always comment (VID-FB-001).',
  })
  @ApiResponse({ status: 201, description: 'Comment created' })
  @ApiResponse({ status: 400, description: 'Recording expired (eleve only)' })
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
