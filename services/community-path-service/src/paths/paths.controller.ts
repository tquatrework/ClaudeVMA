import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
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
import { PathsService } from './paths.service';
import { CreatePathDto } from './dto/create-path.dto';
import { UpdateEnrollmentProgressDto } from './dto/update-enrollment-progress.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/guards/jwt-auth.guard';

@ApiTags('paths')
@ApiBearerAuth()
@Controller('paths')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PathsController {
  constructor(private readonly pathsService: PathsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Créer un parcours',
    description: 'Crée un nouveau parcours pédagogique. Réservé aux RP et AP. Un parcours AP passe en attente de validation RP.',
  })
  @ApiResponse({ status: 201, description: 'Parcours créé' })
  @ApiResponse({ status: 403, description: 'Rôle insuffisant' })
  @ApiHeader({ name: 'x-correlation-id', required: false })
  async createPath(
    @Body() createPathDto: CreatePathDto,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.pathsService.createPath(createPathDto, currentUser.id, currentUser.role);
  }

  @Get()
  @ApiOperation({
    summary: 'Lister les parcours',
    description: 'Retourne les parcours disponibles. Les RP et TI voient tous les parcours; les autres ne voient que les parcours validés.',
  })
  @ApiResponse({ status: 200, description: 'Liste des parcours' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiHeader({ name: 'x-correlation-id', required: false })
  async findAllPaths(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.pathsService.findAllPaths(currentUser.role);
  }

  @Post(':id/validate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Valider un parcours AP',
    description: 'Valide un parcours créé par un AP et le rend disponible. Réservé aux RP.',
  })
  @ApiParam({ name: 'id', description: 'UUID du parcours' })
  @ApiResponse({ status: 200, description: 'Parcours validé' })
  @ApiResponse({ status: 400, description: 'Parcours non en attente de validation' })
  @ApiResponse({ status: 403, description: 'Réservé aux RP' })
  @ApiResponse({ status: 404, description: 'Parcours introuvable' })
  @ApiHeader({ name: 'x-correlation-id', required: false })
  async validatePath(
    @Param('id') pathId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.pathsService.validatePath(pathId, currentUser.id, currentUser.role);
  }

  @Post(':id/enrollments')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'S\'inscrire à un parcours',
    description: 'Inscrit l\'élève courant à un parcours validé. Maximum 3 parcours ouverts simultanément.',
  })
  @ApiParam({ name: 'id', description: 'UUID du parcours' })
  @ApiResponse({ status: 201, description: 'Inscription créée' })
  @ApiResponse({ status: 400, description: 'Parcours indisponible ou quota atteint' })
  @ApiResponse({ status: 404, description: 'Parcours introuvable' })
  @ApiHeader({ name: 'x-correlation-id', required: false })
  async enrollStudent(
    @Param('id') pathId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.pathsService.enrollStudent(pathId, currentUser.id, currentUser.role);
  }
}

@ApiTags('path-enrollments')
@ApiBearerAuth()
@Controller('path-enrollments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PathEnrollmentsController {
  constructor(private readonly pathsService: PathsService) {}

  @Patch(':id/progress')
  @ApiOperation({
    summary: 'Mettre à jour la progression',
    description: 'Met à jour la progression d\'une inscription à un parcours. Émet automatiquement un certificat si le parcours est terminé.',
  })
  @ApiParam({ name: 'id', description: 'UUID de l\'inscription' })
  @ApiResponse({ status: 200, description: 'Progression mise à jour' })
  @ApiResponse({ status: 400, description: 'Parcours déjà terminé' })
  @ApiResponse({ status: 403, description: 'Accès refusé' })
  @ApiResponse({ status: 404, description: 'Inscription introuvable' })
  @ApiHeader({ name: 'x-correlation-id', required: false })
  async updateProgress(
    @Param('id') enrollmentId: string,
    @Body() updateDto: UpdateEnrollmentProgressDto,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.pathsService.updateEnrollmentProgress(
      enrollmentId,
      updateDto,
      currentUser.id,
    );
  }
}
