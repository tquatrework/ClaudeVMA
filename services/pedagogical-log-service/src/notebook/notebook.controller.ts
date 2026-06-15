import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
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
import { NotebookService } from './notebook.service';
import { CreateNotebookEntryDto } from './dto/create-notebook-entry.dto';
import { UpdateNotebookEntryDto } from './dto/update-notebook-entry.dto';

/**
 * Carnet personnel — espace privé réservé à l'élève
 *
 * PLOG-BR-004 / PLOG-RA-001: seul l'élève peut lire et gérer son carnet.
 * PLOG-FB-001: le parent ne peut jamais accéder au carnet personnel.
 * PLOG-FB-002: ces entrées ne sont jamais retournées par les APIs de cahier de texte.
 *
 * Routes alignées sur docs/services/pedagogical-log-service.md :
 *   GET  /students/:studentId/notebook        Lire le carnet
 *   POST /students/:studentId/notebook        Ajouter une entrée
 *   PATCH /students/:studentId/notebook/:id   Modifier une entrée
 *   DELETE /students/:studentId/notebook/:id  Supprimer une entrée
 */
@ApiTags('notebook')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('students/:studentId/notebook')
export class NotebookController {
  constructor(private readonly service: NotebookService) {}

  @Post()
  @Roles(UserRole.ELEVE)
  @ApiParam({ name: 'studentId', description: 'Student UUID (must match authenticated user)' })
  @ApiOperation({
    summary: 'Add a notebook entry',
    description:
      'Add a personal entry to the student\'s notebook. ' +
      'PLOG-BR-004: only the student can write. PLOG-FB-001: parents are forbidden.',
  })
  @ApiResponse({ status: 201, description: 'Notebook entry created' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — only the student owner can write' })
  create(
    @Param('studentId') studentId: string,
    @Body() dto: CreateNotebookEntryDto,
    @Req() req: any,
  ) {
    return this.service.create(studentId, dto, req.user.id);
  }

  @Get()
  @Roles(UserRole.ELEVE, UserRole.TECHNICIEN_INFORMATIQUE)
  @ApiParam({ name: 'studentId', description: 'Student UUID' })
  @ApiOperation({
    summary: 'List notebook entries',
    description:
      'Returns all notebook entries for the student. ' +
      'PLOG-RA-001: only accessible by the student themselves (or TI for incident handling).',
  })
  @ApiResponse({ status: 200, description: 'Notebook entries list' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  findAll(
    @Param('studentId') studentId: string,
    @Req() req: any,
  ) {
    return this.service.findAll(studentId, req.user.id, req.user.role);
  }

  @Get(':id')
  @Roles(UserRole.ELEVE, UserRole.TECHNICIEN_INFORMATIQUE)
  @ApiParam({ name: 'studentId', description: 'Student UUID' })
  @ApiParam({ name: 'id', description: 'Notebook entry UUID' })
  @ApiOperation({ summary: 'Get a notebook entry by ID' })
  @ApiResponse({ status: 200, description: 'Notebook entry found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Not found' })
  findOne(
    @Param('studentId') studentId: string,
    @Param('id') id: string,
    @Req() req: any,
  ) {
    return this.service.findOne(studentId, id, req.user.id, req.user.role);
  }

  @Patch(':id')
  @Roles(UserRole.ELEVE)
  @ApiParam({ name: 'studentId', description: 'Student UUID' })
  @ApiParam({ name: 'id', description: 'Notebook entry UUID' })
  @ApiOperation({ summary: 'Update a notebook entry' })
  @ApiResponse({ status: 200, description: 'Notebook entry updated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Not found' })
  update(
    @Param('studentId') studentId: string,
    @Param('id') id: string,
    @Body() dto: UpdateNotebookEntryDto,
    @Req() req: any,
  ) {
    return this.service.update(studentId, id, dto, req.user.id);
  }

  @Delete(':id')
  @Roles(UserRole.ELEVE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiParam({ name: 'studentId', description: 'Student UUID' })
  @ApiParam({ name: 'id', description: 'Notebook entry UUID' })
  @ApiOperation({ summary: 'Delete a notebook entry' })
  @ApiResponse({ status: 204, description: 'Notebook entry deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Not found' })
  remove(
    @Param('studentId') studentId: string,
    @Param('id') id: string,
    @Req() req: any,
  ) {
    return this.service.remove(studentId, id, req.user.id);
  }
}
