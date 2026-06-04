import { Controller, Get, Post, Patch, Delete, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { TeacherRequestService } from './teacher-request.service';
import { CreateRequestDto } from './dto/create-request.dto';
import { UpdateStatusDto } from './dto/update-status.dto';

@ApiTags('requests')
@ApiBearerAuth()
@Controller('requests')
export class TeacherRequestController {
  constructor(private readonly service: TeacherRequestService) {}

  @Post()
  @ApiOperation({ summary: 'Create a session request', description: 'Student submits a request to a teacher' })
  @ApiResponse({ status: 201, description: 'Request created' })
  create(@Body() dto: CreateRequestDto) {
    return this.service.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all requests', description: 'Returns all session requests, sorted by date' })
  @ApiResponse({ status: 200, description: 'List of requests' })
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @ApiParam({ name: 'id', description: 'Request UUID' })
  @ApiOperation({ summary: 'Get a request by ID' })
  @ApiResponse({ status: 200, description: 'Request found' })
  @ApiResponse({ status: 404, description: 'Request not found' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id/status')
  @ApiParam({ name: 'id', description: 'Request UUID' })
  @ApiOperation({ summary: 'Update request status', description: 'Teacher accepts, declines, or student cancels' })
  @ApiResponse({ status: 200, description: 'Status updated' })
  updateStatus(@Param('id') id: string, @Body() dto: UpdateStatusDto) {
    return this.service.updateStatus(id, dto);
  }

  @Delete(':id')
  @ApiParam({ name: 'id', description: 'Request UUID' })
  @ApiOperation({ summary: 'Delete a request' })
  @ApiResponse({ status: 200, description: 'Request deleted' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
