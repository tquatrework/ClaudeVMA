import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  ParseUUIDPipe,
  UseGuards,
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
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { UserRole } from '../common/enums/user-role.enum';
import { IncidentService } from './incident.service';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { UpdateIncidentStatusDto } from './dto/update-incident-status.dto';
import { IncidentResponseDto } from './dto/incident-response.dto';

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
  constructor(private readonly incidentService: IncidentService) {}

  @Post()
  @Roles(UserRole.TECHNICIEN_INFORMATIQUE)
  @ApiOperation({
    summary: 'Open an incident thread',
    description:
      'TI opens a new incident thread for a target user. ' +
      'A dedicated conversation marked as incident=true is created. ' +
      'COM-RA-006: reserved to TI.',
  })
  @ApiResponse({ status: 201, description: 'Incident created', type: IncidentResponseDto })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — TI role required' })
  async create(
    @Body() dto: CreateIncidentDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<IncidentResponseDto> {
    const incident = await this.incidentService.create(dto, actor);
    return IncidentResponseDto.fromEntity(incident);
  }

  @Get()
  @Roles(UserRole.TECHNICIEN_INFORMATIQUE)
  @ApiOperation({
    summary: 'List all incident threads',
    description: 'Returns all incident threads, ordered by creation date. COM-RA-006: TI only.',
  })
  @ApiResponse({ status: 200, description: 'Incident list', type: [IncidentResponseDto] })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — TI role required' })
  async findAll(): Promise<IncidentResponseDto[]> {
    const incidents = await this.incidentService.findAll();
    return incidents.map((incident) => IncidentResponseDto.fromEntity(incident));
  }

  @Get(':id')
  @Roles(UserRole.TECHNICIEN_INFORMATIQUE)
  @ApiParam({ name: 'id', description: 'Incident UUID' })
  @ApiOperation({ summary: 'Get incident detail', description: 'COM-RA-006: TI only.' })
  @ApiResponse({ status: 200, description: 'Incident found', type: IncidentResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — TI role required' })
  @ApiResponse({ status: 404, description: 'Incident not found' })
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<IncidentResponseDto> {
    const incident = await this.incidentService.findOne(id);
    return IncidentResponseDto.fromEntity(incident);
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
  @ApiResponse({ status: 200, description: 'Status updated', type: IncidentResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid status value' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — TI role required' })
  @ApiResponse({ status: 404, description: 'Incident not found' })
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateIncidentStatusDto,
  ): Promise<IncidentResponseDto> {
    const incident = await this.incidentService.updateStatus(id, dto);
    return IncidentResponseDto.fromEntity(incident);
  }
}
