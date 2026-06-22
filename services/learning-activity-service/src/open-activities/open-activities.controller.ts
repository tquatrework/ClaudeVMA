import {
  Controller,
  Get,
  Post,
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
import { OpenActivitiesService } from './open-activities.service';
import { CreateOpenActivityDto } from './dto/create-open-activity.dto';
import { UpdateOpenActivityDto } from './dto/update-open-activity.dto';
import { SearchOpenActivityDto } from './dto/search-open-activity.dto';
import { AcceptOpenActivityDto } from './dto/accept-open-activity.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/guards/jwt-auth.guard';

@ApiTags('open-activities')
@ApiBearerAuth()
@Controller('open-activities')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OpenActivitiesController {
  constructor(private readonly openActivitiesService: OpenActivitiesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Publier une activité non pourvue',
    description: 'Crée une petite annonce pédagogique. Réservé aux RP, AP, TI et AF.',
  })
  @ApiResponse({ status: 201, description: 'Activité publiée' })
  @ApiResponse({ status: 400, description: 'Données invalides' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: 'Rôle insuffisant' })
  @ApiHeader({ name: 'x-correlation-id', required: false, description: 'Identifiant de corrélation inter-services' })
  async create(
    @Body() createDto: CreateOpenActivityDto,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.openActivitiesService.create(createDto, currentUser.id, currentUser.role);
  }

  @Get()
  @ApiOperation({
    summary: 'Lister les activités non pourvues',
    description: 'Retourne les activités non pourvues filtrables. Les formateurs et AP ne voient que les activités ouvertes.',
  })
  @ApiResponse({ status: 200, description: 'Liste des activités' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: 'Rôle insuffisant' })
  @ApiHeader({ name: 'x-correlation-id', required: false })
  async findAll(
    @Query() searchParams: SearchOpenActivityDto,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.openActivitiesService.findAll(searchParams, currentUser.role);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Récupérer une activité non pourvue',
    description: 'Retourne le détail d\'une activité non pourvue avec ses acceptations.',
  })
  @ApiParam({ name: 'id', description: 'UUID de l\'activité' })
  @ApiResponse({ status: 200, description: 'Activité trouvée' })
  @ApiResponse({ status: 404, description: 'Activité introuvable' })
  async findOne(
    @Param('id') activityId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.openActivitiesService.findOne(activityId, currentUser.role);
  }

  @Post(':id/accept')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Accepter une activité non pourvue',
    description: 'Permet à un formateur ou AP d\'accepter une activité. Crée un événement calendrier et notifie le RP. L\'activité se ferme automatiquement quand le quota est atteint.',
  })
  @ApiParam({ name: 'id', description: 'UUID de l\'activité' })
  @ApiResponse({ status: 201, description: 'Acceptation enregistrée' })
  @ApiResponse({ status: 400, description: 'Activité non disponible ou déjà acceptée' })
  @ApiResponse({ status: 403, description: 'Réservé aux formateurs et AP' })
  @ApiResponse({ status: 404, description: 'Activité introuvable' })
  @ApiHeader({ name: 'x-correlation-id', required: false })
  async accept(
    @Param('id') activityId: string,
    @Body() acceptDto: AcceptOpenActivityDto,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.openActivitiesService.accept(
      activityId,
      acceptDto,
      currentUser.id,
      currentUser.role,
    );
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Modifier une activité non pourvue',
    description: 'Permet de modifier le statut, la date limite ou le quota d\'une activité. Réservé aux RP, TI et AF.',
  })
  @ApiParam({ name: 'id', description: 'UUID de l\'activité' })
  @ApiResponse({ status: 200, description: 'Activité mise à jour' })
  @ApiResponse({ status: 403, description: 'Rôle insuffisant' })
  @ApiResponse({ status: 404, description: 'Activité introuvable' })
  @ApiHeader({ name: 'x-correlation-id', required: false })
  async update(
    @Param('id') activityId: string,
    @Body() updateDto: UpdateOpenActivityDto,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.openActivitiesService.update(
      activityId,
      updateDto,
      currentUser.id,
      currentUser.role,
    );
  }
}
