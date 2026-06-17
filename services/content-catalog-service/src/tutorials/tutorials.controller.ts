import {
  Controller,
  Get,
  Post,
  Delete,
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
import { TutorialsService } from './tutorials.service';
import { CreateTutorialDto } from './dto/create-tutorial.dto';
import { SearchTutorialDto } from './dto/search-tutorial.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { AuthenticatedUser } from '../common/guards/jwt-auth.guard';

@ApiTags('tutorials')
@ApiBearerAuth()
@Controller('tutorials')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TutorialsController {
  constructor(private readonly tutorialsService: TutorialsService) {}

  @Get()
  @ApiOperation({
    summary: 'Rechercher des tutoriels/vidéos',
    description: 'Retourne la liste des tutoriels et vidéos filtrés par type, format, niveau, thème ou tag.',
  })
  @ApiResponse({ status: 200, description: 'Liste des tutoriels correspondants' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiHeader({ name: 'x-correlation-id', required: false })
  async search(
    @Query() searchParams: SearchTutorialDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.tutorialsService.search(searchParams, currentUser.role);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.FORMATEUR, UserRole.ANIMATEUR_PEDAGOGIQUE, UserRole.RESPONSABLE_PEDAGOGIQUE)
  @ApiOperation({
    summary: 'Charger un tutoriel ou une vidéo',
    description: 'Crée un tutoriel de type académie, activité ou news, au format texte, mixte ou vidéo.',
  })
  @ApiResponse({ status: 201, description: 'Tutoriel créé' })
  @ApiResponse({ status: 400, description: 'Données invalides' })
  @ApiResponse({ status: 403, description: 'Rôle insuffisant' })
  @ApiHeader({ name: 'x-correlation-id', required: false })
  async create(
    @Body() createTutorialDto: CreateTutorialDto,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.tutorialsService.create(createTutorialDto, currentUser.id, currentUser.role);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Récupérer un tutoriel par identifiant',
    description: 'Retourne le détail d\'un tutoriel ou d\'une vidéo.',
  })
  @ApiParam({ name: 'id', description: 'UUID du tutoriel' })
  @ApiResponse({ status: 200, description: 'Tutoriel trouvé' })
  @ApiResponse({ status: 404, description: 'Tutoriel introuvable' })
  async findOne(
    @Param('id') tutorialId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.tutorialsService.findOne(tutorialId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.RESPONSABLE_PEDAGOGIQUE, UserRole.TECHNICIEN_INFORMATIQUE)
  @ApiOperation({
    summary: 'Retirer un tutoriel',
    description: 'Marque le tutoriel comme retiré (REMOVED). Réservé au RP et au TI.',
  })
  @ApiParam({ name: 'id', description: 'UUID du tutoriel' })
  @ApiResponse({ status: 204, description: 'Tutoriel retiré' })
  @ApiResponse({ status: 403, description: 'Rôle insuffisant' })
  @ApiResponse({ status: 404, description: 'Tutoriel introuvable' })
  async remove(
    @Param('id') tutorialId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.tutorialsService.removeTutorial(tutorialId, currentUser.id, currentUser.role);
  }
}
