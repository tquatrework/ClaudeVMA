import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { VideoSessionService } from './video-session.service';
import { CreateRoomDto } from './dto/create-room.dto';

@ApiTags('video')
@ApiBearerAuth()
@Controller('video')
export class VideoSessionController {
  constructor(private readonly service: VideoSessionService) {}

  @Post('rooms')
  @ApiOperation({ summary: 'Create a video room', description: 'Creates a video room linked to a calendar session' })
  @ApiResponse({ status: 201, description: 'Room created with unique token' })
  createRoom(@Body() dto: CreateRoomDto) {
    return this.service.create(dto);
  }

  @Get('rooms/:id')
  @ApiParam({ name: 'id', description: 'Room UUID' })
  @ApiOperation({ summary: 'Get room info' })
  @ApiResponse({ status: 200, description: 'Room details' })
  @ApiResponse({ status: 404, description: 'Room not found' })
  getRoom(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post('rooms/:id/join')
  @ApiParam({ name: 'id', description: 'Room UUID' })
  @ApiOperation({ summary: 'Join a video room', description: 'Transitions room to active and returns token' })
  @ApiResponse({ status: 201, description: 'Room join token' })
  joinRoom(@Param('id') id: string) {
    return this.service.join(id);
  }

  @Post('rooms/:id/end')
  @ApiParam({ name: 'id', description: 'Room UUID' })
  @ApiOperation({ summary: 'End a video session', description: 'Marks the room as ended and records end time' })
  @ApiResponse({ status: 201, description: 'Room ended' })
  endRoom(@Param('id') id: string) {
    return this.service.end(id);
  }
}
