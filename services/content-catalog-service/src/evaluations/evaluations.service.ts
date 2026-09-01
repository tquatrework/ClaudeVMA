import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Evaluation } from './entities/evaluation.entity';
import { CreateEvaluationDto } from './dto/create-evaluation.dto';
import { SearchEvaluationDto } from './dto/search-evaluation.dto';
import { ContentStatus } from '../common/enums/content-status.enum';
import { UserRole } from '../common/enums/user-role.enum';

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
  ) {}

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

    // Statut fixé à la création selon le rôle, aligné sur Quizz (2026-08-28)
    // et Exercice (2026-08-29) : pending_validation pour un formateur,
    // validated immédiatement pour AP/RP — remplace l'ancien DRAFT
    // systématique (arbitrage du 2026-09-01, "Refonte des Evaluations",
    // point 5).
    const status =
      authorRole === UserRole.FORMATEUR ? ContentStatus.PENDING_VALIDATION : ContentStatus.VALIDATED;

    const evaluation = this.evaluationRepository.create({
      ...createEvaluationDto,
      authorId,
      authorRole,
      status,
      shareableLink: null,
    });

    const savedEvaluation = await this.evaluationRepository.save(evaluation);
    savedEvaluation.shareableLink = `/evaluations/${savedEvaluation.id}`;
    return this.evaluationRepository.save(savedEvaluation);
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
