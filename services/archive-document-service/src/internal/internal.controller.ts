import {
  Controller,
  Get,
  Param,
  UseGuards,
  Headers,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiHeader,
  ApiExcludeController,
} from '@nestjs/swagger';
import { InternalSecretGuard } from '../common/guards/internal-secret.guard';
import { ArchiveService } from '../archive/archive.service';

/**
 * Routes internes utilisées par orchestration-service.
 * Protégées par X-Internal-Secret — ne jamais exposer publiquement.
 */
@ApiExcludeController()
@ApiTags('internal')
@UseGuards(InternalSecretGuard)
@Controller('internal')
export class InternalController {
  constructor(private readonly archiveService: ArchiveService) {}

  @Get('students/:studentId/archives')
  @ApiOperation({
    summary: '[INTERNAL] Lister les archives d\'un élève sans filtrage de rôle',
    description:
      'Retourne toutes les archives d\'un élève, sans filtrage de rôle. ' +
      'Utilisé par orchestration-service pour les workflows inter-services. ' +
      'Protégé par X-Internal-Secret.',
  })
  @ApiParam({ name: 'studentId', description: 'UUID de l\'élève' })
  @ApiHeader({ name: 'x-internal-secret', required: true, description: 'Secret inter-services' })
  @ApiHeader({ name: 'x-correlation-id', required: false, description: 'Corrélation ID de traçabilité' })
  @ApiResponse({
    status: 200,
    description: 'Archives retournées',
    schema: {
      example: [
        {
          id: 'uuid',
          studentId: 'uuid',
          itemType: 'resume_de_cours',
          sourceId: 'uuid',
          sourceService: 'video-session-service',
          title: 'Résumé cours — Algèbre 12/06/2026',
          occurredAt: '2026-06-12T14:00:00Z',
        },
      ],
    },
  })
  @ApiResponse({ status: 401, description: 'Non autorisé — X-Internal-Secret invalide ou absent' })
  listArchivesInternal(
    @Param('studentId') studentId: string,
    @Headers('x-correlation-id') _correlationId?: string,
  ) {
    return this.archiveService.listArchivesInternal(studentId);
  }
}
