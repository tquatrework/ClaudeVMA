import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { PedagogicalLogService } from './pedagogical-log.service';
import { CreateLogDto } from './dto/create-log.dto';

@ApiTags('logs')
@ApiBearerAuth()
@Controller('logs')
export class PedagogicalLogController {
  constructor(private readonly service: PedagogicalLogService) {}

  @Post()
  @ApiOperation({ summary: 'Create a log', description: 'Record notes and skills worked after a session' })
  @ApiResponse({ status: 201, description: 'Log created' })
  create(@Body() dto: CreateLogDto) {
    return this.service.create(dto);
  }

  @Get('student/:studentId')
  @ApiParam({ name: 'studentId', description: 'Student UUID' })
  @ApiOperation({ summary: 'Get logs by student', description: 'Returns all logs for a given student' })
  @ApiResponse({ status: 200, description: 'Log list' })
  findByStudent(@Param('studentId') studentId: string) {
    return this.service.findByStudent(studentId);
  }

  @Get('session/:sessionId')
  @ApiParam({ name: 'sessionId', description: 'Session UUID' })
  @ApiOperation({ summary: 'Get logs by session', description: 'Returns all logs for a given session' })
  @ApiResponse({ status: 200, description: 'Log list' })
  findBySession(@Param('sessionId') sessionId: string) {
    return this.service.findBySession(sessionId);
  }

  @Get(':id')
  @ApiParam({ name: 'id', description: 'Log UUID' })
  @ApiOperation({ summary: 'Get a log by ID' })
  @ApiResponse({ status: 200, description: 'Log found' })
  @ApiResponse({ status: 404, description: 'Log not found' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }
}
