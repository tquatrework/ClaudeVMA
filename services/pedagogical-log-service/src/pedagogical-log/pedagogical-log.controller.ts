import {
  Controller,
  Get,
  Post,
  Patch,
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
import { PedagogicalLogService } from './pedagogical-log.service';
import { CreateLogDto } from './dto/create-log.dto';
import { UpdateLogDto } from './dto/update-log.dto';

/**
 * Routes cahier de texte (docs/routes.md)
 *
 * POST   /logs                          → Créer un log (formateur, RP, AP)
 * GET    /logs/student/:studentId       → Logs d'un élève (filtrés par rôle)
 * GET    /logs/session/:sessionId       → Logs d'une séance (filtrés par rôle)
 * GET    /logs/:id                      → Détail d'un log
 * PATCH  /logs/:id                      → Modifier un log (auteur ou RP/TI)
 *
 * PLOG-RA-003 / PLOG-RA-004: seuls formateur, RP, AP peuvent créer.
 * PLOG-RA-001 / PLOG-RA-002: lecture filtrée par visibilité selon rôle.
 * PLOG-FB-003: formateur non lié ne doit pas écrire (vérifié au niveau service métier, la liaison est déléguée au profile-service).
 */
@ApiTags('logs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('logs')
export class PedagogicalLogController {
  constructor(private readonly service: PedagogicalLogService) {}

  @Post()
  @Roles(
    UserRole.FORMATEUR,
    UserRole.RESPONSABLE_PEDAGOGIQUE,
    UserRole.ANIMATEUR_PEDAGOGIQUE,
    UserRole.TECHNICIEN_INFORMATIQUE,
  )
  @ApiOperation({
    summary: 'Create a textbook entry',
    description:
      'Record a pedagogical log entry after a session. ' +
      'PLOG-RA-003: formateur can write. PLOG-RA-004: RP can write. ' +
      'PLOG-BR-006: visibility controls who can read the entry.',
  })
  @ApiResponse({ status: 201, description: 'Log created' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — role not allowed to write' })
  create(@Body() dto: CreateLogDto, @Req() req: any) {
    return this.service.create(dto, req.user.id, req.user.role);
  }

  @Get('student/:studentId')
  @ApiParam({ name: 'studentId', description: 'Student UUID' })
  @ApiOperation({
    summary: 'Get logs by student',
    description:
      'Returns textbook entries for a student, filtered by the caller\'s role. ' +
      'PLOG-RA-001: eleve sees allowed entries. ' +
      'PLOG-RA-002: parent_financeur sees only eleve_parent_formateur entries. ' +
      'PLOG-BR-008: carnet personnel entries are never returned here.',
  })
  @ApiResponse({ status: 200, description: 'Log list (filtered by visibility)' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  findByStudent(@Param('studentId') studentId: string, @Req() req: any) {
    return this.service.findByStudent(studentId, req.user.role);
  }

  @Get('session/:sessionId')
  @ApiParam({ name: 'sessionId', description: 'Session UUID' })
  @ApiOperation({
    summary: 'Get logs by session',
    description: 'Returns all logs for a given session, filtered by caller role.',
  })
  @ApiResponse({ status: 200, description: 'Log list' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  findBySession(@Param('sessionId') sessionId: string, @Req() req: any) {
    return this.service.findBySession(sessionId, req.user.role);
  }

  @Get(':id')
  @ApiParam({ name: 'id', description: 'Log UUID' })
  @ApiOperation({ summary: 'Get a log by ID' })
  @ApiResponse({ status: 200, description: 'Log found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — visibility rule blocks access' })
  @ApiResponse({ status: 404, description: 'Log not found' })
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.service.findOne(id, req.user.role);
  }

  @Patch(':id')
  @ApiParam({ name: 'id', description: 'Log UUID' })
  @ApiOperation({
    summary: 'Update a log entry',
    description: 'Only the original author, a RP, or a TI can update a log entry.',
  })
  @ApiResponse({ status: 200, description: 'Log updated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — not the author' })
  @ApiResponse({ status: 404, description: 'Log not found' })
  update(@Param('id') id: string, @Body() dto: UpdateLogDto, @Req() req: any) {
    return this.service.update(id, dto, req.user.id, req.user.role);
  }
}
