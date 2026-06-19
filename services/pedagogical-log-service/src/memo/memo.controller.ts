import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { MemoService } from './memo.service';
import { CreateMemoDto } from './dto/create-memo.dto';
import { UpdateMemoDto } from './dto/update-memo.dto';

/**
 * Routes mémos — formulaire structuré appartenant à l'élève
 *
 * Le mémo est un outil personnel de l'élève (formules, trucs essentiels).
 * Il N'EST PAS une note interne du personnel (docs/routes.md, XML spec func 004).
 *
 * GET    /memos      → eleve uniquement (liste ses propres mémos)
 * POST   /memos      → eleve uniquement
 * GET    /memos/:id  → eleve propriétaire + formateur/RP/AP en lecture seule
 * PUT    /memos/:id  → eleve propriétaire uniquement
 * DELETE /memos/:id  → eleve propriétaire uniquement
 *
 * PLOG-BR-003: un formateur tentant POST/PUT/DELETE reçoit 403.
 */
@ApiTags('memos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('memos')
export class MemoController {
  constructor(private readonly service: MemoService) {}

  @Post()
  @Roles(UserRole.ELEVE)
  @ApiOperation({
    summary: 'Créer un mémo',
    description:
      'Crée un mémo pour l\'élève connecté. ' +
      'Seul l\'élève peut créer ses propres mémos (PLOG-BR-003). ' +
      'Un formateur ou RP tentant cette route reçoit 403.',
  })
  @ApiResponse({ status: 201, description: 'Mémo créé' })
  @ApiResponse({ status: 400, description: 'Erreur de validation' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: 'Interdit — réservé à l\'élève' })
  create(@Body() dto: CreateMemoDto, @Req() req: any) {
    return this.service.create(dto, req.user.id);
  }

  @Get()
  @Roles(UserRole.ELEVE)
  @ApiOperation({
    summary: 'Lister les mémos de l\'élève connecté',
    description:
      'Retourne tous les mémos appartenant à l\'élève connecté (filtre par studentId = userId JWT). ' +
      'Tout autre rôle reçoit 403.',
  })
  @ApiResponse({ status: 200, description: 'Liste des mémos' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: 'Interdit — réservé à l\'élève' })
  findAll(@Req() req: any) {
    return this.service.findByStudent(req.user.id);
  }

  @Get(':id')
  @Roles(
    UserRole.ELEVE,
    UserRole.FORMATEUR,
    UserRole.RESPONSABLE_PEDAGOGIQUE,
    UserRole.ANIMATEUR_PEDAGOGIQUE,
  )
  @ApiParam({ name: 'id', description: 'UUID du mémo' })
  @ApiOperation({
    summary: 'Lire un mémo par ID',
    description:
      'L\'élève propriétaire peut toujours lire. ' +
      'Le formateur lié, le RP et l\'AP peuvent lire en lecture seule. ' +
      'Le parent financeur et les autres rôles sont refusés (403).',
  })
  @ApiResponse({ status: 200, description: 'Mémo trouvé' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: 'Interdit' })
  @ApiResponse({ status: 404, description: 'Mémo introuvable' })
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.service.findOne(id, req.user.id, req.user.role);
  }

  @Put(':id')
  @Roles(UserRole.ELEVE)
  @ApiParam({ name: 'id', description: 'UUID du mémo' })
  @ApiOperation({
    summary: 'Modifier un mémo',
    description:
      'Seul l\'élève propriétaire peut modifier son mémo (PLOG-BR-003). ' +
      'Tout autre rôle reçoit 403.',
  })
  @ApiResponse({ status: 200, description: 'Mémo modifié' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: 'Interdit — seul l\'élève propriétaire peut modifier' })
  @ApiResponse({ status: 404, description: 'Mémo introuvable' })
  update(@Param('id') id: string, @Body() dto: UpdateMemoDto, @Req() req: any) {
    return this.service.update(id, dto, req.user.id);
  }

  @Delete(':id')
  @Roles(UserRole.ELEVE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiParam({ name: 'id', description: 'UUID du mémo' })
  @ApiOperation({
    summary: 'Supprimer un mémo',
    description:
      'Seul l\'élève propriétaire peut supprimer son mémo (PLOG-BR-003). ' +
      'Tout autre rôle reçoit 403.',
  })
  @ApiResponse({ status: 204, description: 'Mémo supprimé' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: 'Interdit — seul l\'élève propriétaire peut supprimer' })
  @ApiResponse({ status: 404, description: 'Mémo introuvable' })
  remove(@Param('id') id: string, @Req() req: any) {
    return this.service.remove(id, req.user.id);
  }
}
