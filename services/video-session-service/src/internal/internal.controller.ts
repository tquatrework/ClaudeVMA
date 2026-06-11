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
  ApiHeader,
  ApiParam,
} from '@nestjs/swagger';
import { InternalSecretGuard } from './internal-secret.guard';
import { VideoSessionService } from '../video-session/video-session.service';
import { CreateRoomDto } from '../video-session/dto/create-room.dto';
import { RecordAttendanceDto } from '../video-session/dto/record-attendance.dto';
import { UserRole } from '../common/enums/user-role.enum';

@ApiTags('internal')
@ApiHeader({
  name: 'X-Internal-Secret',
  description: 'Shared secret used by orchestration-service to call this endpoint',
  required: true,
})
@UseGuards(InternalSecretGuard)
@Controller('internal/video')
export class InternalController {
  constructor(private readonly service: VideoSessionService) {}

  /**
   * POST /internal/video/rooms — Orchestrator creates a video room on behalf of a formateur.
   */
  @Post('rooms')
  @ApiOperation({
    summary: '[Internal] Create a video room',
    description:
      'Called by orchestration-service as part of the scheduled-video-course workflow. ' +
      'Creates the room with formateur role by default.',
  })
  @ApiResponse({ status: 201, description: 'Room created' })
  @ApiResponse({ status: 401, description: 'Invalid internal secret' })
  createRoom(@Body() dto: CreateRoomDto) {
    // Internal calls are made by orchestration-service on behalf of a formateur
    return this.service.create(dto, 'orchestration-service', UserRole.FORMATEUR);
  }

  /**
   * GET /internal/video/rooms/:roomId — Get room details for orchestration purposes.
   */
  @Get('rooms/:roomId')
  @ApiParam({ name: 'roomId', description: 'Room UUID' })
  @ApiOperation({
    summary: '[Internal] Get room info',
    description: 'Returns room details for use by orchestration-service.',
  })
  @ApiResponse({ status: 200, description: 'Room details' })
  @ApiResponse({ status: 401, description: 'Invalid internal secret' })
  @ApiResponse({ status: 404, description: 'Room not found' })
  getRoom(@Param('roomId', ParseUUIDPipe) roomId: string) {
    return this.service.findOne(roomId);
  }

  /**
   * POST /internal/video/rooms/:roomId/attendance — Record attendance on behalf of user.
   * Used by orchestration-service to trace presence from external video provider webhooks.
   */
  @Post('rooms/:roomId/attendance')
  @ApiParam({ name: 'roomId', description: 'Room UUID' })
  @ApiOperation({
    summary: '[Internal] Record attendance',
    description:
      'Records attendance on behalf of a participant. ' +
      'Used when attendance data arrives via webhook rather than direct API call.',
  })
  @ApiResponse({ status: 201, description: 'Attendance recorded' })
  @ApiResponse({ status: 401, description: 'Invalid internal secret' })
  @ApiResponse({ status: 404, description: 'Room not found' })
  recordAttendance(
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @Body() dto: InternalAttendanceDto,
  ) {
    const attendanceDto: RecordAttendanceDto = {
      joinedAt: dto.joinedAt,
      leftAt: dto.leftAt,
    };
    return this.service.recordAttendance(roomId, dto.userId, dto.userRole, attendanceDto);
  }

  /**
   * POST /internal/video/rooms/:roomId/close — Close session from orchestration workflow.
   */
  @Post('rooms/:roomId/close')
  @ApiParam({ name: 'roomId', description: 'Room UUID' })
  @ApiOperation({
    summary: '[Internal] Close a video session',
    description:
      'Closes the session and publishes VideoSessionEnded. ' +
      'Called by orchestration-service when the calendar activity ends.',
  })
  @ApiResponse({ status: 201, description: 'Room closed' })
  @ApiResponse({ status: 401, description: 'Invalid internal secret' })
  @ApiResponse({ status: 404, description: 'Room not found' })
  closeRoom(
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @Body() dto: InternalCloseDto,
  ) {
    return this.service.end(roomId, dto.callerId ?? 'orchestration-service', UserRole.FORMATEUR);
  }
}

/** DTO for internal attendance recording. */
class InternalAttendanceDto extends RecordAttendanceDto {
  userId: string;
  userRole: string;
}

/** DTO for internal close operation. */
class InternalCloseDto {
  callerId?: string;
}
