import { Controller, Get, Post, Patch, Delete, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { CalendarService } from './calendar.service';
import { CreateSessionDto } from './dto/create-session.dto';

@ApiTags('calendar')
@ApiBearerAuth()
@Controller('calendar')
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @Post()
  @ApiOperation({ summary: 'Create a session', description: 'Schedule a new tutoring session' })
  @ApiResponse({ status: 201, description: 'Session created' })
  create(@Body() dto: CreateSessionDto) {
    return this.calendarService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List sessions', description: 'Returns sessions, optionally filtered by teacher or student' })
  @ApiQuery({ name: 'teacherId', required: false })
  @ApiQuery({ name: 'studentId', required: false })
  @ApiResponse({ status: 200, description: 'List of sessions' })
  findAll(@Query('teacherId') teacherId?: string, @Query('studentId') studentId?: string) {
    if (teacherId) return this.calendarService.findByTeacher(teacherId);
    if (studentId) return this.calendarService.findByStudent(studentId);
    return this.calendarService.findAll();
  }

  @Get(':id')
  @ApiParam({ name: 'id', description: 'Session UUID' })
  @ApiOperation({ summary: 'Get a session by ID' })
  @ApiResponse({ status: 200, description: 'Session found' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  findOne(@Param('id') id: string) {
    return this.calendarService.findOne(id);
  }

  @Patch(':id')
  @ApiParam({ name: 'id', description: 'Session UUID' })
  @ApiOperation({ summary: 'Update a session', description: 'Reschedule or add notes to a session' })
  @ApiResponse({ status: 200, description: 'Session updated' })
  update(@Param('id') id: string, @Body() dto: Partial<CreateSessionDto>) {
    return this.calendarService.update(id, dto);
  }

  @Delete(':id')
  @ApiParam({ name: 'id', description: 'Session UUID' })
  @ApiOperation({ summary: 'Cancel/delete a session' })
  @ApiResponse({ status: 200, description: 'Session deleted' })
  remove(@Param('id') id: string) {
    return this.calendarService.remove(id);
  }
}
