import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Exercise } from './entities/exercise.entity';
import { ExercisePart } from './entities/exercise-part.entity';
import { ExerciseSolution } from './entities/exercise-solution.entity';
import { ExerciseContentItem, ExerciseContentItemType } from './entities/exercise-content-item.entity';
import { ExercisePartCategory } from './enums/exercise-part-category.enum';
import { CreateExerciseDto } from './dto/create-exercise.dto';
import { CreateExercisePartDto } from './dto/create-exercise-part.dto';
import { CreateExerciseContentItemDto } from './dto/create-exercise-content-item.dto';
import { UpdateExerciseDto } from './dto/update-exercise.dto';
import { SearchExerciseDto } from './dto/search-exercise.dto';
import { ContentStatus } from '../common/enums/content-status.enum';
import { UserRole } from '../common/enums/user-role.enum';
import { ProfileRelationsClient } from '../common/clients/profile-relations.client';
import { ExerciseImageStorageService } from './exercise-image-storage.service';
import { ExerciseImageTranscoder } from './exercise-image-transcoder';
import { CreateExerciseImageDto } from './dto/create-exercise-image.dto';
import { EXERCISE_IMAGE_MAX_BYTES } from './exercise.constants';

/** Rôles autorisés à créer/éditer un exercice — mêmes rôles que le Quizz (2026-08-28). */
export const EXERCISE_CREATOR_ROLES = [
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

/** Forme publique d'un item de contenu — jamais le contenu d'une solution hors de la route interne dédiée. */
export interface PublicContentItem {
  id: string;
  type: ExerciseContentItemType;
  order: number;
  content: string | null;
  imageMimeType?: string;
  imageSizeBytes?: number;
}

export interface PublicExercisePart {
  id: string;
  partNumber: number;
  category: ExercisePartCategory;
  items: PublicContentItem[];
  /** Indique la présence d'une solution — jamais son contenu (voir route interne dédiée). */
  hasSolution: boolean;
}

export interface PublicExerciseSummary {
  id: string;
  title: string | null;
  description: string | null;
  level: string | null;
  difficulty: string | null;
  theme: string | null;
  competencies: string[] | null;
  tags: string[] | null;
  status: ContentStatus;
  authorId: string;
  authorRole: string;
  shareableLink: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PublicExerciseDetail extends PublicExerciseSummary {
  parts: PublicExercisePart[];
}

/**
 * Bloc avec le contenu complet de sa solution — jamais renvoyé par une route
 * publique. Réservé à l'auteur de l'exercice et aux AP/RP/TI (arbitrage du
 * 2026-09-01, "Titre des Exercices et des Quizz", point 6 : même lecture que
 * l'arbitrage Quizz du 2026-08-28, "Lecture de sa propre solution par
 * l'auteur d'un Quizz" — la règle "jamais la solution" protège l'élève qui
 * passe le contenu, pas l'auteur qui relit ce qu'il a lui-même écrit).
 */
export interface PublicExercisePartWithSolution extends Omit<PublicExercisePart, 'hasSolution'> {
  solution: { items: PublicContentItem[] } | null;
}

export interface PublicExerciseDetailWithSolutions extends PublicExerciseSummary {
  parts: PublicExercisePartWithSolution[];
}

@Injectable()
export class ExercisesService {
  constructor(
    @InjectRepository(Exercise)
    private readonly exerciseRepository: Repository<Exercise>,

    @InjectRepository(ExercisePart)
    private readonly exercisePartRepository: Repository<ExercisePart>,

    @InjectRepository(ExerciseSolution)
    private readonly exerciseSolutionRepository: Repository<ExerciseSolution>,

    @InjectRepository(ExerciseContentItem)
    private readonly exerciseContentItemRepository: Repository<ExerciseContentItem>,

    private readonly profileRelationsClient: ProfileRelationsClient,
    private readonly imageStorage: ExerciseImageStorageService,
    private readonly imageTranscoder: ExerciseImageTranscoder,
  ) {}

  private isAdminRole(role: string): boolean {
    return ADMIN_ROLES.includes(role as UserRole);
  }

  // ───────────────────────────────────────────────────────────────────────
  // Sérialisation publique — le contenu d'une solution n'est jamais inclus
  // ───────────────────────────────────────────────────────────────────────

  private toPublicItem(item: ExerciseContentItem): PublicContentItem {
    return {
      id: item.id,
      type: item.type,
      order: item.order,
      content: item.content,
      imageMimeType: item.imageMimeType ?? undefined,
      imageSizeBytes: item.imageSizeBytes ?? undefined,
    };
  }

  private toPublicPart(part: ExercisePart): PublicExercisePart {
    const items = [...(part.items ?? [])].sort((a, b) => a.order - b.order);
    return {
      id: part.id,
      partNumber: part.partNumber,
      category: part.category,
      items: items.map((item) => this.toPublicItem(item)),
      hasSolution: !!part.solution,
    };
  }

  private toPublicSummary(exercise: Exercise): PublicExerciseSummary {
    return {
      id: exercise.id,
      title: exercise.title ?? null,
      description: exercise.description ?? null,
      level: exercise.level ?? null,
      difficulty: exercise.difficulty ?? null,
      theme: exercise.theme ?? null,
      competencies: exercise.competencies ?? null,
      tags: exercise.tags ?? [],
      status: exercise.status,
      authorId: exercise.authorId,
      authorRole: exercise.authorRole,
      shareableLink: exercise.shareableLink ?? null,
      createdAt: exercise.createdAt,
      updatedAt: exercise.updatedAt,
    };
  }

  private toPublicDetail(exercise: Exercise): PublicExerciseDetail {
    const parts = [...(exercise.parts ?? [])].sort((a, b) => a.partNumber - b.partNumber);
    return {
      ...this.toPublicSummary(exercise),
      parts: parts.map((part) => this.toPublicPart(part)),
    };
  }

  // ───────────────────────────────────────────────────────────────────────
  // Sérialisation avec solution — réservée à l'auteur et aux AP/RP/TI
  // (arbitrage du 2026-09-01, "Titre des Exercices et des Quizz", point 6)
  // ───────────────────────────────────────────────────────────────────────

  private toPublicPartWithSolution(part: ExercisePart): PublicExercisePartWithSolution {
    const items = [...(part.items ?? [])].sort((a, b) => a.order - b.order);
    const solutionItems = part.solution
      ? [...(part.solution.items ?? [])].sort((a, b) => a.order - b.order)
      : null;
    return {
      id: part.id,
      partNumber: part.partNumber,
      category: part.category,
      items: items.map((item) => this.toPublicItem(item)),
      solution: solutionItems ? { items: solutionItems.map((item) => this.toPublicItem(item)) } : null,
    };
  }

  private toPublicDetailWithSolutions(exercise: Exercise): PublicExerciseDetailWithSolutions {
    const parts = [...(exercise.parts ?? [])].sort((a, b) => a.partNumber - b.partNumber);
    return {
      ...this.toPublicSummary(exercise),
      parts: parts.map((part) => this.toPublicPartWithSolution(part)),
    };
  }

  // ───────────────────────────────────────────────────────────────────────
  // Validation des blocs à la création/édition
  // ───────────────────────────────────────────────────────────────────────

  private validatePartDto(part: CreateExercisePartDto, index: number): void {
    const position = index + 1;

    if (!Object.values(ExercisePartCategory).includes(part.category)) {
      throw new BadRequestException(`Bloc ${position} : catégorie inconnue`);
    }

    if (!part.items || part.items.length === 0) {
      throw new BadRequestException(`Bloc ${position} : au moins un item de contenu est requis`);
    }

    if (part.category === ExercisePartCategory.QUESTION) {
      if (!part.solution || !part.solution.items || part.solution.items.length === 0) {
        throw new BadRequestException(
          `Bloc ${position} : un bloc question doit porter une solution avec au moins un item de contenu`,
        );
      }
    } else if (part.solution) {
      throw new BadRequestException(`Bloc ${position} : un bloc énoncé ne peut pas porter de solution`);
    }
  }

  private buildItemEntities(
    items: CreateExerciseContentItemDto[],
    ref: { partId?: string; solutionId?: string },
  ): ExerciseContentItem[] {
    return items.map((item, index) =>
      this.exerciseContentItemRepository.create({
        partId: ref.partId ?? null,
        solutionId: ref.solutionId ?? null,
        type: item.type,
        content: item.content,
        order: index,
      }),
    );
  }

  // ───────────────────────────────────────────────────────────────────────
  // Titre — obligatoire et unique par auteur (arbitrage du 2026-09-01)
  // ───────────────────────────────────────────────────────────────────────

  /**
   * Refuse (400) si l'auteur possède déjà un autre exercice portant
   * exactement ce titre. Unicité *par auteur*, pas globale — deux
   * formateurs différents peuvent légitimement choisir le même titre
   * chacun de leur côté. `REMOVED` est exclu : un exercice retiré ne bloque
   * pas la réutilisation de son titre.
   */
  private async assertTitleUnique(title: string, authorId: string, excludeExerciseId?: string): Promise<void> {
    // `.andWhere()` seul (sans `.where()` préalable) — même convention que
    // `search()` plus bas dans ce service, compatible avec les mocks de test
    // qui n'exposent que `andWhere`.
    const qb = this.exerciseRepository
      .createQueryBuilder('exercise')
      .andWhere('exercise.authorId = :authorId', { authorId })
      .andWhere('exercise.title = :title', { title })
      .andWhere('exercise.status != :removed', { removed: ContentStatus.REMOVED });

    if (excludeExerciseId) {
      qb.andWhere('exercise.id != :excludeExerciseId', { excludeExerciseId });
    }

    const existing = await qb.getOne();
    if (existing) {
      throw new BadRequestException(`Vous avez déjà un exercice intitulé "${title}"`);
    }
  }

  /**
   * Suggestion de titre par défaut ("Exercice {n}"), lue par le front à
   * l'ouverture du formulaire de création — ne réserve rien, juste une
   * proposition modifiable avant validation (arbitrage du 2026-09-01).
   */
  async getDefaultTitle(authorId: string): Promise<{ title: string }> {
    const count = await this.exerciseRepository.count({ where: { authorId } });
    return { title: `Exercice ${count + 1}` };
  }

  // ───────────────────────────────────────────────────────────────────────
  // Création
  // ───────────────────────────────────────────────────────────────────────

  async create(createExerciseDto: CreateExerciseDto, authorId: string, authorRole: string): Promise<PublicExerciseDetail> {
    if (!EXERCISE_CREATOR_ROLES.includes(authorRole as UserRole)) {
      throw new ForbiddenException('Seuls les formateurs, AP et RP peuvent créer un exercice');
    }

    if (!createExerciseDto.title || !createExerciseDto.title.trim()) {
      throw new BadRequestException('Le titre de l\'exercice est obligatoire');
    }
    await this.assertTitleUnique(createExerciseDto.title, authorId);

    if (!createExerciseDto.parts || createExerciseDto.parts.length === 0) {
      throw new BadRequestException('Un exercice doit contenir au moins un bloc');
    }
    createExerciseDto.parts.forEach((part, index) => this.validatePartDto(part, index));

    // Statut fixé à la création selon le rôle, aligné sur le Quizz (2026-08-28) :
    // pending_validation pour un formateur, validated immédiatement pour AP/RP.
    const status =
      authorRole === UserRole.FORMATEUR ? ContentStatus.PENDING_VALIDATION : ContentStatus.VALIDATED;

    const exercise = this.exerciseRepository.create({
      title: createExerciseDto.title,
      description: createExerciseDto.description,
      level: createExerciseDto.level,
      difficulty: createExerciseDto.difficulty,
      theme: createExerciseDto.theme,
      competencies: createExerciseDto.competencies,
      tags: createExerciseDto.tags ?? [],
      authorId,
      authorRole,
      status,
      shareableLink: null,
    });
    const savedExercise = await this.exerciseRepository.save(exercise);

    await this.savePartsAndSolutions(savedExercise.id, createExerciseDto.parts, authorId, authorRole);

    savedExercise.shareableLink = `/exercises/${savedExercise.id}`;
    await this.exerciseRepository.save(savedExercise);

    return this.findOne(savedExercise.id, authorId, authorRole);
  }

  private async savePartsAndSolutions(
    exerciseId: string,
    parts: CreateExercisePartDto[],
    authorId: string,
    authorRole: string,
  ): Promise<void> {
    for (let index = 0; index < parts.length; index += 1) {
      const partDto = parts[index];
      const part = this.exercisePartRepository.create({
        exerciseId,
        partNumber: index + 1,
        category: partDto.category,
      });
      const savedPart = await this.exercisePartRepository.save(part);

      const itemEntities = this.buildItemEntities(partDto.items, { partId: savedPart.id });
      await this.exerciseContentItemRepository.save(itemEntities);

      if (partDto.category === ExercisePartCategory.QUESTION && partDto.solution) {
        const solution = this.exerciseSolutionRepository.create({
          exerciseId,
          partId: savedPart.id,
          authorId,
          authorRole,
        });
        const savedSolution = await this.exerciseSolutionRepository.save(solution);

        const solutionItems = this.buildItemEntities(partDto.solution.items, { solutionId: savedSolution.id });
        await this.exerciseContentItemRepository.save(solutionItems);
      }
    }
  }

  // ───────────────────────────────────────────────────────────────────────
  // Édition — réservée à l'auteur, aligné sur le Quizz (2026-08-28)
  // ───────────────────────────────────────────────────────────────────────

  /**
   * Remplace intégralement les blocs, items et solutions d'un exercice.
   *
   * LIMITE CONNUE, documentée et assumée faute de temps pour un diff par
   * identifiant stable côté client (même absence d'identité stable que les
   * questions du Quizz) : les IMAGES précédemment envoyées sur les blocs ou
   * solutions de cet exercice sont supprimées avec le reste (fichiers sur le
   * volume dédié inclus, pour ne jamais laisser de fichier orphelin) — elles
   * doivent être renvoyées après l'édition si elles doivent être conservées.
   * Le DTO JSON ne transporte de toute façon que des items texte/formule
   * (`CreateExerciseContentItemDto` exclut `image`), donc un remplacement
   * complet ne peut de toute façon jamais réintroduire une image existante
   * sans passer par les routes multipart dédiées, après l'édition.
   */
  async update(
    exerciseId: string,
    updateExerciseDto: UpdateExerciseDto,
    callerId: string,
    callerRole: string,
  ): Promise<PublicExerciseDetail> {
    const exercise = await this.exerciseRepository.findOne({ where: { id: exerciseId } });
    if (!exercise) {
      throw new NotFoundException(`Exercice ${exerciseId} introuvable`);
    }
    if (exercise.authorId !== callerId) {
      throw new ForbiddenException("Seul l'auteur peut modifier cet exercice");
    }

    if (!updateExerciseDto.title || !updateExerciseDto.title.trim()) {
      throw new BadRequestException('Le titre de l\'exercice est obligatoire');
    }
    await this.assertTitleUnique(updateExerciseDto.title, exercise.authorId, exerciseId);

    if (!updateExerciseDto.parts || updateExerciseDto.parts.length === 0) {
      throw new BadRequestException('Un exercice doit contenir au moins un bloc');
    }
    updateExerciseDto.parts.forEach((part, index) => this.validatePartDto(part, index));

    await this.deleteImagesForExercise(exerciseId);

    exercise.title = updateExerciseDto.title;
    exercise.description = updateExerciseDto.description;
    exercise.level = updateExerciseDto.level;
    exercise.difficulty = updateExerciseDto.difficulty;
    exercise.theme = updateExerciseDto.theme;
    exercise.competencies = updateExerciseDto.competencies;
    exercise.tags = updateExerciseDto.tags ?? [];

    // Effet sur le statut (aligné sur le Quizz, 2026-08-28) : un auteur
    // formateur repasse systématiquement en revue ; un auteur AP/RP ne
    // change jamais de statut (déjà son propre validateur).
    if (exercise.authorRole === UserRole.FORMATEUR) {
      exercise.status = ContentStatus.PENDING_VALIDATION;
    }

    // Suppression intégrale des blocs — la cascade DB retire aussi les
    // solutions et tous les items (ON DELETE CASCADE sur les FK).
    await this.exercisePartRepository.delete({ exerciseId });

    await this.savePartsAndSolutions(exerciseId, updateExerciseDto.parts, exercise.authorId, exercise.authorRole);

    await this.exerciseRepository.save(exercise);

    return this.findOne(exerciseId, callerId, callerRole);
  }

  /** Supprime du volume les fichiers des images déjà attachées à cet exercice, avant un remplacement intégral. */
  private async deleteImagesForExercise(exerciseId: string): Promise<void> {
    const parts = await this.exercisePartRepository.find({ where: { exerciseId }, relations: ['items'] });
    const solutions = await this.exerciseSolutionRepository.find({ where: { exerciseId }, relations: ['items'] });

    const storedFilenames = [
      ...parts.flatMap((part) => part.items ?? []),
      ...solutions.flatMap((solution) => solution.items ?? []),
    ]
      .filter((item) => item.type === 'image' && item.imageStoredFilename)
      .map((item) => item.imageStoredFilename as string);

    await Promise.all(storedFilenames.map((filename) => this.imageStorage.delete(filename)));
  }

  // ───────────────────────────────────────────────────────────────────────
  // Lecture / recherche
  // ───────────────────────────────────────────────────────────────────────

  async search(
    searchParams: SearchExerciseDto,
    callerId: string,
    callerRole: string,
  ): Promise<{ items: PublicExerciseSummary[]; total: number }> {
    const page = searchParams.page ?? 1;
    const limit = searchParams.limit ?? 20;
    const skip = (page - 1) * limit;

    const qb = this.exerciseRepository.createQueryBuilder('exercise');

    if (!this.isAdminRole(callerRole)) {
      // Un exercice non validé reste invisible aux autres, sauf à son auteur
      // — aligné sur le Quizz (2026-08-28), remplace l'ancienne restriction
      // limitée aux seuls élèves/parents.
      qb.andWhere('(exercise.status = :validated OR exercise.authorId = :callerId)', {
        validated: ContentStatus.VALIDATED,
        callerId,
      });
    }

    if (searchParams.level) qb.andWhere('exercise.level = :level', { level: searchParams.level });
    if (searchParams.difficulty) qb.andWhere('exercise.difficulty = :difficulty', { difficulty: searchParams.difficulty });
    if (searchParams.theme) qb.andWhere('exercise.theme = :theme', { theme: searchParams.theme });
    if (searchParams.authorId) qb.andWhere('exercise.authorId = :authorId', { authorId: searchParams.authorId });

    if (searchParams.tag) {
      qb.andWhere(':tag = ANY(exercise.tags)', { tag: searchParams.tag });
    }

    if (searchParams.keyword) {
      qb.andWhere('exercise.title ILIKE :keyword', { keyword: `%${searchParams.keyword}%` });
    }

    qb.orderBy('exercise.createdAt', 'DESC').skip(skip).take(limit);

    const [items, total] = await qb.getManyAndCount();

    return { items: items.map((exercise) => this.toPublicSummary(exercise)), total };
  }

  async findOne(exerciseId: string, callerId: string, callerRole: string): Promise<PublicExerciseDetail> {
    const exercise = await this.exerciseRepository.findOne({
      where: { id: exerciseId },
      relations: ['parts', 'parts.items', 'parts.solution'],
    });
    if (!exercise) {
      throw new NotFoundException(`Exercice ${exerciseId} introuvable`);
    }

    const isOwner = exercise.authorId === callerId;
    if (exercise.status !== ContentStatus.VALIDATED && !isOwner && !this.isAdminRole(callerRole)) {
      // Un exercice non validé n'existe pas pour qui n'a pas le droit de le voir
      throw new NotFoundException(`Exercice ${exerciseId} introuvable`);
    }

    return this.toPublicDetail(exercise);
  }

  /**
   * Détail complet de l'exercice AVEC le contenu de chaque solution —
   * réservé à l'auteur et aux AP/RP/TI (arbitrage du 2026-09-01, point 6).
   * `GET /exercises/:id` reste inchangée et ne renvoie jamais cette forme :
   * c'est un point d'accès distinct, motivé par l'édition qui a besoin de
   * pré-remplir les solutions sans que l'auteur les ressaisisse — même
   * raisonnement que `QuizzesService.findOneWithSolution` (2026-08-28).
   */
  async findOneWithSolutions(
    exerciseId: string,
    callerId: string,
    callerRole: string,
  ): Promise<PublicExerciseDetailWithSolutions> {
    const exercise = await this.exerciseRepository.findOne({
      where: { id: exerciseId },
      relations: ['parts', 'parts.items', 'parts.solution', 'parts.solution.items'],
    });
    if (!exercise) {
      throw new NotFoundException(`Exercice ${exerciseId} introuvable`);
    }

    const isOwner = exercise.authorId === callerId;
    if (!isOwner && !this.isAdminRole(callerRole)) {
      throw new ForbiddenException(
        "Seul l'auteur de l'exercice ou un AP/RP/TI peut consulter ses solutions",
      );
    }

    return this.toPublicDetailWithSolutions(exercise);
  }

  async getPendingValidation(
    callerId: string,
    callerRole: string,
    page = 1,
    limit = 20,
  ): Promise<{ items: PublicExerciseSummary[]; total: number }> {
    if (!VALIDATOR_ROLES.includes(callerRole as UserRole)) {
      throw new ForbiddenException('Seuls les AP et RP peuvent consulter les exercices en attente de validation');
    }

    // Un AP ne voit que les exercices des formateurs qu'il anime — même
    // mécanisme que le Quizz (2026-08-28), réutilisé sans le redévelopper.
    if (callerRole === UserRole.ANIMATEUR_PEDAGOGIQUE) {
      const allPending = await this.exerciseRepository.find({
        where: { status: ContentStatus.PENDING_VALIDATION },
        order: { createdAt: 'ASC' },
      });

      const authorIds = [...new Set(allPending.map((exercise) => exercise.authorId))];
      const allowedAuthorIds = new Set<string>();
      await Promise.all(
        authorIds.map(async (authorId) => {
          const hasRelation = await this.profileRelationsClient.hasAnimatorOfTeacherRelation(callerId, authorId);
          if (hasRelation) {
            allowedAuthorIds.add(authorId);
          }
        }),
      );

      const scoped = allPending.filter((exercise) => allowedAuthorIds.has(exercise.authorId));
      const total = scoped.length;
      const skip = (page - 1) * limit;
      const items = scoped.slice(skip, skip + limit);

      return { items: items.map((exercise) => this.toPublicSummary(exercise)), total };
    }

    const skip = (page - 1) * limit;
    const [items, total] = await this.exerciseRepository.findAndCount({
      where: { status: ContentStatus.PENDING_VALIDATION },
      order: { createdAt: 'ASC' },
      skip,
      take: limit,
    });

    return { items: items.map((exercise) => this.toPublicSummary(exercise)), total };
  }

  async removeExercise(exerciseId: string, requesterId: string, callerRole: string): Promise<void> {
    const exercise = await this.exerciseRepository.findOne({ where: { id: exerciseId } });
    if (!exercise) {
      throw new NotFoundException(`Exercice ${exerciseId} introuvable`);
    }

    const canRemove =
      callerRole === UserRole.RESPONSABLE_PEDAGOGIQUE ||
      callerRole === UserRole.TECHNICIEN_INFORMATIQUE ||
      exercise.authorId === requesterId;

    if (!canRemove) {
      throw new ForbiddenException("Vous n'avez pas le droit de retirer cet exercice");
    }

    exercise.status = ContentStatus.REMOVED;
    await this.exerciseRepository.save(exercise);
  }

  // ───────────────────────────────────────────────────────────────────────
  // Images — blocs (publiques, sous réserve de visibilité) et solutions
  // (jamais publiques, voir InternalExercisesController)
  // ───────────────────────────────────────────────────────────────────────

  /** Vérifie que l'appelant est l'auteur de l'exercice, et que le bloc existe. Fait repasser l'exercice en revue si l'auteur est formateur. */
  private async assertPartOwnership(exerciseId: string, partId: string, callerId: string): Promise<{ exercise: Exercise; part: ExercisePart }> {
    const exercise = await this.exerciseRepository.findOne({ where: { id: exerciseId } });
    if (!exercise) {
      throw new NotFoundException(`Exercice ${exerciseId} introuvable`);
    }
    if (exercise.authorId !== callerId) {
      throw new ForbiddenException("Seul l'auteur peut modifier cet exercice");
    }

    const part = await this.exercisePartRepository.findOne({ where: { id: partId, exerciseId } });
    if (!part) {
      throw new NotFoundException(`Bloc ${partId} introuvable`);
    }

    // Ajouter une image modifie le contenu : un auteur formateur repasse en
    // revue, même règle que update() (2026-08-28, alignement Quizz).
    if (exercise.authorRole === UserRole.FORMATEUR && exercise.status !== ContentStatus.PENDING_VALIDATION) {
      exercise.status = ContentStatus.PENDING_VALIDATION;
      await this.exerciseRepository.save(exercise);
    }

    return { exercise, part };
  }

  private async transcodeUploadedImage(file: Express.Multer.File | undefined) {
    if (!file) {
      throw new BadRequestException('Aucun fichier envoyé');
    }
    if (file.size > EXERCISE_IMAGE_MAX_BYTES * 8) {
      // Garde-fou grossier avant décodage — le plafond réel porte sur la
      // SORTIE ré-encodée (voir plus bas), le fichier d'entrée peut être plus
      // lourd avant compression WebP.
      throw new PayloadTooLargeException({
        statusCode: 413,
        error: 'Payload Too Large',
        code: 'EXERCISE_IMAGE_TOO_LARGE',
        message: 'Le fichier envoyé est trop volumineux',
        receivedBytes: file.size,
      });
    }

    const transcoded = await this.imageTranscoder.transcode(file.buffer);
    if (transcoded.bytes.length > EXERCISE_IMAGE_MAX_BYTES) {
      throw new PayloadTooLargeException({
        statusCode: 413,
        error: 'Payload Too Large',
        code: 'EXERCISE_IMAGE_TOO_LARGE',
        message: "L'image ré-encodée dépasse la taille maximale autorisée",
        maxUploadBytes: EXERCISE_IMAGE_MAX_BYTES,
        receivedBytes: transcoded.bytes.length,
      });
    }

    return transcoded;
  }

  async addImageToPart(
    exerciseId: string,
    partId: string,
    file: Express.Multer.File | undefined,
    dto: CreateExerciseImageDto,
    callerId: string,
  ): Promise<PublicContentItem> {
    await this.assertPartOwnership(exerciseId, partId, callerId);
    const transcoded = await this.transcodeUploadedImage(file);
    const storedFilename = await this.imageStorage.save(transcoded.bytes);

    const item = await this.appendImageItem(
      { partId },
      storedFilename,
      file.originalname,
      transcoded.contentType,
      transcoded.bytes.length,
      dto.caption,
    );
    return this.toPublicItem(item);
  }

  async addImageToSolution(
    exerciseId: string,
    partId: string,
    file: Express.Multer.File | undefined,
    dto: CreateExerciseImageDto,
    callerId: string,
  ): Promise<PublicContentItem> {
    const { part } = await this.assertPartOwnership(exerciseId, partId, callerId);
    if (part.category !== ExercisePartCategory.QUESTION) {
      throw new BadRequestException('Seul un bloc question porte une solution');
    }
    const solution = await this.exerciseSolutionRepository.findOne({ where: { partId } });
    if (!solution) {
      throw new NotFoundException(`Solution du bloc ${partId} introuvable`);
    }

    const transcoded = await this.transcodeUploadedImage(file);
    const storedFilename = await this.imageStorage.save(transcoded.bytes);

    const item = await this.appendImageItem(
      { solutionId: solution.id },
      storedFilename,
      file.originalname,
      transcoded.contentType,
      transcoded.bytes.length,
      dto.caption,
    );
    return this.toPublicItem(item);
  }

  private async appendImageItem(
    ref: { partId?: string; solutionId?: string },
    storedFilename: string,
    originalFilename: string,
    mimeType: string,
    sizeBytes: number,
    caption: string | undefined,
  ): Promise<ExerciseContentItem> {
    const existing = await this.exerciseContentItemRepository.find({ where: ref });
    const nextOrder = existing.reduce((max, item) => Math.max(max, item.order), -1) + 1;

    const item = this.exerciseContentItemRepository.create({
      partId: ref.partId ?? null,
      solutionId: ref.solutionId ?? null,
      type: 'image',
      content: caption ?? null,
      imageOriginalFilename: originalFilename,
      imageStoredFilename: storedFilename,
      imageMimeType: mimeType,
      imageSizeBytes: sizeBytes,
      order: nextOrder,
    });
    return this.exerciseContentItemRepository.save(item);
  }

  /**
   * Octets d'une image publique (bloc uniquement, jamais une solution) —
   * revérifie la visibilité de l'exercice parent à chaque téléchargement.
   */
  async getPartImageForDownload(
    exerciseId: string,
    itemId: string,
    callerId: string,
    callerRole: string,
  ): Promise<{ item: ExerciseContentItem; buffer: Buffer }> {
    // Réapplique la même règle de visibilité que findOne().
    await this.findOne(exerciseId, callerId, callerRole);

    const item = await this.exerciseContentItemRepository.findOne({ where: { id: itemId } });
    if (!item || item.type !== 'image' || !item.imageStoredFilename || !item.partId) {
      // item.partId absent → l'image appartient à une solution : jamais
      // servie par cette route publique (même comportement qu'introuvable).
      throw new NotFoundException('Image introuvable');
    }
    const part = await this.exercisePartRepository.findOne({ where: { id: item.partId, exerciseId } });
    if (!part) {
      throw new NotFoundException('Image introuvable');
    }

    const buffer = await this.imageStorage.read(item.imageStoredFilename);
    return { item, buffer };
  }

  /** Octets de n'importe quelle image (bloc ou solution) — réservé à l'appel interne, aucune visibilité vérifiée ici. */
  async getImageForInternalDownload(itemId: string): Promise<{ item: ExerciseContentItem; buffer: Buffer }> {
    const item = await this.exerciseContentItemRepository.findOne({ where: { id: itemId } });
    if (!item || item.type !== 'image' || !item.imageStoredFilename) {
      throw new NotFoundException('Image introuvable');
    }
    const buffer = await this.imageStorage.read(item.imageStoredFilename);
    return { item, buffer };
  }

  // ───────────────────────────────────────────────────────────────────────
  // Route interne — solution d'un bloc question, jamais exposée au front
  // ───────────────────────────────────────────────────────────────────────

  async getSolutionContentForInternal(exerciseId: string, partId: string): Promise<PublicContentItem[]> {
    const part = await this.exercisePartRepository.findOne({ where: { id: partId, exerciseId } });
    if (!part) {
      throw new NotFoundException(`Bloc ${partId} introuvable`);
    }

    const solution = await this.exerciseSolutionRepository.findOne({
      where: { partId },
      relations: ['items'],
    });
    if (!solution) {
      throw new NotFoundException(`Solution du bloc ${partId} introuvable`);
    }

    const items = [...(solution.items ?? [])].sort((a, b) => a.order - b.order);
    return items.map((item) => this.toPublicItem(item));
  }
}
