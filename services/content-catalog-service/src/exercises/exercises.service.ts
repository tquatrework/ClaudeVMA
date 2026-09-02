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
import { ExerciseImageTranscoder, TranscodedExerciseImage } from './exercise-image-transcoder';
import {
  EXERCISE_IMAGE_MAX_BYTES,
  EXERCISE_IMAGE_INPUT_MAX_BYTES,
  EXERCISE_JSON_BODY_MAX_BYTES,
} from './exercise.constants';

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

/**
 * Nom de l'index UNIQUE posé par `AddExerciseQuizTitleUniqueConstraint1795000000000`
 * — voir `exercise.entity.ts`. Utilisé pour ne détecter QUE cette violation
 * précise dans le retry ci-dessous, jamais une autre contrainte UNIQUE sans
 * rapport avec le titre.
 */
const EXERCISE_TITLE_UNIQUE_CONSTRAINT = 'IDX_exercise_author_title_unique';

/**
 * Borne du retry sur violation `23505` de l'index UNIQUE titre (arbitrage du
 * 2026-09-01, "Titre des Exercices et des Quizz : disambiguation automatique
 * plutôt que refus", point 3) — au-delà, on renonce explicitement plutôt que
 * de boucler indéfiniment.
 */
const MAX_TITLE_DISAMBIGUATION_ATTEMPTS = 10;

/**
 * Forme publique d'un item de contenu — jamais le contenu d'une solution
 * hors de la route interne dédiée ou de `GET /exercises/:id/solutions`
 * (auteur/AP/RP/TI). `imageData` (base64) n'est JAMAIS peuplé sur un item de
 * bloc (déjà accessible via `GET /exercises/:id/images/:itemId`) — seulement
 * sur un item de SOLUTION renvoyé par `findOneWithSolutions` (arbitrage du
 * 2026-09-01, point 5 : « l'auteur doit pouvoir revoir une image de solution
 * qu'il a lui-même envoyée, via la même route de lecture d'auteur »).
 */
export interface PublicContentItem {
  id: string;
  type: ExerciseContentItemType;
  order: number;
  content: string | null;
  imageMimeType?: string;
  imageSizeBytes?: number;
  imageData?: string;
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

  /**
   * Droit de lecture élargi pour le validateur d'un exercice non validé
   * (arbitrage du 2026-09-02, "Visibilité du contenu en attente de
   * validation, pour son validateur (RP/AP)") : le RP lit sans restriction,
   * l'AP est scopé par la relation animator_of_teacher — même scoping que
   * la décision de validation (arbitrage du 2026-08-29). Distinct de
   * isAdminRole() (utilisé ailleurs pour search()/getPendingValidation()/
   * findOneWithSolutions(), non touchés par cet arbitrage).
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

  /**
   * Même forme que `toPublicItem`, mais embarque en plus les octets d'une
   * image de SOLUTION en base64 (`imageData`) — jamais pour un item de bloc
   * (déjà téléchargeable via `GET /exercises/:id/images/:itemId`). Corrige
   * le bug "image de solution jamais rerelisible par l'auteur" (arbitrage
   * du 2026-09-01, point 5) en réutilisant cette route de lecture d'auteur
   * plutôt qu'un mécanisme binaire séparé.
   */
  private async toPublicItemWithSolutionData(item: ExerciseContentItem): Promise<PublicContentItem> {
    const base = this.toPublicItem(item);
    if (item.type === 'image' && item.imageStoredFilename) {
      const buffer = await this.imageStorage.read(item.imageStoredFilename);
      return { ...base, imageData: buffer.toString('base64') };
    }
    return base;
  }

  private async toPublicPartWithSolution(part: ExercisePart): Promise<PublicExercisePartWithSolution> {
    const items = [...(part.items ?? [])].sort((a, b) => a.order - b.order);
    let solution: { items: PublicContentItem[] } | null = null;
    if (part.solution) {
      const solutionItems = [...(part.solution.items ?? [])].sort((a, b) => a.order - b.order);
      solution = {
        items: await Promise.all(solutionItems.map((item) => this.toPublicItemWithSolutionData(item))),
      };
    }
    return {
      id: part.id,
      partNumber: part.partNumber,
      category: part.category,
      items: items.map((item) => this.toPublicItem(item)),
      solution,
    };
  }

  private async toPublicDetailWithSolutions(exercise: Exercise): Promise<PublicExerciseDetailWithSolutions> {
    const parts = [...(exercise.parts ?? [])].sort((a, b) => a.partNumber - b.partNumber);
    return {
      ...this.toPublicSummary(exercise),
      parts: await Promise.all(parts.map((part) => this.toPublicPartWithSolution(part))),
    };
  }

  // ───────────────────────────────────────────────────────────────────────
  // Validation des blocs à la création/édition
  // ───────────────────────────────────────────────────────────────────────

  /**
   * Validation par bloc — 3 catégories depuis le 2026-09-01 (docs/architecture.md,
   * "Bloc 'image' de premier niveau pour l'Exercice") :
   *   - `statement` : items texte/formule uniquement, PEUT être vide.
   *   - `image`     : exactement un item, de type `image`. Aucune solution.
   *   - `question`  : items texte/formule non vide + solution obligatoire.
   * Une image ne peut JAMAIS apparaître dans les items d'un bloc
   * `statement`/`question` : elle se dépose dans un bloc `image` dédié
   * (l'ancien mécanisme d'item-image imbriqué est retiré).
   */
  private validatePartDto(part: CreateExercisePartDto, index: number): void {
    const position = index + 1;

    if (!Object.values(ExercisePartCategory).includes(part.category)) {
      throw new BadRequestException(`Bloc ${position} : catégorie inconnue`);
    }

    const items = part.items ?? [];

    if (part.category === ExercisePartCategory.IMAGE) {
      if (items.length !== 1 || items[0].type !== 'image') {
        throw new BadRequestException(`Bloc ${position} : un bloc image doit porter exactement une image`);
      }
      if (part.solution) {
        throw new BadRequestException(`Bloc ${position} : un bloc image ne peut pas porter de solution`);
      }
      return;
    }

    if (items.some((item) => item.type === 'image')) {
      throw new BadRequestException(
        `Bloc ${position} : une image se dépose dans un bloc dédié (catégorie "image"), pas comme item de ce bloc`,
      );
    }

    if (part.category === ExercisePartCategory.QUESTION) {
      if (items.length === 0) {
        throw new BadRequestException(`Bloc ${position} : au moins un item de contenu est requis`);
      }
      if (!part.solution || !part.solution.items || part.solution.items.length === 0) {
        throw new BadRequestException(
          `Bloc ${position} : un bloc question doit porter une solution avec au moins un item de contenu`,
        );
      }
    } else if (part.solution) {
      // STATEMENT
      throw new BadRequestException(`Bloc ${position} : un bloc énoncé ne peut pas porter de solution`);
    }
  }

  /**
   * Contrainte de composition minimale de l'exercice entier (arbitrage du
   * 2026-09-01, point 2) : au moins un bloc `statement` (peut être vide) et
   * au moins un bloc `question` non vide — ce dernier point est déjà garanti
   * structurellement par `validatePartDto` (un bloc `question` porte
   * toujours au moins un item + une solution), il suffit donc de vérifier
   * la PRÉSENCE d'au moins un bloc de chaque catégorie obligatoire.
   */
  private validateExerciseComposition(parts: CreateExercisePartDto[]): void {
    if (!parts.some((part) => part.category === ExercisePartCategory.STATEMENT)) {
      throw new BadRequestException("Un exercice doit comporter au moins un bloc énoncé (il peut être vide)");
    }
    if (!parts.some((part) => part.category === ExercisePartCategory.QUESTION)) {
      throw new BadRequestException('Un exercice doit comporter au moins un bloc question non vide');
    }
  }

  // ───────────────────────────────────────────────────────────────────────
  // Images embarquées en base64 (arbitrage du 2026-09-01) — décodage,
  // garde de taille d'entrée, ré-encodage et stockage.
  // ───────────────────────────────────────────────────────────────────────

  /** Décode `imageData` (base64, avec ou sans préfixe data URI) et vérifie la taille d'entrée avant tout décodage coûteux (ré-encodage sharp). */
  private decodeBase64Image(raw: string | undefined): Buffer {
    if (!raw) {
      throw new BadRequestException("Contenu d'image manquant (imageData requis pour un item de type image)");
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
    if (buffer.length > EXERCISE_IMAGE_INPUT_MAX_BYTES) {
      throw new PayloadTooLargeException({
        statusCode: 413,
        error: 'Payload Too Large',
        code: 'EXERCISE_IMAGE_TOO_LARGE',
        message: 'Le fichier envoyé est trop volumineux',
        maxUploadBytes: EXERCISE_IMAGE_INPUT_MAX_BYTES,
        receivedBytes: buffer.length,
      });
    }
    return buffer;
  }

  /** Ré-encode et vérifie le plafond de SORTIE — même garde que l'ancien mécanisme multipart (2026-08-29), inchangée. */
  private async transcodeAndValidateImage(buffer: Buffer): Promise<TranscodedExerciseImage> {
    const transcoded = await this.imageTranscoder.transcode(buffer);
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

  /**
   * Construit les entités `ExerciseContentItem` d'un bloc ou d'une solution.
   * Pour un item `image`, décode/ré-encode/stocke les octets AVANT de créer
   * l'entité (même mécanisme que le reste de la séquence — un seul appel de
   * sauvegarde, plus de désynchronisation entre texte et image, arbitrage du
   * 2026-09-01 point 6).
   */
  private async buildItemEntities(
    items: CreateExerciseContentItemDto[],
    ref: { partId?: string; solutionId?: string },
  ): Promise<ExerciseContentItem[]> {
    const entities: ExerciseContentItem[] = [];

    for (let index = 0; index < items.length; index += 1) {
      const dto = items[index];

      if (dto.type === 'image') {
        const rawBuffer = this.decodeBase64Image(dto.imageData);
        const transcoded = await this.transcodeAndValidateImage(rawBuffer);
        const storedFilename = await this.imageStorage.save(transcoded.bytes);

        entities.push(
          this.exerciseContentItemRepository.create({
            partId: ref.partId ?? null,
            solutionId: ref.solutionId ?? null,
            type: 'image',
            content: dto.content ?? null,
            imageOriginalFilename: dto.imageOriginalFilename ?? null,
            imageStoredFilename: storedFilename,
            imageMimeType: transcoded.contentType,
            imageSizeBytes: transcoded.bytes.length,
            order: index,
          }),
        );
        continue;
      }

      if (!dto.content || !dto.content.trim()) {
        throw new BadRequestException(`Le contenu d'un item de type "${dto.type}" est requis`);
      }

      entities.push(
        this.exerciseContentItemRepository.create({
          partId: ref.partId ?? null,
          solutionId: ref.solutionId ?? null,
          type: dto.type,
          content: dto.content,
          order: index,
        }),
      );
    }

    return entities;
  }

  // ───────────────────────────────────────────────────────────────────────
  // Titre — obligatoire et unique par auteur, disambiguation automatique
  // (arbitrage du 2026-09-01, "Titre des Exercices et des Quizz :
  // disambiguation automatique plutôt que refus" — révise l'arbitrage du
  // même jour qui refusait la collision en 400)
  // ───────────────────────────────────────────────────────────────────────

  /**
   * `true` si l'auteur possède déjà un autre exercice portant exactement ce
   * titre. Unicité *par auteur*, pas globale — deux formateurs différents
   * peuvent légitimement choisir le même titre chacun de leur côté.
   * `REMOVED` est exclu : un exercice retiré ne bloque pas la réutilisation
   * de son titre.
   */
  private async titleTakenByAuthor(title: string, authorId: string, excludeExerciseId?: string): Promise<boolean> {
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
    return !!existing;
  }

  /**
   * Calcule un titre garanti libre pour cet auteur, en repartant du titre
   * saisi et en ajoutant "(N)" tant qu'une collision existe — plus de rejet
   * 400 sur ce cas. Boucle de vérification exacte plutôt qu'un parsing du
   * suffixe existant : le titre saisi peut déjà contenir des parenthèses non
   * numériques, une boucle reste correcte dans tous les cas.
   */
  private async resolveUniqueTitle(baseTitle: string, authorId: string, excludeExerciseId?: string): Promise<string> {
    let candidate = baseTitle;
    let n = 2;
    while (await this.titleTakenByAuthor(candidate, authorId, excludeExerciseId)) {
      candidate = `${baseTitle} (${n})`;
      n += 1;
    }
    return candidate;
  }

  /**
   * Suggestion de titre par défaut ("Exercice (N)"), lue par le front à
   * l'ouverture du formulaire de création — ne réserve rien, juste une
   * proposition modifiable avant validation. `REMOVED` est exclu du
   * comptage, cohérent avec `titleTakenByAuthor` (un exercice retiré ne
   * bloque pas la réutilisation de son titre, il ne doit donc pas non plus
   * gonfler le numéro proposé).
   */
  async getDefaultTitle(authorId: string): Promise<{ title: string }> {
    const count = await this.exerciseRepository.count({
      where: { authorId, status: Not(ContentStatus.REMOVED) },
    });
    return { title: `Exercice (${count + 1})` };
  }

  /**
   * Insère la ligne racine `Exercise`, avec disambiguation + retry borné sur
   * violation de l'index UNIQUE `(authorId, title)` — ferme la fenêtre de
   * compétition (TOCTOU) entre `resolveUniqueTitle` (un `SELECT`) et
   * l'`INSERT` qui suit. Recalcule un nouveau titre à chaque tentative : la
   * violation signifie qu'un écrivain concurrent a committé entre-temps, et
   * ce commit est désormais visible au prochain `SELECT`.
   *
   * Volontairement limitée à cette seule ligne — n'englobe JAMAIS
   * `savePartsAndSolutions` (appelée par l'appelant, après le retour de
   * cette méthode) : cette cascade ne doit jamais être rejouée, sous peine
   * de dupliquer des blocs/solutions déjà sauvegardés à une tentative
   * précédente.
   */
  private async createExerciseRowWithTitleRetry(
    createExerciseDto: CreateExerciseDto,
    authorId: string,
    authorRole: string,
    status: ContentStatus,
  ): Promise<Exercise> {
    for (let attempt = 1; attempt <= MAX_TITLE_DISAMBIGUATION_ATTEMPTS; attempt += 1) {
      const title = await this.resolveUniqueTitle(createExerciseDto.title, authorId);

      const exercise = this.exerciseRepository.create({
        title,
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

      try {
        return await this.exerciseRepository.save(exercise);
      } catch (err) {
        if (!isPostgresUniqueViolation(err, EXERCISE_TITLE_UNIQUE_CONSTRAINT)) {
          throw err;
        }
        // Collision de dernière seconde : on retente avec un titre recalculé.
      }
    }

    throw new ConflictException('Impossible de trouver un titre disponible pour cet exercice, réessayez');
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

    if (!createExerciseDto.parts || createExerciseDto.parts.length === 0) {
      throw new BadRequestException('Un exercice doit contenir au moins un bloc');
    }
    createExerciseDto.parts.forEach((part, index) => this.validatePartDto(part, index));
    this.validateExerciseComposition(createExerciseDto.parts);

    // Statut fixé à la création selon le rôle, aligné sur le Quizz (2026-08-28) :
    // pending_validation pour un formateur, validated immédiatement pour AP/RP.
    const status =
      authorRole === UserRole.FORMATEUR ? ContentStatus.PENDING_VALIDATION : ContentStatus.VALIDATED;

    const savedExercise = await this.createExerciseRowWithTitleRetry(createExerciseDto, authorId, authorRole, status);

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

      const itemEntities = await this.buildItemEntities(partDto.items ?? [], { partId: savedPart.id });
      if (itemEntities.length > 0) {
        await this.exerciseContentItemRepository.save(itemEntities);
      }

      if (partDto.category === ExercisePartCategory.QUESTION && partDto.solution) {
        const solution = this.exerciseSolutionRepository.create({
          exerciseId,
          partId: savedPart.id,
          authorId,
          authorRole,
        });
        const savedSolution = await this.exerciseSolutionRepository.save(solution);

        const solutionItems = await this.buildItemEntities(partDto.solution.items, { solutionId: savedSolution.id });
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
   * LIMITE CONNUE, assumée faute de diff par identifiant stable côté client
   * (même absence d'identité stable que les questions du Quizz) : les IMAGES
   * précédemment envoyées sur les blocs ou solutions de cet exercice sont
   * supprimées avec le reste (fichiers sur le volume dédié inclus, pour ne
   * jamais laisser de fichier orphelin) à chaque édition. Depuis le
   * 2026-09-01, `CreateExerciseContentItemDto` accepte le type `image`
   * (base64) : une image existante PEUT donc être réintroduite dans le même
   * appel `PUT`, à condition que le front la renvoie explicitement (par
   * exemple en la retéléchargeant via `GET /exercises/:id/images/:itemId` ou
   * `GET /exercises/:id/solutions` puis en la ré-encodant en base64) — ce
   * n'est plus une impossibilité structurelle du DTO comme avant cette date,
   * seulement un renvoi explicite à la charge du front.
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

    if (!updateExerciseDto.parts || updateExerciseDto.parts.length === 0) {
      throw new BadRequestException('Un exercice doit contenir au moins un bloc');
    }
    updateExerciseDto.parts.forEach((part, index) => this.validatePartDto(part, index));
    this.validateExerciseComposition(updateExerciseDto.parts);

    await this.deleteImagesForExercise(exerciseId);

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

    // Écriture de la ligne racine APRÈS la cascade ci-dessus : le retry sur
    // violation de l'index UNIQUE titre (même mécanisme qu'à la création)
    // ne rejoue donc jamais la suppression/recréation des blocs.
    await this.saveExerciseRowWithTitleRetry(exercise, updateExerciseDto.title, exerciseId);

    return this.findOne(exerciseId, callerId, callerRole);
  }

  /**
   * Persiste la ligne racine `Exercise` en édition, avec la même
   * disambiguation + retry borné que `createExerciseRowWithTitleRetry` —
   * appelée après la cascade de blocs/solutions, jamais rejouée en cas de
   * retry (voir `update()`).
   */
  private async saveExerciseRowWithTitleRetry(
    exercise: Exercise,
    baseTitle: string,
    excludeExerciseId: string,
  ): Promise<Exercise> {
    for (let attempt = 1; attempt <= MAX_TITLE_DISAMBIGUATION_ATTEMPTS; attempt += 1) {
      exercise.title = await this.resolveUniqueTitle(baseTitle, exercise.authorId, excludeExerciseId);

      try {
        return await this.exerciseRepository.save(exercise);
      } catch (err) {
        if (!isPostgresUniqueViolation(err, EXERCISE_TITLE_UNIQUE_CONSTRAINT)) {
          throw err;
        }
        // Collision de dernière seconde : on retente avec un titre recalculé.
      }
    }

    throw new ConflictException('Impossible de trouver un titre disponible pour cet exercice, réessayez');
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
    if (exercise.status !== ContentStatus.VALIDATED && !isOwner) {
      const canRead = await this.canReadAsValidator(callerRole, callerId, exercise.authorId);
      if (!canRead) {
        // Un exercice non validé n'existe pas pour qui n'a pas le droit de le voir
        throw new NotFoundException(`Exercice ${exerciseId} introuvable`);
      }
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
  // (jamais publiques, voir InternalExercisesController). Depuis le
  // 2026-09-01, une image se dépose exclusivement à la création/l'édition
  // de l'exercice (base64, voir `buildItemEntities` plus haut) — l'ancien
  // mécanisme d'upload multipart post-création (`addImageToPart`,
  // `addImageToSolution`) est retiré, pas conservé en parallèle. Seule la
  // LECTURE des images (téléchargement des octets) reste ici.
  // ───────────────────────────────────────────────────────────────────────

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

  // ───────────────────────────────────────────────────────────────────────
  // Plafonds d'image — lus par le front avant d'afficher le bouton d'ajout
  // (même discipline que GET /profiles/avatar/constraints,
  // GET /quizzes/import/constraints), jamais codés en dur côté client.
  // ───────────────────────────────────────────────────────────────────────

  getImageConstraints(): {
    maxImageInputBytes: number;
    maxImageOutputBytes: number;
    maxRequestBodyBytes: number;
  } {
    return {
      maxImageInputBytes: EXERCISE_IMAGE_INPUT_MAX_BYTES,
      maxImageOutputBytes: EXERCISE_IMAGE_MAX_BYTES,
      maxRequestBodyBytes: EXERCISE_JSON_BODY_MAX_BYTES,
    };
  }
}
