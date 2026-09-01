import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UseFilters,
  UploadedFile,
  HttpCode,
  HttpStatus,
  Headers,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiHeader,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { QuizzesService } from './quizzes.service';
import { QuizImportService, QuizImportBlockResult } from './quiz-import.service';
import { QuizImportPayloadTooLargeFilter } from './quiz-import-payload-too-large.filter';
import { QUIZ_IMPORT_MAX_FILE_SIZE_BYTES } from './quiz-import.constants';
import { CreateQuizDto } from './dto/create-quiz.dto';
import { UpdateQuizDto } from './dto/update-quiz.dto';
import { SearchQuizDto } from './dto/search-quiz.dto';
import { PendingValidationQueryDto } from './dto/pending-validation-query.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { AuthenticatedUser } from '../common/guards/jwt-auth.guard';

@ApiTags('quizzes')
@ApiBearerAuth()
@Controller('quizzes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class QuizzesController {
  constructor(
    private readonly quizzesService: QuizzesService,
    private readonly quizImportService: QuizImportService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Rechercher des quizz',
    description:
      'Retourne la liste des quizz visibles par l\'appelant, filtrable par tag et mot-clé. ' +
      'Un quizz non validé reste invisible sauf à son auteur, aux AP, RP et TI. La solution n\'est jamais incluse. ' +
      'Avec `mine=true`, retourne tous les quizz de l\'appelant, tous statuts confondus (y compris rejected).',
  })
  @ApiResponse({ status: 200, description: 'Liste des quizz correspondants' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiHeader({ name: 'x-correlation-id', required: false })
  async search(
    @Query() searchParams: SearchQuizDto,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.quizzesService.search(searchParams, currentUser.id, currentUser.role);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.FORMATEUR, UserRole.ANIMATEUR_PEDAGOGIQUE, UserRole.RESPONSABLE_PEDAGOGIQUE)
  @ApiOperation({
    summary: 'Créer un quizz',
    description:
      'Crée un quizz avec ses questions, sa solution et son barème. Réservé aux formateurs, AP et RP. ' +
      'Un quizz créé par un formateur passe en attente de validation ; un quizz créé par un AP ou un RP est auto-validé.',
  })
  @ApiResponse({ status: 201, description: 'Quizz créé (jamais de solution dans la réponse)' })
  @ApiResponse({ status: 400, description: 'Données invalides (question mal formée, solution manquante...)' })
  @ApiResponse({ status: 403, description: 'Rôle insuffisant' })
  @ApiHeader({ name: 'x-correlation-id', required: false })
  async create(
    @Body() createQuizDto: CreateQuizDto,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.quizzesService.create(createQuizDto, currentUser.id, currentUser.role);
  }

  @Put(':id')
  @Roles(UserRole.FORMATEUR, UserRole.ANIMATEUR_PEDAGOGIQUE, UserRole.RESPONSABLE_PEDAGOGIQUE)
  @ApiOperation({
    summary: 'Modifier un quizz',
    description:
      'Remplace le contenu d\'un quizz (titre, description, tags, barème, pénalité, questions). ' +
      'Réservé à son auteur. Un quizz édité par son auteur formateur repasse en attente de validation, ' +
      'quel que soit son statut précédent ; un quizz édité par son auteur AP/RP ne change pas de statut.',
  })
  @ApiParam({ name: 'id', description: 'UUID du quizz' })
  @ApiResponse({ status: 200, description: 'Quizz modifié' })
  @ApiResponse({ status: 400, description: 'Données invalides (question mal formée, solution manquante...)' })
  @ApiResponse({ status: 403, description: 'Réservé à l\'auteur du quizz' })
  @ApiResponse({ status: 404, description: 'Quizz introuvable' })
  @ApiHeader({ name: 'x-correlation-id', required: false })
  async update(
    @Param('id') quizId: string,
    @Body() updateQuizDto: UpdateQuizDto,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.quizzesService.update(quizId, updateQuizDto, currentUser.id, currentUser.role);
  }

  @Get('default-title')
  @Roles(UserRole.FORMATEUR, UserRole.ANIMATEUR_PEDAGOGIQUE, UserRole.RESPONSABLE_PEDAGOGIQUE)
  @ApiOperation({
    summary: 'Suggérer un titre par défaut avant création',
    description:
      'À lire par le front à l\'ouverture du formulaire de création, pour pré-remplir le champ titre ' +
      '(obligatoire). Forme "Quizz {n}", où {n} est le nombre de quizz déjà créés par l\'appelant, plus un. ' +
      'Ne réserve rien : l\'utilisateur reste libre de modifier la valeur avant de valider.',
  })
  @ApiResponse({ status: 200, description: 'Titre suggéré', schema: { example: { title: 'Quizz 4' } } })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  async getDefaultTitle(@CurrentUser() currentUser: AuthenticatedUser): Promise<{ title: string }> {
    return this.quizzesService.getDefaultTitle(currentUser.id);
  }

  @Get('pending-validation')
  @Roles(UserRole.ANIMATEUR_PEDAGOGIQUE, UserRole.RESPONSABLE_PEDAGOGIQUE)
  @ApiOperation({
    summary: 'Lister les quizz en attente de validation',
    description:
      'Retourne les quizz créés par un professeur, en attente de validation par un AP ou un RP. ' +
      'Un AP ne voit que les quizz des formateurs qu\'il anime ; un RP voit tout.',
  })
  @ApiResponse({ status: 200, description: 'Liste des quizz en attente de validation' })
  @ApiResponse({ status: 403, description: 'Réservé aux AP et RP' })
  @ApiResponse({ status: 503, description: 'profile-service injoignable (vérification de la relation AP↔formateur impossible)' })
  async getPendingValidation(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Query() query: PendingValidationQueryDto,
  ) {
    return this.quizzesService.getPendingValidation(currentUser.id, currentUser.role, query.page, query.limit);
  }

  @Get('import/constraints')
  @ApiOperation({
    summary: 'Contraintes de l\'import de quizz par fichier',
    description:
      'À lire AVANT d\'ouvrir le sélecteur de fichier, pour annoncer la limite avant sélection. ' +
      'Ouverte à tout compte authentifié (le formateur doit pouvoir la lire sans être AP/RP).',
  })
  @ApiResponse({ status: 200, description: 'Contraintes en vigueur', schema: { example: { maxFileSizeBytes: 900000 } } })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  getImportConstraints(): { maxFileSizeBytes: number } {
    return this.quizImportService.getConstraints();
  }

  @Post('import')
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.FORMATEUR, UserRole.ANIMATEUR_PEDAGOGIQUE, UserRole.RESPONSABLE_PEDAGOGIQUE)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: QUIZ_IMPORT_MAX_FILE_SIZE_BYTES } }))
  @UseFilters(QuizImportPayloadTooLargeFilter)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } },
  })
  @ApiOperation({
    summary: 'Importer plusieurs quizz depuis un fichier tableur (CSV ou Excel .xlsx)',
    description:
      'Réutilise le service de création existant bloc par bloc : un quizz importé par un formateur ' +
      'passe en attente de validation exactement comme à la création manuelle, un quizz importé par ' +
      'un AP ou un RP est auto-validé. Un fichier peut contenir plusieurs quizz empilés ; l\'échec ' +
      'd\'un bloc (ligne malformée, catégorie inconnue...) n\'empêche jamais la création des autres ' +
      'blocs valides du même fichier. Le type de fichier est détecté sur les octets réels (CSV ou ' +
      'ZIP/xlsx), jamais sur l\'extension ni le Content-Type du client.',
  })
  @ApiResponse({
    status: 201,
    description: 'Un résultat par bloc "quizz" détecté dans le fichier (créé ou en erreur)',
    schema: {
      example: [
        { blockIndex: 0, status: 'created', quizId: 'uuid', validationStatus: 'pending_validation' },
        { blockIndex: 1, status: 'error', errors: [{ row: 12, message: 'Catégorie de question inconnue : "qcm"' }] },
      ],
    },
  })
  @ApiResponse({ status: 400, description: 'Aucun fichier, format non reconnu, ou fichier vide/sans bloc "quizz"' })
  @ApiResponse({ status: 403, description: 'Rôle insuffisant' })
  @ApiResponse({ status: 413, description: 'Fichier trop volumineux — corps structuré (code, maxFileSizeBytes, requestBodyBytes)' })
  async importQuizzes(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<QuizImportBlockResult[]> {
    return this.quizImportService.importFile(file, currentUser.id, currentUser.role);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Récupérer un quizz par identifiant',
    description: 'Retourne les questions et choix d\'un quizz, jamais la solution. 404 si non trouvé ou non visible pour l\'appelant.',
  })
  @ApiParam({ name: 'id', description: 'UUID du quizz' })
  @ApiResponse({ status: 200, description: 'Quizz trouvé' })
  @ApiResponse({ status: 404, description: 'Quizz introuvable ou non visible pour l\'appelant' })
  async findOne(
    @Param('id') quizId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.quizzesService.findOne(quizId, currentUser.id, currentUser.role);
  }

  @Get(':id/solution')
  @Roles(
    UserRole.FORMATEUR,
    UserRole.ANIMATEUR_PEDAGOGIQUE,
    UserRole.RESPONSABLE_PEDAGOGIQUE,
    UserRole.TECHNICIEN_INFORMATIQUE,
  )
  @ApiOperation({
    summary: 'Récupérer la solution complète d\'un quizz',
    description:
      'Retourne les questions avec la solution (bonnes réponses cochées, mots-clés attendus). ' +
      'Réservé à l\'auteur du quizz et aux AP, RP, TI — jamais aux autres appelants. ' +
      '`GET /quizzes/:id` reste la route publique et ne renvoie jamais la solution, ' +
      'quel que soit l\'appelant (arbitrage du 2026-08-28).',
  })
  @ApiParam({ name: 'id', description: 'UUID du quizz' })
  @ApiResponse({ status: 200, description: 'Quizz avec solution complète' })
  @ApiResponse({ status: 403, description: 'Réservé à l\'auteur du quizz et aux AP/RP/TI' })
  @ApiResponse({ status: 404, description: 'Quizz introuvable' })
  async getSolution(
    @Param('id') quizId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.quizzesService.findOneWithSolution(quizId, currentUser.id, currentUser.role);
  }
}
