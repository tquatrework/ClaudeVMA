import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { IncidentService } from './incident.service';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { UpdateIncidentStatusDto } from './dto/update-incident-status.dto';

/**
 * Incident routes (docs/services/communication-service.md)
 *
 * POST /incidents           → Open an incident thread (TI only)
 * GET  /incidents           → List all incidents (TI only)
 * GET  /incidents/:id       → Get incident detail (TI only)
 * PUT  /incidents/:id/status → Update status (TI only)
 *
 * COM-RA-006: TI can use incident conversations.
 */
@ApiTags('incidents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('incidents')
export class IncidentController {
  constructor(private readonly service: IncidentService) {}

  @Post()
  @Roles(UserRole.TECHNICIEN_INFORMATIQUE)
  @ApiOperation({
    summary: 'Open an incident thread',
    description:
      'TI opens a new incident thread for a target user. ' +
      'A dedicated conversation marked as incident=true is created. ' +
      'COM-RA-006: reserved to TI.',
  })
  @ApiResponse({ status: 201, description: 'Incident created' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — TI role required' })
  create(@Body() dto: CreateIncidentDto, @Req() req: any) {
    return this.service.create(dto, req.user.id);
  }

  @Get()
  @Roles(UserRole.TECHNICIEN_INFORMATIQUE)
  @ApiOperation({
    summary: 'List all incident threads',
    description: 'Returns all incident threads, ordered by creation date. COM-RA-006: TI only.',
  })
  @ApiResponse({ status: 200, description: 'Incident list' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — TI role required' })
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @Roles(UserRole.TECHNICIEN_INFORMATIQUE)
  @ApiParam({ name: 'id', description: 'Incident UUID' })
  @ApiOperation({ summary: 'Get incident detail', description: 'COM-RA-006: TI only.' })
  @ApiResponse({ status: 200, description: 'Incident found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — TI role required' })
  @ApiResponse({ status: 404, description: 'Incident not found' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Put(':id/status')
  @Roles(UserRole.TECHNICIEN_INFORMATIQUE)
  @ApiParam({ name: 'id', description: 'Incident UUID' })
  @ApiOperation({
    summary: 'Update incident status',
    description:
      'Updates the status of an incident thread. ' +
      'Valid values: open, in_progress, resolved, closed. ' +
      'COM-RA-006: TI only.',
  })
  @ApiResponse({ status: 200, description: 'Status updated' })
  @ApiResponse({ status: 400, description: 'Invalid status value' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — TI role required' })
  @ApiResponse({ status: 404, description: 'Incident not found' })
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateIncidentStatusDto,
    @Req() req: any,
  ) {
    return this.service.updateStatus(id, dto, req.user.id, req.user.role);
  }
}
