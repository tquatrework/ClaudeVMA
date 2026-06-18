import {
  Controller,
  Get,
  Post,
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
import { ForumsService } from './forums.service';
import { CreateForumDto } from './dto/create-forum.dto';
import { CreateForumCommentDto } from './dto/create-forum-comment.dto';
import { CreateForumExclusionDto } from './dto/create-forum-exclusion.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/guards/jwt-auth.guard';

@ApiTags('forums')
@ApiBearerAuth()
@Controller('forums')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ForumsController {
  constructor(private readonly forumsService: ForumsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Créer un forum',
    description: 'Crée un nouveau forum. Réservé aux RP et AP. Un forum créé par AP est en attente de publication.',
  })
  @ApiResponse({ status: 201, description: 'Forum créé' })
  @ApiResponse({ status: 400, description: 'Données invalides' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: 'Rôle insuffisant' })
  @ApiHeader({ name: 'x-correlation-id', required: false })
  async createForum(
    @Body() createForumDto: CreateForumDto,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.forumsService.createForum(createForumDto, currentUser.id, currentUser.role);
  }

  @Get()
  @ApiOperation({
    summary: 'Lister les forums',
    description: 'Retourne les forums accessibles. Les RP et TI voient tous les forums; les autres ne voient que les forums publiés.',
  })
  @ApiResponse({ status: 200, description: 'Liste des forums' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiHeader({ name: 'x-correlation-id', required: false })
  async findAllForums(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.forumsService.findAllForums(currentUser.role);
  }

  @Post(':id/comments')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Commenter un forum',
    description: 'Ajoute un commentaire à un forum. Le forum doit être publié et l\'utilisateur ne doit pas être exclu.',
  })
  @ApiParam({ name: 'id', description: 'UUID du forum' })
  @ApiResponse({ status: 201, description: 'Commentaire ajouté' })
  @ApiResponse({ status: 403, description: 'Accès refusé (exclu ou rôle incorrect)' })
  @ApiResponse({ status: 404, description: 'Forum introuvable' })
  @ApiHeader({ name: 'x-correlation-id', required: false })
  async addComment(
    @Param('id') forumId: string,
    @Body() createCommentDto: CreateForumCommentDto,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.forumsService.addComment(
      forumId,
      createCommentDto,
      currentUser.id,
      currentUser.role,
    );
  }

  @Post(':id/exclusions')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Exclure un membre du forum',
    description: 'Exclut un membre d\'un forum. Réservé au propriétaire du forum ou à un RP.',
  })
  @ApiParam({ name: 'id', description: 'UUID du forum' })
  @ApiResponse({ status: 201, description: 'Membre exclu' })
  @ApiResponse({ status: 400, description: 'Membre déjà exclu' })
  @ApiResponse({ status: 403, description: 'Rôle insuffisant' })
  @ApiResponse({ status: 404, description: 'Forum introuvable' })
  @ApiHeader({ name: 'x-correlation-id', required: false })
  async excludeMember(
    @Param('id') forumId: string,
    @Body() createExclusionDto: CreateForumExclusionDto,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.forumsService.excludeMember(
      forumId,
      createExclusionDto,
      currentUser.id,
      currentUser.role,
    );
  }
}
