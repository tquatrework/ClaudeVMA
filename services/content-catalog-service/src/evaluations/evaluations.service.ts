import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Evaluation, EvaluationScoring } from './entities/evaluation.entity';
import { CreateEvaluationDto } from './dto/create-evaluation.dto';
import { UpdateEvaluationDto } from './dto/update-evaluation.dto';
import { SearchEvaluationDto } from './dto/search-evaluation.dto';
import { ContentStatus } from '../common/enums/content-status.enum';
import { UserRole } from '../common/enums/user-role.enum';
import { EvaluationScoringMode } from './enums/evaluation-scoring-mode.enum';
import { ExercisePart } from '../exercises/entities/exercise-part.entity';
import { ExercisePartCategory } from '../exercises/enums/exercise-part-category.enum';

/** Rôles autorisés à créer/éditer une évaluation — mêmes rôles que Quizz/Exercice. */
export const EVALUATION_CREATOR_ROLES = [
  UserRole.FORMATEUR,
  UserRole.ANIMATEUR_PEDAGOGIQUE,
  UserRole.RESPONSABLE_PEDAGOGIQUE,
];

@Injectable()
export class EvaluationsService {
  constructor(
    @InjectRepository(Evaluation)
    private readonly evaluationRepository: Repository<Evaluation>,

    @InjectRepository(ExercisePart)
    private readonly exercisePartRepository: Repository<ExercisePart>,
  ) {}

  // ───────────────────────────────────────────────────────────────────────
  // Barème informatif (arbitrage du 2026-09-02) — validation complète,
  // jamais d'acceptation silencieuse d'une entrée mal formée ou orpheline.
  // ───────────────────────────────────────────────────────────────────────

  private async validateScoring(
    scoring: EvaluationScoring | undefined,
    exerciseItems: { exerciseId: string }[],
  ): Promise<void> {
    if (!scoring) return;

    const referencedExerciseIds = new Set(exerciseItems.map((item) => item.exerciseId));

    if (scoring.mode === EvaluationScoringMode.PER_EXERCISE) {
      const seen = new Set<string>();
      for (const entry of scoring.entries) {
        if (entry.partId) {
          throw new BadRequestException(
            "Le barème par exercice ne doit pas référencer de bloc question (partId)",
          );
        }
        if (!referencedExerciseIds.has(entry.exerciseId)) {
          throw new BadRequestException(
            `Le barème référence l'exercice ${entry.exerciseId}, absent de la suite de l'évaluation`,
          );
        }
        if (seen.has(entry.exerciseId)) {
          throw new BadRequestException(
            `Le barème par exercice ne peut porter qu'une seule valeur par exercice (doublon sur ${entry.exerciseId})`,
          );
        }
        seen.add(entry.exerciseId);
      }
      return;
    }

    // PER_QUESTION : chaque entrée doit référencer un bloc "question" réel,
    // appartenant bien à l'exercice déclaré sur la même entrée.
    const partIds = scoring.entries.map((entry) => entry.partId).filter((id): id is string => !!id);

    if (partIds.length !== scoring.entries.length) {
      throw new BadRequestException(
        'Le barème par question exige un partId (identifiant du bloc question) sur chaque entrée',
      );
    }

    const parts = partIds.length
      ? await this.exercisePartRepository.find({ where: { id: In(partIds) } })
      : [];
    const partsById = new Map(parts.map((part) => [part.id, part]));

    const seen = new Set<string>();
    for (const entry of scoring.entries) {
      if (!referencedExerciseIds.has(entry.exerciseId)) {
        throw new BadRequestException(
          `Le barème référence l'exercice ${entry.exerciseId}, absent de la suite de l'évaluation`,
        );
      }

      const part = partsById.get(entry.partId as string);
      if (!part) {
        throw new BadRequestException(`Le bloc question ${entry.partId} est introuvable`);
      }
      if (part.exerciseId !== entry.exerciseId) {
        throw new BadRequestException(
          `Le bloc question ${entry.partId} n'appartient pas à l'exercice ${entry.exerciseId}`,
        );
      }
      if (part.category !== ExercisePartCategory.QUESTION) {
        throw new BadRequestException(
          `Le bloc ${entry.partId} n'est pas un bloc question, il ne peut pas porter de barème`,
        );
      }

      const dedupeKey = `${entry.exerciseId}:${entry.partId}`;
      if (seen.has(dedupeKey)) {
        throw new BadRequestException(
          `Le barème par question ne peut porter qu'une seule valeur par bloc question (doublon sur ${entry.partId})`,
        );
      }
      seen.add(dedupeKey);
    }
  }

  async search(
    searchParams: SearchEvaluationDto,
    callerRole: string,
  ): Promise<{ items: Evaluation[]; total: number }> {
    const page = searchParams.page ?? 1;
    const limit = searchParams.limit ?? 20;
    const skip = (page - 1) * limit;

    const qb = this.evaluationRepository.createQueryBuilder('evaluation');

    if (callerRole === UserRole.PARENT_FINANCEUR || callerRole === UserRole.ELEVE) {
      qb.andWhere('evaluation.status = :validated', { validated: ContentStatus.VALIDATED });
    }

    if (searchParams.level) qb.andWhere('evaluation.level = :level', { level: searchParams.level });
    if (searchParams.difficulty) {
      qb.andWhere('evaluation.difficulty = :difficulty', { difficulty: searchParams.difficulty });
    }
    if (searchParams.theme) qb.andWhere('evaluation.theme = :theme', { theme: searchParams.theme });

    // Corrige le gap de recherche par tag/mot-clé (arbitrage du 2026-09-01,
    // "Refonte des Evaluations", point 1) — SearchEvaluationDto exposait déjà
    // ces deux champs, jamais appliqués. Même correctif que celui déjà fait
    // pour l'Exercice le 2026-08-29 (ANY(tags) sur une colonne text[]
    // native — voir la migration ConvertEvaluationTagsToNativeArray).
    if (searchParams.tag) {
      qb.andWhere(':tag = ANY(evaluation.tags)', { tag: searchParams.tag });
    }
    if (searchParams.keyword) {
      qb.andWhere('evaluation.title ILIKE :keyword', { keyword: `%${searchParams.keyword}%` });
    }

    qb.orderBy('evaluation.createdAt', 'DESC').skip(skip).take(limit);

    const [items, total] = await qb.getManyAndCount();

    return { items, total };
  }

  async create(
    createEvaluationDto: CreateEvaluationDto,
    authorId: string,
    authorRole: string,
  ): Promise<Evaluation> {
    if (!EVALUATION_CREATOR_ROLES.includes(authorRole as UserRole)) {
      throw new ForbiddenException('Seuls les formateurs et rôles pédagogiques peuvent créer des évaluations');
    }

    if (!createEvaluationDto.exerciseItems || createEvaluationDto.exerciseItems.length === 0) {
      throw new BadRequestException('Une évaluation doit contenir au moins un exercice');
    }

    // Durée obligatoire (arbitrage du 2026-09-01, point 7) — refus explicite
    // plutôt qu'une absence silencieuse de chronométrage. Le DTO impose déjà
    // @IsNumber()/@Min(1) sans @IsOptional (donc déjà refusé en amont par le
    // ValidationPipe global si absent/négatif), ce contrôle reste en défense
    // en profondeur avec un message explicite en français.
    if (
      createEvaluationDto.durationSeconds === undefined ||
      createEvaluationDto.durationSeconds === null ||
      createEvaluationDto.durationSeconds <= 0
    ) {
      throw new BadRequestException(
        "La durée de l'évaluation (en secondes) est obligatoire et doit être supérieure à zéro",
      );
    }

    // Barème informatif (arbitrage du 2026-09-02) — validé avant écriture,
    // jamais d'entrée orpheline ou mal formée absorbée en silence.
    await this.validateScoring(createEvaluationDto.scoring, createEvaluationDto.exerciseItems);

    // Statut fixé à la création selon le rôle, aligné sur Quizz (2026-08-28)
    // et Exercice (2026-08-29) : pending_validation pour un formateur,
    // validated immédiatement pour AP/RP — remplace l'ancien DRAFT
    // systématique (arbitrage du 2026-09-01, "Refonte des Evaluations",
    // point 5).
    const status =
      authorRole === UserRole.FORMATEUR ? ContentStatus.PENDING_VALIDATION : ContentStatus.VALIDATED;

    const evaluation = this.evaluationRepository.create({
      ...createEvaluationDto,
      scoring: createEvaluationDto.scoring ?? null,
      authorId,
      authorRole,
      status,
      shareableLink: null,
    });

    const savedEvaluation = await this.evaluationRepository.save(evaluation);
    savedEvaluation.shareableLink = `/evaluations/${savedEvaluation.id}`;
    return this.evaluationRepository.save(savedEvaluation);
  }

  /**
   * PUT /evaluations/:id — réservé à l'auteur, même modèle que
   * `QuizzesService.update()`/`ExercisesService.update()` (2026-08-28/29) :
   * remplacement intégral du contenu (exerciseItems et scoring compris) à
   * chaque édition. Ajoutée le 2026-09-02 avec le barème informatif, aucune
   * route d'édition n'existait jusqu'ici pour l'Évaluation.
   */
  async update(
    evaluationId: string,
    updateEvaluationDto: UpdateEvaluationDto,
    callerId: string,
    callerRole: string,
  ): Promise<Evaluation> {
    const evaluation = await this.evaluationRepository.findOne({ where: { id: evaluationId } });
    if (!evaluation) {
      throw new NotFoundException(`Évaluation ${evaluationId} introuvable`);
    }
    if (evaluation.authorId !== callerId) {
      throw new ForbiddenException('Vous n\'avez pas le droit de modifier cette évaluation');
    }

    if (!updateEvaluationDto.exerciseItems || updateEvaluationDto.exerciseItems.length === 0) {
      throw new BadRequestException('Une évaluation doit contenir au moins un exercice');
    }
    if (
      updateEvaluationDto.durationSeconds === undefined ||
      updateEvaluationDto.durationSeconds === null ||
      updateEvaluationDto.durationSeconds <= 0
    ) {
      throw new BadRequestException(
        "La durée de l'évaluation (en secondes) est obligatoire et doit être supérieure à zéro",
      );
    }

    await this.validateScoring(updateEvaluationDto.scoring, updateEvaluationDto.exerciseItems);

    Object.assign(evaluation, updateEvaluationDto);
    evaluation.scoring = updateEvaluationDto.scoring ?? null;

    // Effet sur le statut — copie exacte de la règle Quizz/Exercice
    // (2026-08-28/29) : un formateur qui édite repasse toujours en
    // pending_validation ; un AP/RP éditant sa propre évaluation ne change
    // jamais de statut, il est déjà son propre validateur.
    if (callerRole === UserRole.FORMATEUR) {
      evaluation.status = ContentStatus.PENDING_VALIDATION;
    }

    return this.evaluationRepository.save(evaluation);
  }

  async findOne(evaluationId: string): Promise<Evaluation> {
    const evaluation = await this.evaluationRepository.findOne({
      where: { id: evaluationId },
    });
    if (!evaluation) {
      throw new NotFoundException(`Évaluation ${evaluationId} introuvable`);
    }
    return evaluation;
  }

  async removeEvaluation(evaluationId: string, requesterId: string, callerRole: string): Promise<void> {
    const evaluation = await this.evaluationRepository.findOne({ where: { id: evaluationId } });
    if (!evaluation) {
      throw new NotFoundException(`Évaluation ${evaluationId} introuvable`);
    }

    const canRemove =
      callerRole === UserRole.RESPONSABLE_PEDAGOGIQUE ||
      callerRole === UserRole.TECHNICIEN_INFORMATIQUE ||
      evaluation.authorId === requesterId;

    if (!canRemove) {
      throw new ForbiddenException('Vous n\'avez pas le droit de retirer cette évaluation');
    }

    evaluation.status = ContentStatus.REMOVED;
    await this.evaluationRepository.save(evaluation);
  }
}
