import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { AttachmentsService } from './attachments.service';

/**
 * Pièces jointes d'une entrée de cahier de texte.
 *
 * Montées sous `logs/:id/attachments` : `/logs` est déjà un préfixe proxié
 * par api-gateway (voir docs/routes.md, section pedagogical-log-service),
 * aucun nouveau préfixe gateway n'est nécessaire.
 */
@ApiTags('pedagogical-log-attachments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('logs/:id/attachments')
export class AttachmentsController {
  constructor(private readonly service: AttachmentsService) {}

  @Post()
  @Roles(UserRole.FORMATEUR)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @ApiParam({ name: 'id', description: "UUID de l'entrée de cahier de texte" })
  @ApiOperation({
    summary: 'Ajouter une pièce jointe à une entrée de cahier de texte',
    description:
      "Réservé au formateur auteur, toujours titulaire de la relation avec l'élève (même " +
      'régime que sessionSummary/homework). Multipart, champ `file`, un seul fichier. Type ' +
      'détecté sur les octets réels — liste blanche PDF/images/DOCX-XLSX-PPTX/DOC-XLS-PPT/' +
      'texte-CSV, SVG explicitement refusé.',
  })
  @ApiResponse({ status: 201, description: 'Pièce jointe créée' })
  @ApiResponse({ status: 400, description: 'Fichier absent, format non reconnu ou SVG' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: 'Non autorisé, ou pièces jointes désactivées par le TI' })
  @ApiResponse({ status: 404, description: 'Entrée introuvable' })
  @ApiResponse({ status: 413, description: 'Fichier trop volumineux, ou budget total de l\'entrée dépassé' })
  @ApiResponse({ status: 503, description: 'profile-service injoignable — vérification de la relation impossible' })
  create(
    @Param('id') logEntryId: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    return this.service.create(logEntryId, file, req.user.id, req.user.role);
  }

  @Get()
  @Roles(
    UserRole.ELEVE,
    UserRole.PARENT_FINANCEUR,
    UserRole.FORMATEUR,
    UserRole.ANIMATEUR_PEDAGOGIQUE,
    UserRole.RESPONSABLE_PEDAGOGIQUE,
    UserRole.TECHNICIEN_INFORMATIQUE,
    UserRole.ADMINISTRATEUR_FINANCIER,
  ) // accès filtré par la visibilité de l'entrée parente dans le service
  @ApiParam({ name: 'id', description: "UUID de l'entrée de cahier de texte" })
  @ApiOperation({ summary: "Lister les pièces jointes d'une entrée" })
  @ApiResponse({ status: 200, description: 'Liste des pièces jointes' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: 'Visibilité non autorisée pour ce rôle' })
  @ApiResponse({ status: 404, description: 'Entrée introuvable' })
  findAll(@Param('id') logEntryId: string, @Req() req: any) {
    return this.service.findAllForEntry(logEntryId, req.user.role);
  }

  @Get(':attachmentId')
  @Roles(
    UserRole.ELEVE,
    UserRole.PARENT_FINANCEUR,
    UserRole.FORMATEUR,
    UserRole.ANIMATEUR_PEDAGOGIQUE,
    UserRole.RESPONSABLE_PEDAGOGIQUE,
    UserRole.TECHNICIEN_INFORMATIQUE,
    UserRole.ADMINISTRATEUR_FINANCIER,
  ) // accès filtré par la visibilité de l'entrée parente dans le service
  @ApiParam({ name: 'id', description: "UUID de l'entrée de cahier de texte" })
  @ApiParam({ name: 'attachmentId', description: 'UUID de la pièce jointe' })
  @ApiOperation({ summary: "Télécharger les octets d'une pièce jointe" })
  @ApiResponse({ status: 200, description: 'Octets du fichier' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: 'Visibilité non autorisée pour ce rôle' })
  @ApiResponse({ status: 404, description: 'Entrée ou pièce jointe introuvable' })
  async download(
    @Param('id') logEntryId: string,
    @Param('attachmentId') attachmentId: string,
    @Req() req: any,
    @Res() res: Response,
  ) {
    const { attachment, buffer } = await this.service.getFileForDownload(
      logEntryId,
      attachmentId,
      req.user.role,
    );
    res.set({
      'Content-Type': attachment.mimeType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(attachment.originalFilename)}"`,
      'Content-Length': buffer.length,
    });
    res.send(buffer);
  }

  @Delete(':attachmentId')
  @Roles(UserRole.FORMATEUR)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiParam({ name: 'id', description: "UUID de l'entrée de cahier de texte" })
  @ApiParam({ name: 'attachmentId', description: 'UUID de la pièce jointe' })
  @ApiOperation({
    summary: 'Supprimer une pièce jointe',
    description: "Réservé au formateur auteur, toujours titulaire de la relation avec l'élève.",
  })
  @ApiResponse({ status: 204, description: 'Pièce jointe supprimée' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: 'Non autorisé' })
  @ApiResponse({ status: 404, description: 'Entrée ou pièce jointe introuvable' })
  @ApiResponse({ status: 503, description: 'profile-service injoignable — vérification de la relation impossible' })
  remove(
    @Param('id') logEntryId: string,
    @Param('attachmentId') attachmentId: string,
    @Req() req: any,
  ) {
    return this.service.remove(logEntryId, attachmentId, req.user.id, req.user.role);
  }
}
