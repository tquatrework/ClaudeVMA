import {
  Controller,
  Post,
  Get,
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
import { ValidationsService } from './validations.service';
import { ValidateContentDto } from './dto/validate-content.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { AuthenticatedUser } from '../common/guards/jwt-auth.guard';
import { ContentType } from '../common/enums/content-type.enum';

@ApiTags('validations')
@ApiBearerAuth()
@Controller('validations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ValidationsController {
  constructor(private readonly validationsService: ValidationsService) {}

  private parseContentType(rawType: string): ContentType {
    if (!Object.values(ContentType).includes(rawType as ContentType)) {
      throw new BadRequestException(`Type de contenu invalide : ${rawType}`);
    }
    return rawType as ContentType;
  }

  @Post(':type/:id/request')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.FORMATEUR, UserRole.ANIMATEUR_PEDAGOGIQUE, UserRole.RESPONSABLE_PEDAGOGIQUE)
  @ApiOperation({
    summary: 'Soumettre un contenu à validation',
    description: 'Change le statut d\'un contenu à pending_validation pour déclencher la révision par un AP ou RP.',
  })
  @ApiParam({ name: 'type', description: 'Type de contenu : exercise, evaluation, tutorial' })
  @ApiParam({ name: 'id', description: 'UUID du contenu' })
  @ApiResponse({ status: 204, description: 'Contenu soumis à validation' })
  @ApiResponse({ status: 403, description: 'Rôle insuffisant' })
  @ApiResponse({ status: 404, description: 'Contenu introuvable' })
  @ApiHeader({ name: 'x-correlation-id', required: false })
  async requestValidation(
    @Param('type') contentTypeRaw: string,
    @Param('id') contentId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    const contentType = this.parseContentType(contentTypeRaw);
    return this.validationsService.requestValidation(
      contentId,
      contentType,
      currentUser.id,
      currentUser.role,
    );
  }

  @Post(':type/:id/decision')
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.ANIMATEUR_PEDAGOGIQUE, UserRole.RESPONSABLE_PEDAGOGIQUE)
  @ApiOperation({
    summary: 'Valider ou rejeter un contenu',
    description: 'Permet à un AP ou RP de valider ou rejeter un contenu pédagogique. Le commentaire est obligatoire en cas de rejet.',
  })
  @ApiParam({ name: 'type', description: 'Type de contenu : exercise, evaluation, tutorial' })
  @ApiParam({ name: 'id', description: 'UUID du contenu' })
  @ApiResponse({ status: 201, description: 'Décision enregistrée' })
  @ApiResponse({ status: 400, description: 'Commentaire manquant pour un rejet, ou données invalides' })
  @ApiResponse({ status: 403, description: 'Réservé aux AP et RP' })
  @ApiHeader({ name: 'x-correlation-id', required: false })
  async validateContent(
    @Param('type') contentTypeRaw: string,
    @Param('id') contentId: string,
    @Body() validateDto: ValidateContentDto,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    const contentType = this.parseContentType(contentTypeRaw);
    return this.validationsService.validateContent(
      contentId,
      contentType,
      validateDto,
      currentUser.id,
      currentUser.role,
    );
  }

  @Get(':type/:id/history')
  @Roles(
    UserRole.FORMATEUR,
    UserRole.ANIMATEUR_PEDAGOGIQUE,
    UserRole.RESPONSABLE_PEDAGOGIQUE,
    UserRole.TECHNICIEN_INFORMATIQUE,
  )
  @ApiOperation({
    summary: 'Historique des validations d\'un contenu',
    description:
      'Retourne toutes les décisions de validation prises sur un contenu donné. ' +
      'Accessible sans restriction aux AP, RP et TI, et à l\'auteur du contenu pour son propre ' +
      'historique — notamment pour relire le motif de son propre refus.',
  })
  @ApiParam({ name: 'type', description: 'Type de contenu : exercise, evaluation, tutorial, quiz' })
  @ApiParam({ name: 'id', description: 'UUID du contenu' })
  @ApiResponse({ status: 200, description: 'Historique des validations' })
  @ApiResponse({ status: 403, description: 'Réservé aux AP/RP/TI ou à l\'auteur du contenu' })
  @ApiResponse({ status: 404, description: 'Contenu introuvable' })
  async getValidationHistory(
    @Param('type') contentTypeRaw: string,
    @Param('id') contentId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    const contentType = this.parseContentType(contentTypeRaw);
    return this.validationsService.getValidationHistory(
      contentId,
      contentType,
      currentUser.id,
      currentUser.role,
    );
  }
}
