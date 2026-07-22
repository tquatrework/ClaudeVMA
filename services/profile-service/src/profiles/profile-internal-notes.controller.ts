import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  ParseUUIDPipe,
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
import { ProfilesService } from './profiles.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { UserRole } from '../common/enums/user-role.enum';
import { CreateInternalNoteDto } from './dto/create-internal-note.dto';
import { UpdateInternalNoteDto } from './dto/update-internal-note.dto';

/**
 * Thin HTTP adapter for the confidential internal-notes sub-resource
 * (PROF-FB-002). Split out of ProfilesController to keep a single coherent
 * resource per file (controllers-convention).
 */
@ApiTags('profiles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('profiles')
export class ProfileInternalNotesController {
  constructor(private readonly profilesService: ProfilesService) {}

  @Get(':userId/internal-notes')
  @Roles(
    UserRole.RESPONSABLE_PEDAGOGIQUE,
    UserRole.ANIMATEUR_PEDAGOGIQUE,
    UserRole.TECHNICIEN_INFORMATIQUE,
    UserRole.ADMINISTRATEUR_FINANCIER,
  )
  @ApiOperation({
    summary: 'List internal notes',
    description:
      'Returns all internal notes written about a user, ordered newest first. ' +
      'Restricted to RP, AP, TI and AdministrateurFinancier (PROF-FB-002). ' +
      'Élève, parent_financeur and formateur receive 403.',
  })
  @ApiParam({ name: 'userId', description: 'Target user UUID' })
  @ApiResponse({ status: 200, description: 'List of internal notes (newest first)' })
  @ApiResponse({ status: 403, description: 'Forbidden — RP, AP, TI or AF only' })
  getInternalNotes(
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<Awaited<ReturnType<ProfilesService['getInternalNotes']>>> {
    return this.profilesService.getInternalNotes(userId, actor);
  }

  @Post(':userId/internal-notes')
  @Roles(UserRole.RESPONSABLE_PEDAGOGIQUE, UserRole.ANIMATEUR_PEDAGOGIQUE)
  @ApiOperation({
    summary: 'Create internal note',
    description:
      'Append a confidential internal note about a user. ' +
      'Restricted to RP and AP only (PROF-FB-002). ' +
      'AdministrateurFinancier, élève, parent_financeur and formateur receive 403.',
  })
  @ApiParam({ name: 'userId', description: 'Target user UUID' })
  @ApiResponse({ status: 201, description: 'Internal note created' })
  @ApiResponse({ status: 400, description: 'Bad request — empty body or invalid content' })
  @ApiResponse({ status: 403, description: 'Forbidden — RP or AP only' })
  createInternalNote(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: CreateInternalNoteDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<Awaited<ReturnType<ProfilesService['createInternalNote']>>> {
    return this.profilesService.createInternalNote(userId, dto, actor);
  }

  @Get(':userId/internal-notes/:noteId')
  @Roles(
    UserRole.RESPONSABLE_PEDAGOGIQUE,
    UserRole.ANIMATEUR_PEDAGOGIQUE,
    UserRole.TECHNICIEN_INFORMATIQUE,
    UserRole.ADMINISTRATEUR_FINANCIER,
  )
  @ApiOperation({
    summary: 'Get a single internal note',
    description:
      'Returns a single internal note by ID. ' +
      'Restricted to RP, AP, TI and AF (PROF-FB-002).',
  })
  @ApiParam({ name: 'userId', description: 'Target user UUID' })
  @ApiParam({ name: 'noteId', description: 'Internal note UUID' })
  @ApiResponse({ status: 200, description: 'Internal note' })
  @ApiResponse({ status: 403, description: 'Forbidden — RP, AP, TI or AF only' })
  @ApiResponse({ status: 404, description: 'Note not found' })
  getInternalNote(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('noteId', ParseUUIDPipe) noteId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<Awaited<ReturnType<ProfilesService['getInternalNote']>>> {
    return this.profilesService.getInternalNote(userId, noteId, actor);
  }

  @Put(':userId/internal-notes/:noteId')
  @Roles(UserRole.RESPONSABLE_PEDAGOGIQUE, UserRole.ANIMATEUR_PEDAGOGIQUE)
  @ApiOperation({
    summary: 'Update an internal note',
    description:
      'Modifies an existing internal note. ' +
      'Only the original author (RP or AP) or any RP may update (PROF-FB-002).',
  })
  @ApiParam({ name: 'userId', description: 'Target user UUID' })
  @ApiParam({ name: 'noteId', description: 'Internal note UUID' })
  @ApiResponse({ status: 200, description: 'Updated internal note' })
  @ApiResponse({ status: 403, description: 'Forbidden — author or RP only' })
  @ApiResponse({ status: 404, description: 'Note not found' })
  updateInternalNote(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('noteId', ParseUUIDPipe) noteId: string,
    @Body() dto: UpdateInternalNoteDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<Awaited<ReturnType<ProfilesService['updateInternalNote']>>> {
    return this.profilesService.updateInternalNote(userId, noteId, dto, actor);
  }

  @Delete(':userId/internal-notes/:noteId')
  @Roles(UserRole.RESPONSABLE_PEDAGOGIQUE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete an internal note',
    description:
      'Permanently deletes an internal note. ' +
      'Restricted to RP only (PROF-FB-002).',
  })
  @ApiParam({ name: 'userId', description: 'Target user UUID' })
  @ApiParam({ name: 'noteId', description: 'Internal note UUID' })
  @ApiResponse({ status: 204, description: 'Note deleted' })
  @ApiResponse({ status: 403, description: 'Forbidden — RP only' })
  @ApiResponse({ status: 404, description: 'Note not found' })
  deleteInternalNote(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('noteId', ParseUUIDPipe) noteId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<Awaited<ReturnType<ProfilesService['deleteInternalNote']>>> {
    return this.profilesService.deleteInternalNote(userId, noteId, actor);
  }
}
