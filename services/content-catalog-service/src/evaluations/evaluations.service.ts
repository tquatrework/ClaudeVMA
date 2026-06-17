import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { Evaluation } from './entities/evaluation.entity';
import { EvaluationAttempt, AttemptStatus } from './entities/evaluation-attempt.entity';
import { CreateEvaluationDto } from './dto/create-evaluation.dto';
import { SearchEvaluationDto } from './dto/search-evaluation.dto';
import { CreateEvaluationAttemptDto } from './dto/create-evaluation-attempt.dto';
import { ContentStatus } from '../common/enums/content-status.enum';
import { UserRole } from '../common/enums/user-role.enum';

@Injectable()
export class EvaluationsService {
  constructor(
    @InjectRepository(Evaluation)
    private readonly evaluationRepository: Repository<Evaluation>,

    @InjectRepository(EvaluationAttempt)
    private readonly attemptRepository: Repository<EvaluationAttempt>,
  ) {}

  async search(
    searchParams: SearchEvaluationDto,
    callerRole: string,
  ): Promise<{ items: Evaluation[]; total: number }> {
    const page = searchParams.page ?? 1;
    const limit = searchParams.limit ?? 20;
    const skip = (page - 1) * limit;

    const whereClause: FindOptionsWhere<Evaluation> = {};

    if (callerRole === UserRole.PARENT_FINANCEUR || callerRole === UserRole.ELEVE) {
      whereClause.status = ContentStatus.VALIDATED;
    }

    if (searchParams.level) whereClause.level = searchParams.level;
    if (searchParams.difficulty) whereClause.difficulty = searchParams.difficulty;
    if (searchParams.theme) whereClause.theme = searchParams.theme;

    const [items, total] = await this.evaluationRepository.findAndCount({
      where: whereClause,
      skip,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return { items, total };
  }

  async create(
    createEvaluationDto: CreateEvaluationDto,
    authorId: string,
    authorRole: string,
  ): Promise<Evaluation> {
    const allowedUploaderRoles = [
      UserRole.FORMATEUR,
      UserRole.ANIMATEUR_PEDAGOGIQUE,
      UserRole.RESPONSABLE_PEDAGOGIQUE,
    ];
    if (!allowedUploaderRoles.includes(authorRole as UserRole)) {
      throw new ForbiddenException('Seuls les formateurs et rôles pédagogiques peuvent créer des évaluations');
    }

    if (!createEvaluationDto.exerciseItems || createEvaluationDto.exerciseItems.length === 0) {
      throw new BadRequestException('Une évaluation doit contenir au moins un exercice');
    }

    const evaluation = this.evaluationRepository.create({
      ...createEvaluationDto,
      authorId,
      authorRole,
      status: ContentStatus.DRAFT,
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

  async startAttempt(
    evaluationId: string,
    attemptDto: CreateEvaluationAttemptDto,
    studentId: string,
    callerRole: string,
  ): Promise<EvaluationAttempt> {
    if (callerRole !== UserRole.ELEVE) {
      throw new ForbiddenException('Seuls les élèves peuvent passer une évaluation');
    }

    const evaluation = await this.evaluationRepository.findOne({ where: { id: evaluationId } });
    if (!evaluation) {
      throw new NotFoundException(`Évaluation ${evaluationId} introuvable`);
    }
    if (evaluation.status !== ContentStatus.VALIDATED) {
      throw new BadRequestException('Cette évaluation n\'est pas encore disponible');
    }

    // Vérifier s'il y a déjà une tentative en cours
    const existingAttempt = await this.attemptRepository.findOne({
      where: { evaluationId, studentId, status: AttemptStatus.IN_PROGRESS },
    });
    if (existingAttempt) {
      throw new BadRequestException('Une tentative est déjà en cours pour cette évaluation');
    }

    const attempt = this.attemptRepository.create({
      evaluationId,
      studentId,
      status: AttemptStatus.IN_PROGRESS,
      startedAt: new Date(),
    });

    return this.attemptRepository.save(attempt);
  }

  async hasActiveAttempt(studentId: string, evaluationId: string): Promise<boolean> {
    const attempt = await this.attemptRepository.findOne({
      where: { evaluationId, studentId, status: AttemptStatus.IN_PROGRESS },
    });
    return !!attempt;
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
