import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { isPostgresUniqueViolation } from '../common/utils/postgres-errors';
import { Tutorial } from './entities/tutorial.entity';
import { TutorialBlock } from './entities/tutorial-block.entity';
import { TutorialBlockCategory } from './enums/tutorial-block-category.enum';
import { TutorialFormat } from './enums/tutorial-format.enum';
import { CreateTutorialDto } from './dto/create-tutorial.dto';
import { CreateTutorialBlockDto } from './dto/create-tutorial-block.dto';
import { UpdateTutorialDto } from './dto/update-tutorial.dto';
import { SearchTutorialDto } from './dto/search-tutorial.dto';
import { ContentStatus } from '../common/enums/content-status.enum';
import { UserRole } from '../common/enums/user-role.enum';
import { ProfileRelationsClient } from '../common/clients/profile-relations.client';
import { Quiz } from '../quizzes/entities/quiz.entity';
import { ExerciseImageStorageService } from '../exercises/exercise-image-storage.service';
import { ExerciseImageTranscoder, TranscodedExerciseImage } from '../exercises/exercise-image-transcoder';
import {
  TUTORIAL_IMAGE_MAX_BYTES,
  TUTORIAL_IMAGE_INPUT_MAX_BYTES,
  TUTORIAL_JSON_BODY_MAX_BYTES,
} from './tutorial.constants';

/** Rôles autorisés à créer/éditer un tutoriel — mêmes rôles que le Quizz/l'Exercice (2026-08-28, 2026-08-29). */
export const TUTORIAL_CREATOR_ROLES = [
  UserRole.FORMATEUR,
  UserRole.ANIMATEUR_PEDAGOGIQUE,
  UserRole.RESPONSABLE_PEDAGOGIQUE,
];

const ADMIN_ROLES = [
  UserRole.ANIMATEUR_PEDAGOGIQUE,
  UserRole.RESPONSABLE_PEDAGOGIQUE,
  UserRole.TECHNICIEN_INFORMATIQUE,
];

const VALIDATOR_ROLES = [UserRole.ANIMATEUR_PEDAGOGIQUE, UserRole.RESPONSABLE_PEDAGOGIQUE];

/**
 * Nom de l'index UNIQUE posé directement par le décorateur `@Index(...)` de
 * `Tutorial` (voir `tutorial.entity.ts`) — table neuve après la migration de
 * nettoyage, pas de migration séparée nécessaire (contrairement à
 * `AddExerciseQuizTitleUniqueConstraint1795000000000`, qui devait fermer une
 * fenêtre de compétition sur des tables déjà en production).
 */
const TUTORIAL_TITLE_UNIQUE_CONSTRAINT = 'IDX_tutorial_author_title_unique';

/** Borne du retry sur violation `23505` de l'index UNIQUE titre — même valeur que Exercise/Quiz/Evaluation. */
const MAX_TITLE_DISAMBIGUATION_ATTEMPTS = 10;

export interface PublicTutorialBlock {
  id: string;
  blockNumber: number;
  category: TutorialBlockCategory;
  content: string | null;
  imageMimeType?: string;
  imageSizeBytes?: number;
}

export interface PublicTutorialSummary {
  id: string;
  title: string;
  description: string | null;
  theme: string | null;
  tags: string[] | null;
  level: string | null;
  difficulty: string | null;
  competencies: string[] | null;
  format: TutorialFormat;
  videoUrl: string | null;
  /**
   * Exposé uniquement si le Quizz référencé est `validated` au moment de la
   * lecture (arbitrage du 2026-09-03, point 5) — sinon `null`, quel que soit
   * l'appelant : un élève sans droit sur un Quizz non validé ne doit jamais
   * recevoir de lien mort ou cassé vers lui.
   */
  linkedQuizId: string | null;
  status: ContentStatus;
  authorId: string;
  authorRole: string;
  shareableLink: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PublicTutorialDetail extends PublicTutorialSummary {
  blocks: PublicTutorialBlock[];
}

@Injectable()
export class TutorialsService {
  constructor(
    @InjectRepository(Tutorial)
    private readonly tutorialRepository: Repository<Tutorial>,

    @InjectRepository(TutorialBlock)
    private readonly tutorialBlockRepository: Repository<TutorialBlock>,

    @InjectRepository(Quiz)
    private readonly quizRepository: Repository<Quiz>,

    private readonly profileRelationsClient: ProfileRelationsClient,
    private readonly imageStorage: ExerciseImageStorageService,
    private readonly imageTranscoder: ExerciseImageTranscoder,
  ) {}

  private isAdminRole(role: string): boolean {
    return ADMIN_ROLES.includes(role as UserRole);
  }

  /**
   * Droit de lecture élargi pour le validateur d'un tutoriel non validé
   * (arbitrage du 2026-09-03, point 7, qui applique explicitement au
   * Tutoriel l'arbitrage du 2026-09-02 "Visibilité du contenu en attente de
   * validation") : le RP lit sans restriction, l'AP est scopé par la
   * relation animator_of_teacher — même scoping que la décision de
   * validation, désormais étendue au Tutoriel (voir `ValidationsService`).
   */
  private async canReadAsValidator(
    callerRole: string,
    callerId: string,
    authorId: string,
  ): Promise<boolean> {
    if (
      callerRole === UserRole.RESPONSABLE_PEDAGOGIQUE ||
      callerRole === UserRole.TECHNICIEN_INFORMATIQUE
    ) {
      return true;
    }
    if (callerRole === UserRole.ANIMATEUR_PEDAGOGIQUE) {
      return this.profileRelationsClient.hasAnimatorOfTeacherRelation(callerId, authorId);
    }
    return false;
  }

  // ───────────────────────────────────────────────────────────────────────
  // Sérialisation publique
  // ───────────────────────────────────────────────────────────────────────

  private toPublicBlock(block: TutorialBlock): PublicTutorialBlock {
    return {
      id: block.id,
      blockNumber: block.blockNumber,
      category: block.category,
      content: block.content,
      imageMimeType: block.imageMimeType ?? undefined,
      imageSizeBytes: block.imageSizeBytes ?? undefined,
    };
  }

  private async resolveVisibleLinkedQuizId(linkedQuizId: string | null): Promise<string | null> {
    if (!linkedQuizId) {
      return null;
    }
    const quiz = await this.quizRepository.findOne({ where: { id: linkedQuizId } });
    if (!quiz || quiz.status !== ContentStatus.VALIDATED) {
      return null;
    }
    return linkedQuizId;
  }

  private async toPublicSummary(tutorial: Tutorial): Promise<PublicTutorialSummary> {
    return {
      id: tutorial.id,
      title: tutorial.title,
      description: tutorial.description ?? null,
      theme: tutorial.theme ?? null,
      tags: tutorial.tags ?? [],
      level: tutorial.level ?? null,
      difficulty: tutorial.difficulty ?? null,
      competencies: tutorial.competencies ?? null,
      format: tutorial.format,
      videoUrl: tutorial.videoUrl ?? null,
      linkedQuizId: await this.resolveVisibleLinkedQuizId(tutorial.linkedQuizId),
      status: tutorial.status,
      authorId: tutorial.authorId,
      authorRole: tutorial.authorRole,
      shareableLink: tutorial.shareableLink ?? null,
      createdAt: tutorial.createdAt,
      updatedAt: tutorial.updatedAt,
    };
  }

  private async toPublicDetail(tutorial: Tutorial): Promise<PublicTutorialDetail> {
    const blocks = [...(tutorial.blocks ?? [])].sort((a, b) => a.blockNumber - b.blockNumber);
    return {
      ...(await this.toPublicSummary(tutorial)),
      blocks: blocks.map((block) => this.toPublicBlock(block)),
    };
  }

  // ───────────────────────────────────────────────────────────────────────
  // Validation du format et des blocs à la création/édition
  // ───────────────────────────────────────────────────────────────────────

  /**
   * `video` exige `videoUrl` et interdit `blocks` ; `post` interdit
   * `videoUrl` et accepte `blocks` (éventuellement absent/vide — un post
   * peut être structuré librement, arbitrage du 2026-09-03 point 4).
   */
  private validateFormatConsistency(dto: CreateTutorialDto): void {
    if (dto.format === TutorialFormat.VIDEO) {
      if (!dto.videoUrl || !dto.videoUrl.trim()) {
        throw new BadRequestException("Un tutoriel vidéo doit porter une URL vidéo (videoUrl)");
      }
      if (dto.blocks && dto.blocks.length > 0) {
        throw new BadRequestException('Un tutoriel vidéo ne porte pas de blocs');
      }
    } else if (dto.format === TutorialFormat.POST) {
      if (dto.videoUrl) {
        throw new BadRequestException("Un tutoriel post ne porte pas d'URL vidéo");
      }
    }
  }

  /** `title`/`text` : content requis, pas d'image. `image` : imageData requis, content devient une légende optionnelle. */
  private validateBlockDto(block: CreateTutorialBlockDto, index: number): void {
    const position = index + 1;

    if (!Object.values(TutorialBlockCategory).includes(block.category)) {
      throw new BadRequestException(`Bloc ${position} : catégorie inconnue`);
    }

    if (block.category === TutorialBlockCategory.IMAGE) {
      if (!block.imageData) {
        throw new BadRequestException(`Bloc ${position} : une image est requise (imageData)`);
      }
      return;
    }

    if (block.imageData) {
      throw new BadRequestException(
        `Bloc ${position} : une image se dépose dans un bloc dédié (catégorie "image"), pas sur ce bloc`,
      );
    }
    if (!block.content || !block.content.trim()) {
      throw new BadRequestException(`Bloc ${position} : le contenu est requis`);
    }
  }

  // ───────────────────────────────────────────────────────────────────────
  // Images embarquées en base64 — même mécanisme que l'Exercice (2026-09-01),
  // réutilise directement ExerciseImageStorageService/ExerciseImageTranscoder.
  // ───────────────────────────────────────────────────────────────────────

  private decodeBase64Image(raw: string | undefined): Buffer {
    if (!raw) {
      throw new BadRequestException("Contenu d'image manquant (imageData requis pour un bloc de type image)");
    }
    const commaIndex = raw.indexOf(',');
    const payload = raw.startsWith('data:') && commaIndex !== -1 ? raw.slice(commaIndex + 1) : raw;

    let buffer: Buffer;
    try {
      buffer = Buffer.from(payload, 'base64');
    } catch {
      throw new BadRequestException("Contenu d'image invalide (base64 attendu)");
    }
    if (buffer.length === 0) {
      throw new BadRequestException("Contenu d'image vide ou invalide");
    }
    if (buffer.length > TUTORIAL_IMAGE_INPUT_MAX_BYTES) {
      throw new PayloadTooLargeException({
        statusCode: 413,
        error: 'Payload Too Large',
        code: 'TUTORIAL_IMAGE_TOO_LARGE',
        message: 'Le fichier envoyé est trop volumineux',
        maxUploadBytes: TUTORIAL_IMAGE_INPUT_MAX_BYTES,
        receivedBytes: buffer.length,
      });
    }
    return buffer;
  }

  private async transcodeAndValidateImage(buffer: Buffer): Promise<TranscodedExerciseImage> {
    const transcoded = await this.imageTranscoder.transcode(buffer);
    if (transcoded.bytes.length > TUTORIAL_IMAGE_MAX_BYTES) {
      throw new PayloadTooLargeException({
        statusCode: 413,
        error: 'Payload Too Large',
        code: 'TUTORIAL_IMAGE_TOO_LARGE',
        message: "L'image ré-encodée dépasse la taille maximale autorisée",
        maxUploadBytes: TUTORIAL_IMAGE_MAX_BYTES,
        receivedBytes: transcoded.bytes.length,
      });
    }
    return transcoded;
  }

  private async buildBlockEntity(
    dto: CreateTutorialBlockDto,
    tutorialId: string,
    blockNumber: number,
  ): Promise<TutorialBlock> {
    if (dto.category === TutorialBlockCategory.IMAGE) {
      const rawBuffer = this.decodeBase64Image(dto.imageData);
      const transcoded = await this.transcodeAndValidateImage(rawBuffer);
      const storedFilename = await this.imageStorage.save(transcoded.bytes);

      return this.tutorialBlockRepository.create({
        tutorialId,
        blockNumber,
        category: dto.category,
        content: dto.content ?? null,
        imageOriginalFilename: dto.imageOriginalFilename ?? null,
        imageStoredFilename: storedFilename,
        imageMimeType: transcoded.contentType,
        imageSizeBytes: transcoded.bytes.length,
      });
    }

    return this.tutorialBlockRepository.create({
      tutorialId,
      blockNumber,
      category: dto.category,
      content: dto.content ?? null,
    });
  }

  // ───────────────────────────────────────────────────────────────────────
  // Quizz lié — existence vérifiée à l'écriture, jamais son statut
  // (arbitrage du 2026-09-03, point 5 : "accepte la référence même vers un
  // Quizz non encore validé à l'écriture").
  // ───────────────────────────────────────────────────────────────────────

  private async assertLinkedQuizExists(linkedQuizId: string | undefined): Promise<void> {
    if (!linkedQuizId) {
      return;
    }
    const quiz = await this.quizRepository.findOne({ where: { id: linkedQuizId } });
    if (!quiz) {
      throw new BadRequestException(`Quizz lié ${linkedQuizId} introuvable`);
    }
  }

  // ───────────────────────────────────────────────────────────────────────
  // Titre — obligatoire et unique par auteur, disambiguation automatique
  // (même mécanisme exact que Exercise/Quiz/Evaluation, 2026-09-01)
  // ───────────────────────────────────────────────────────────────────────

  private async titleTakenByAuthor(title: string, authorId: string, excludeTutorialId?: string): Promise<boolean> {
    const qb = this.tutorialRepository
      .createQueryBuilder('tutorial')
      .andWhere('tutorial.authorId = :authorId', { authorId })
      .andWhere('tutorial.title = :title', { title })
      .andWhere('tutorial.status != :removed', { removed: ContentStatus.REMOVED });

    if (excludeTutorialId) {
      qb.andWhere('tutorial.id != :excludeTutorialId', { excludeTutorialId });
    }

    const existing = await qb.getOne();
    return !!existing;
  }

  private async resolveUniqueTitle(baseTitle: string, authorId: string, excludeTutorialId?: string): Promise<string> {
    let candidate = baseTitle;
    let n = 2;
    while (await this.titleTakenByAuthor(candidate, authorId, excludeTutorialId)) {
      candidate = `${baseTitle} (${n})`;
      n += 1;
    }
    return candidate;
  }

  /** Suggestion de titre par défaut ("Tutoriel (N)"), lue par le front à l'ouverture du formulaire de création. */
  async getDefaultTitle(authorId: string): Promise<{ title: string }> {
    const count = await this.tutorialRepository.count({
      where: { authorId, status: Not(ContentStatus.REMOVED) },
    });
    return { title: `Tutoriel (${count + 1})` };
  }

  private async createTutorialRowWithTitleRetry(
    createTutorialDto: CreateTutorialDto,
    authorId: string,
    authorRole: string,
    status: ContentStatus,
  ): Promise<Tutorial> {
    for (let attempt = 1; attempt <= MAX_TITLE_DISAMBIGUATION_ATTEMPTS; attempt += 1) {
      const title = await this.resolveUniqueTitle(createTutorialDto.title, authorId);

      const tutorial = this.tutorialRepository.create({
        title,
        description: createTutorialDto.description,
        theme: createTutorialDto.theme,
        tags: createTutorialDto.tags ?? [],
        level: createTutorialDto.level,
        difficulty: createTutorialDto.difficulty,
        competencies: createTutorialDto.competencies,
        format: createTutorialDto.format,
        videoUrl: createTutorialDto.format === TutorialFormat.VIDEO ? createTutorialDto.videoUrl : null,
        linkedQuizId: createTutorialDto.linkedQuizId ?? null,
        authorId,
        authorRole,
        status,
        shareableLink: null,
      });

      try {
        return await this.tutorialRepository.save(tutorial);
      } catch (err) {
        if (!isPostgresUniqueViolation(err, TUTORIAL_TITLE_UNIQUE_CONSTRAINT)) {
          throw err;
        }
        // Collision de dernière seconde : on retente avec un titre recalculé.
      }
    }

    throw new ConflictException('Impossible de trouver un titre disponible pour ce tutoriel, réessayez');
  }

  private async saveTutorialRowWithTitleRetry(
    tutorial: Tutorial,
    baseTitle: string,
    excludeTutorialId: string,
  ): Promise<Tutorial> {
    for (let attempt = 1; attempt <= MAX_TITLE_DISAMBIGUATION_ATTEMPTS; attempt += 1) {
      tutorial.title = await this.resolveUniqueTitle(baseTitle, tutorial.authorId, excludeTutorialId);

      try {
        return await this.tutorialRepository.save(tutorial);
      } catch (err) {
        if (!isPostgresUniqueViolation(err, TUTORIAL_TITLE_UNIQUE_CONSTRAINT)) {
          throw err;
        }
        // Collision de dernière seconde : on retente avec un titre recalculé.
      }
    }

    throw new ConflictException('Impossible de trouver un titre disponible pour ce tutoriel, réessayez');
  }

  // ───────────────────────────────────────────────────────────────────────
  // Création
  // ───────────────────────────────────────────────────────────────────────

  async create(createTutorialDto: CreateTutorialDto, authorId: string, authorRole: string): Promise<PublicTutorialDetail> {
    if (!TUTORIAL_CREATOR_ROLES.includes(authorRole as UserRole)) {
      throw new ForbiddenException('Seuls les formateurs, AP et RP peuvent créer un tutoriel');
    }

    if (!createTutorialDto.title || !createTutorialDto.title.trim()) {
      throw new BadRequestException('Le titre du tutoriel est obligatoire');
    }

    this.validateFormatConsistency(createTutorialDto);
    (createTutorialDto.blocks ?? []).forEach((block, index) => this.validateBlockDto(block, index));
    await this.assertLinkedQuizExists(createTutorialDto.linkedQuizId);

    // Statut fixé à la création selon le rôle, aligné sur Quizz/Exercice/Évaluation :
    // pending_validation pour un formateur, validated immédiatement pour AP/RP.
    const status =
      authorRole === UserRole.FORMATEUR ? ContentStatus.PENDING_VALIDATION : ContentStatus.VALIDATED;

    const savedTutorial = await this.createTutorialRowWithTitleRetry(createTutorialDto, authorId, authorRole, status);

    await this.saveBlocks(savedTutorial.id, createTutorialDto.blocks ?? []);

    savedTutorial.shareableLink = `/tutorials/${savedTutorial.id}`;
    await this.tutorialRepository.save(savedTutorial);

    return this.findOne(savedTutorial.id, authorId, authorRole);
  }

  private async saveBlocks(tutorialId: string, blocks: CreateTutorialBlockDto[]): Promise<void> {
    for (let index = 0; index < blocks.length; index += 1) {
      const entity = await this.buildBlockEntity(blocks[index], tutorialId, index + 1);
      await this.tutorialBlockRepository.save(entity);
    }
  }

  // ───────────────────────────────────────────────────────────────────────
  // Édition — réservée à l'auteur, alignée sur Quizz/Exercice/Évaluation
  // ───────────────────────────────────────────────────────────────────────

  /**
   * Remplace intégralement les blocs d'un tutoriel (format post).
   *
   * LIMITE CONNUE, assumée comme pour l'Exercice : les images précédemment
   * envoyées sont supprimées (fichiers inclus) à chaque édition — une image
   * existante peut être réintroduite dans le même appel `PUT` si le front la
   * renvoie explicitement.
   */
  async update(
    tutorialId: string,
    updateTutorialDto: UpdateTutorialDto,
    callerId: string,
    callerRole: string,
  ): Promise<PublicTutorialDetail> {
    const tutorial = await this.tutorialRepository.findOne({ where: { id: tutorialId } });
    if (!tutorial) {
      throw new NotFoundException(`Tutoriel ${tutorialId} introuvable`);
    }
    if (tutorial.authorId !== callerId) {
      throw new ForbiddenException("Seul l'auteur peut modifier ce tutoriel");
    }

    if (!updateTutorialDto.title || !updateTutorialDto.title.trim()) {
      throw new BadRequestException('Le titre du tutoriel est obligatoire');
    }

    this.validateFormatConsistency(updateTutorialDto);
    (updateTutorialDto.blocks ?? []).forEach((block, index) => this.validateBlockDto(block, index));
    await this.assertLinkedQuizExists(updateTutorialDto.linkedQuizId);

    await this.deleteImagesForTutorial(tutorialId);

    tutorial.description = updateTutorialDto.description;
    tutorial.theme = updateTutorialDto.theme;
    tutorial.tags = updateTutorialDto.tags ?? [];
    tutorial.level = updateTutorialDto.level;
    tutorial.difficulty = updateTutorialDto.difficulty;
    tutorial.competencies = updateTutorialDto.competencies;
    tutorial.format = updateTutorialDto.format;
    tutorial.videoUrl = updateTutorialDto.format === TutorialFormat.VIDEO ? updateTutorialDto.videoUrl ?? null : null;
    tutorial.linkedQuizId = updateTutorialDto.linkedQuizId ?? null;

    // Effet sur le statut (aligné sur Quizz/Exercice/Évaluation) : un auteur
    // formateur repasse systématiquement en revue ; un auteur AP/RP ne
    // change jamais de statut (déjà son propre validateur).
    if (tutorial.authorRole === UserRole.FORMATEUR) {
      tutorial.status = ContentStatus.PENDING_VALIDATION;
    }

    // Suppression intégrale des blocs — la cascade DB retire aussi leur FK.
    await this.tutorialBlockRepository.delete({ tutorialId });

    await this.saveBlocks(tutorialId, updateTutorialDto.blocks ?? []);

    // Écriture de la ligne racine APRÈS la cascade ci-dessus : le retry sur
    // violation de l'index UNIQUE titre ne rejoue donc jamais la
    // suppression/recréation des blocs.
    await this.saveTutorialRowWithTitleRetry(tutorial, updateTutorialDto.title, tutorialId);

    return this.findOne(tutorialId, callerId, callerRole);
  }

  /** Supprime du volume les fichiers des images déjà attachées à ce tutoriel, avant un remplacement intégral. */
  private async deleteImagesForTutorial(tutorialId: string): Promise<void> {
    const blocks = await this.tutorialBlockRepository.find({ where: { tutorialId } });
    const storedFilenames = blocks
      .filter((block) => block.category === TutorialBlockCategory.IMAGE && block.imageStoredFilename)
      .map((block) => block.imageStoredFilename as string);

    await Promise.all(storedFilenames.map((filename) => this.imageStorage.delete(filename)));
  }

  // ───────────────────────────────────────────────────────────────────────
  // Lecture / recherche
  // ───────────────────────────────────────────────────────────────────────

  async search(
    searchParams: SearchTutorialDto,
    callerId: string,
    callerRole: string,
  ): Promise<{ items: PublicTutorialSummary[]; total: number }> {
    const page = searchParams.page ?? 1;
    const limit = searchParams.limit ?? 20;
    const skip = (page - 1) * limit;

    const qb = this.tutorialRepository.createQueryBuilder('tutorial');

    if (!this.isAdminRole(callerRole)) {
      // Un tutoriel non validé reste invisible aux autres, sauf à son
      // auteur — aligné sur Quizz/Exercice/Évaluation.
      qb.andWhere('(tutorial.status = :validated OR tutorial.authorId = :callerId)', {
        validated: ContentStatus.VALIDATED,
        callerId,
      });
    }

    if (searchParams.level) qb.andWhere('tutorial.level = :level', { level: searchParams.level });
    if (searchParams.difficulty) qb.andWhere('tutorial.difficulty = :difficulty', { difficulty: searchParams.difficulty });
    if (searchParams.theme) qb.andWhere('tutorial.theme = :theme', { theme: searchParams.theme });
    if (searchParams.format) qb.andWhere('tutorial.format = :format', { format: searchParams.format });
    if (searchParams.authorId) qb.andWhere('tutorial.authorId = :authorId', { authorId: searchParams.authorId });

    if (searchParams.tag) {
      qb.andWhere(':tag = ANY(tutorial.tags)', { tag: searchParams.tag });
    }

    if (searchParams.keyword) {
      qb.andWhere('tutorial.title ILIKE :keyword', { keyword: `%${searchParams.keyword}%` });
    }

    qb.orderBy('tutorial.createdAt', 'DESC').skip(skip).take(limit);

    const [items, total] = await qb.getManyAndCount();

    return { items: await Promise.all(items.map((tutorial) => this.toPublicSummary(tutorial))), total };
  }

  async findOne(tutorialId: string, callerId: string, callerRole: string): Promise<PublicTutorialDetail> {
    const tutorial = await this.tutorialRepository.findOne({
      where: { id: tutorialId },
      relations: ['blocks'],
    });
    if (!tutorial) {
      throw new NotFoundException(`Tutoriel ${tutorialId} introuvable`);
    }

    const isOwner = tutorial.authorId === callerId;
    if (tutorial.status !== ContentStatus.VALIDATED && !isOwner) {
      const canRead = await this.canReadAsValidator(callerRole, callerId, tutorial.authorId);
      if (!canRead) {
        // Un tutoriel non validé n'existe pas pour qui n'a pas le droit de le voir
        throw new NotFoundException(`Tutoriel ${tutorialId} introuvable`);
      }
    }

    return this.toPublicDetail(tutorial);
  }

  async getPendingValidation(
    callerId: string,
    callerRole: string,
    page = 1,
    limit = 20,
  ): Promise<{ items: PublicTutorialSummary[]; total: number }> {
    if (!VALIDATOR_ROLES.includes(callerRole as UserRole)) {
      throw new ForbiddenException('Seuls les AP et RP peuvent consulter les tutoriels en attente de validation');
    }

    // Un AP ne voit que les tutoriels des formateurs qu'il anime — même
    // mécanisme que Quizz/Exercice/Évaluation (2026-08-28/29, étendu au
    // Tutoriel le 2026-09-03).
    if (callerRole === UserRole.ANIMATEUR_PEDAGOGIQUE) {
      const allPending = await this.tutorialRepository.find({
        where: { status: ContentStatus.PENDING_VALIDATION },
        order: { createdAt: 'ASC' },
      });

      const authorIds = [...new Set(allPending.map((tutorial) => tutorial.authorId))];
      const allowedAuthorIds = new Set<string>();
      await Promise.all(
        authorIds.map(async (authorId) => {
          const hasRelation = await this.profileRelationsClient.hasAnimatorOfTeacherRelation(callerId, authorId);
          if (hasRelation) {
            allowedAuthorIds.add(authorId);
          }
        }),
      );

      const scoped = allPending.filter((tutorial) => allowedAuthorIds.has(tutorial.authorId));
      const total = scoped.length;
      const skip = (page - 1) * limit;
      const items = scoped.slice(skip, skip + limit);

      return { items: await Promise.all(items.map((tutorial) => this.toPublicSummary(tutorial))), total };
    }

    const skip = (page - 1) * limit;
    const [items, total] = await this.tutorialRepository.findAndCount({
      where: { status: ContentStatus.PENDING_VALIDATION },
      order: { createdAt: 'ASC' },
      skip,
      take: limit,
    });

    return { items: await Promise.all(items.map((tutorial) => this.toPublicSummary(tutorial))), total };
  }

  async removeTutorial(tutorialId: string, requesterId: string, callerRole: string): Promise<void> {
    const tutorial = await this.tutorialRepository.findOne({ where: { id: tutorialId } });
    if (!tutorial) {
      throw new NotFoundException(`Tutoriel ${tutorialId} introuvable`);
    }

    const canRemove =
      callerRole === UserRole.RESPONSABLE_PEDAGOGIQUE ||
      callerRole === UserRole.TECHNICIEN_INFORMATIQUE ||
      tutorial.authorId === requesterId;

    if (!canRemove) {
      throw new ForbiddenException("Vous n'avez pas le droit de retirer ce tutoriel");
    }

    tutorial.status = ContentStatus.REMOVED;
    await this.tutorialRepository.save(tutorial);
  }

  // ───────────────────────────────────────────────────────────────────────
  // Images — téléchargement des octets d'un bloc image, revérifie la
  // visibilité du tutoriel parent à chaque appel.
  // ───────────────────────────────────────────────────────────────────────

  async getBlockImageForDownload(
    tutorialId: string,
    blockId: string,
    callerId: string,
    callerRole: string,
  ): Promise<{ block: TutorialBlock; buffer: Buffer }> {
    // Réapplique la même règle de visibilité que findOne().
    await this.findOne(tutorialId, callerId, callerRole);

    const block = await this.tutorialBlockRepository.findOne({ where: { id: blockId, tutorialId } });
    if (!block || block.category !== TutorialBlockCategory.IMAGE || !block.imageStoredFilename) {
      throw new NotFoundException('Image introuvable');
    }

    const buffer = await this.imageStorage.read(block.imageStoredFilename);
    return { block, buffer };
  }

  // ───────────────────────────────────────────────────────────────────────
  // Plafonds d'image — lus par le front avant d'afficher le bouton d'ajout,
  // jamais codés en dur côté client (même discipline que l'Exercice).
  // ───────────────────────────────────────────────────────────────────────

  getImageConstraints(): {
    maxImageInputBytes: number;
    maxImageOutputBytes: number;
    maxRequestBodyBytes: number;
  } {
    return {
      maxImageInputBytes: TUTORIAL_IMAGE_INPUT_MAX_BYTES,
      maxImageOutputBytes: TUTORIAL_IMAGE_MAX_BYTES,
      maxRequestBodyBytes: TUTORIAL_JSON_BODY_MAX_BYTES,
    };
  }
}
