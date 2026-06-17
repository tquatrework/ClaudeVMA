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
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiHeader,
} from '@nestjs/swagger';
import { ContentsService } from './contents.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CreateRatingDto } from './dto/create-rating.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/guards/jwt-auth.guard';
import { ContentType } from '../common/enums/content-type.enum';

@ApiTags('contents')
@ApiBearerAuth()
@Controller('contents')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ContentsController {
  constructor(private readonly contentsService: ContentsService) {}

  private parseContentType(rawType: string): ContentType {
    if (!Object.values(ContentType).includes(rawType as ContentType)) {
      throw new BadRequestException(`Type de contenu invalide : ${rawType}. Valeurs acceptées : exercise, evaluation, tutorial`);
    }
    return rawType as ContentType;
  }

  @Post(':type/:id/comments')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Commenter une ressource pédagogique',
    description: 'Ajoute un commentaire sur un exercice, une évaluation ou un tutoriel. Les commentaires ne donnent pas la solution. Les indications propriétaire sont taguées spécifiquement.',
  })
  @ApiParam({ name: 'type', description: 'Type de contenu : exercise, evaluation, tutorial' })
  @ApiParam({ name: 'id', description: 'UUID de la ressource' })
  @ApiResponse({ status: 201, description: 'Commentaire ajouté' })
  @ApiResponse({ status: 400, description: 'Type de contenu invalide ou données invalides' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiHeader({ name: 'x-correlation-id', required: false })
  async addComment(
    @Param('type') contentTypeRaw: string,
    @Param('id') contentId: string,
    @Body() createCommentDto: CreateCommentDto,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    const contentType = this.parseContentType(contentTypeRaw);
    return this.contentsService.addComment(
      contentId,
      contentType,
      createCommentDto,
      currentUser.id,
      currentUser.role,
    );
  }

  @Get(':type/:id/comments')
  @ApiOperation({
    summary: 'Lister les commentaires d\'une ressource',
    description: 'Retourne tous les commentaires d\'un exercice, d\'une évaluation ou d\'un tutoriel.',
  })
  @ApiParam({ name: 'type', description: 'Type de contenu : exercise, evaluation, tutorial' })
  @ApiParam({ name: 'id', description: 'UUID de la ressource' })
  @ApiResponse({ status: 200, description: 'Liste des commentaires' })
  async getComments(
    @Param('type') contentTypeRaw: string,
    @Param('id') contentId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    const contentType = this.parseContentType(contentTypeRaw);
    return this.contentsService.getComments(contentId, contentType);
  }

  @Post(':type/:id/ratings')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Scorer une ressource pédagogique',
    description: 'Ajoute ou met à jour la note (1 à 5) d\'un utilisateur sur une ressource. Un seul score par utilisateur par ressource.',
  })
  @ApiParam({ name: 'type', description: 'Type de contenu : exercise, evaluation, tutorial' })
  @ApiParam({ name: 'id', description: 'UUID de la ressource' })
  @ApiResponse({ status: 201, description: 'Note enregistrée ou mise à jour' })
  @ApiResponse({ status: 400, description: 'Score invalide ou type de contenu invalide' })
  @ApiHeader({ name: 'x-correlation-id', required: false })
  async addRating(
    @Param('type') contentTypeRaw: string,
    @Param('id') contentId: string,
    @Body() createRatingDto: CreateRatingDto,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    const contentType = this.parseContentType(contentTypeRaw);
    return this.contentsService.addRating(
      contentId,
      contentType,
      createRatingDto,
      currentUser.id,
      currentUser.role,
    );
  }

  @Get(':type/:id/ratings')
  @ApiOperation({
    summary: 'Obtenir la note moyenne d\'une ressource',
    description: 'Retourne la note moyenne et le nombre de votes pour une ressource.',
  })
  @ApiParam({ name: 'type', description: 'Type de contenu : exercise, evaluation, tutorial' })
  @ApiParam({ name: 'id', description: 'UUID de la ressource' })
  @ApiResponse({ status: 200, description: 'Note moyenne et nombre de votes' })
  async getAverageRating(
    @Param('type') contentTypeRaw: string,
    @Param('id') contentId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    const contentType = this.parseContentType(contentTypeRaw);
    return this.contentsService.getAverageRating(contentId, contentType);
  }
}
