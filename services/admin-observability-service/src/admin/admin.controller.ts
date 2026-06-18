import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Headers,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiHeader,
} from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { QueryActivityLogDto } from './dto/query-activity-log.dto';
import { QueryTechnicalLogDto } from './dto/query-technical-log.dto';
import { CreateVisibilityOverrideDto } from './dto/create-visibility-override.dto';
import { UpdateSiteMetadataDto } from './dto/update-site-metadata.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/guards/jwt-auth.guard';

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // ─────────────────────────────────────────────────────────────────────────
  // Activity Logs
  // ─────────────────────────────────────────────────────────────────────────

  @Get('activity-log')
  @ApiOperation({
    summary: 'Lister le journal d\'activité',
    description: 'Retourne le journal d\'activité filtrable. Accessible aux TI, RP et AF.',
  })
  @ApiResponse({ status: 200, description: 'Journal d\'activité retourné' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: 'Rôle insuffisant' })
  @ApiHeader({ name: 'x-correlation-id', required: false, description: 'Identifiant de corrélation inter-services' })
  async getActivityLog(
    @Query() queryDto: QueryActivityLogDto,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.adminService.findActivityLogs(queryDto, currentUser.role);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Technical Logs
  // ─────────────────────────────────────────────────────────────────────────

  @Get('technical-logs')
  @ApiOperation({
    summary: 'Lire les logs techniques',
    description: 'Retourne les logs techniques. Accessible au TI uniquement.',
  })
  @ApiResponse({ status: 200, description: 'Logs techniques retournés' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: 'Rôle insuffisant — réservé au TI' })
  @ApiHeader({ name: 'x-correlation-id', required: false })
  async getTechnicalLogs(
    @Query() queryDto: QueryTechnicalLogDto,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.adminService.findTechnicalLogs(queryDto, currentUser.role);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Visibility Overrides
  // ─────────────────────────────────────────────────────────────────────────

  @Post('visibility-overrides')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Créer un masquage temporaire',
    description: 'Masque temporairement un élément en réponse à un incident. L\'élément n\'est PAS supprimé. Réservé au TI.',
  })
  @ApiResponse({ status: 201, description: 'Masquage créé' })
  @ApiResponse({ status: 400, description: 'Données invalides ou masquage déjà actif' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: 'Rôle insuffisant — réservé au TI' })
  @ApiHeader({ name: 'x-correlation-id', required: false })
  async createVisibilityOverride(
    @Body() createDto: CreateVisibilityOverrideDto,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.adminService.createVisibilityOverride(
      createDto,
      currentUser.id,
      currentUser.role,
    );
  }

  @Delete('visibility-overrides/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Lever un masquage temporaire',
    description: 'Lève un masquage temporaire et restaure la visibilité de l\'élément. L\'élément original n\'est pas supprimé. Réservé au TI.',
  })
  @ApiParam({ name: 'id', description: 'UUID du masquage à lever' })
  @ApiResponse({ status: 200, description: 'Masquage levé' })
  @ApiResponse({ status: 400, description: 'Masquage déjà levé' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: 'Rôle insuffisant — réservé au TI' })
  @ApiResponse({ status: 404, description: 'Masquage introuvable' })
  @ApiHeader({ name: 'x-correlation-id', required: false })
  async liftVisibilityOverride(
    @Param('id') overrideId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.adminService.liftVisibilityOverride(
      overrideId,
      currentUser.id,
      currentUser.role,
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Health Metrics
  // ─────────────────────────────────────────────────────────────────────────

  @Get('health')
  @ApiOperation({
    summary: 'Indicateurs de disponibilité et performance',
    description: 'Retourne les indicateurs non fonctionnels de la plateforme. Accessible aux TI, RP et AF.',
  })
  @ApiResponse({ status: 200, description: 'Indicateurs retournés' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: 'Rôle insuffisant' })
  async getHealthMetrics(
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.adminService.getHealthMetrics(currentUser.role);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Site Metadata
  // ─────────────────────────────────────────────────────────────────────────

  @Patch('site-metadata/:id')
  @ApiOperation({
    summary: 'Modifier une métadonnée du site',
    description: 'Modifie les URLs et metas de navigation du site sans intervention développeur. Réservé au TI. L\'identité réelle de l\'opérateur est toujours conservée.',
  })
  @ApiParam({ name: 'id', description: 'UUID de la métadonnée' })
  @ApiResponse({ status: 200, description: 'Métadonnée mise à jour' })
  @ApiResponse({ status: 400, description: 'Données invalides' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: 'Rôle insuffisant — réservé au TI' })
  @ApiResponse({ status: 404, description: 'Métadonnée introuvable' })
  @ApiHeader({ name: 'x-correlation-id', required: false })
  async updateSiteMetadata(
    @Param('id') metadataId: string,
    @Body() updateDto: UpdateSiteMetadataDto,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.adminService.updateSiteMetadata(
      metadataId,
      updateDto,
      currentUser.id,
      currentUser.role,
    );
  }
}
