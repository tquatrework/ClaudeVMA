import {
  Controller,
  Get,
  Query,
  Res,
  UseGuards,
  Headers,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiHeader,
  ApiQuery,
} from '@nestjs/swagger';
import { Response } from 'express';
import { OpenActivitiesService, buildActivitiesCsv } from '../open-activities/open-activities.service';
import { SearchOpenActivityDto, ExportFormat } from '../open-activities/dto/search-open-activity.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/guards/jwt-auth.guard';

@ApiTags('activities')
@ApiBearerAuth()
@Controller('activities')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ActivitiesController {
  constructor(private readonly openActivitiesService: OpenActivitiesService) {}

  @Get()
  @ApiOperation({
    summary: 'Liste globale des activités',
    description:
      'Retourne la liste globale de toutes les activités, filtrable et exportable. ' +
      'Réservé aux RP, TI et AF pour suivi et statistiques. ' +
      'Utiliser ?format=csv pour obtenir un export CSV (Content-Type: text/csv).',
  })
  @ApiQuery({ name: 'format', enum: ExportFormat, required: false, description: 'Format de sortie : json (défaut) ou csv' })
  @ApiResponse({ status: 200, description: 'Liste globale des activités (JSON ou CSV)' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: 'Réservé aux RP, TI et AF' })
  @ApiHeader({ name: 'x-correlation-id', required: false, description: 'Identifiant de corrélation inter-services' })
  async findAll(
    @Query() searchParams: SearchOpenActivityDto,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Res({ passthrough: true }) response: Response,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    const result = await this.openActivitiesService.findAllActivities(searchParams, currentUser.role);

    if (searchParams.format === ExportFormat.CSV) {
      const csvContent = buildActivitiesCsv(result.data);
      const exportFilename = `activities-export-${new Date().toISOString().slice(0, 10)}.csv`;

      response.setHeader('Content-Type', 'text/csv; charset=utf-8');
      response.setHeader('Content-Disposition', `attachment; filename="${exportFilename}"`);
      response.setHeader('X-Total-Count', String(result.total));

      return csvContent;
    }

    return result;
  }
}
