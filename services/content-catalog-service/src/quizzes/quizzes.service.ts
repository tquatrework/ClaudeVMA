import { randomUUID } from 'crypto';
import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Quiz } from './entities/quiz.entity';
import { QuizQuestion, QuizQuestionOption } from './entities/quiz-question.entity';
import { CreateQuizDto } from './dto/create-quiz.dto';
import { CreateQuizQuestionDto } from './dto/create-quiz-question.dto';
import { SearchQuizDto } from './dto/search-quiz.dto';
import { GradeQuizDto } from './dto/grade-quiz.dto';
import { gradeQuiz, resolveEffectiveScoring, QuizGradeResult } from './quiz-grading.util';
import { QuizQuestionCategory, MultipleChoiceScoringMode, ShortTextScoringMode } from './enums/quiz-question-category.enum';
import { ContentStatus } from '../common/enums/content-status.enum';
import { UserRole } from '../common/enums/user-role.enum';

const CREATOR_ROLES = [
  UserRole.FORMATEUR,
  UserRole.ANIMATEUR_PEDAGOGIQUE,
  UserRole.RESPONSABLE_PEDAGOGIQUE,
];

const ADMIN_ROLES = [
  UserRole.ANIMATEUR_PEDAGOGIQUE,
  UserRole.RESPONSABLE_PEDAGOGIQUE,
  UserRole.TECHNICIEN_INFORMATIQUE,
];

const VALIDATOR_ROLES = [
  UserRole.ANIMATEUR_PEDAGOGIQUE,
  UserRole.RESPONSABLE_PEDAGOGIQUE,
];

/** Forme publique d'un quizz — ne porte jamais correctOptionIds ni keywords. */
export interface PublicQuizSummary {
  id: string;
  title: string;
  description: string | null;
  tags: string[] | null;
  status: ContentStatus;
  authorId: string;
  authorRole: string;
  defaultPoints: number;
  penaltyEnabled: boolean;
  penaltyPoints: number | null;
  shareableLink: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PublicQuizQuestion {
  id: string;
  order: number;
  category: QuizQuestionCategory;
  prompt: string;
  options?: QuizQuestionOption[];
  multipleChoiceScoringMode?: MultipleChoiceScoringMode;
  shortTextScoringMode?: ShortTextScoringMode;
  points: number;
  penaltyEnabled: boolean;
  penaltyPoints?: number;
}

export interface PublicQuizDetail extends PublicQuizSummary {
  questions: PublicQuizQuestion[];
}

@Injectable()
export class QuizzesService {
  constructor(
    @InjectRepository(Quiz)
    private readonly quizRepository: Repository<Quiz>,

    @InjectRepository(QuizQuestion)
    private readonly quizQuestionRepository: Repository<QuizQuestion>,
  ) {}

  private isAdminRole(role: string): boolean {
    return ADMIN_ROLES.includes(role as UserRole);
  }

  // ───────────────────────────────────────────────────────────────────────
  // Sérialisation publique — la solution n'est jamais incluse
  // ───────────────────────────────────────────────────────────────────────

  private toPublicSummary(quiz: Quiz): PublicQuizSummary {
    return {
      id: quiz.id,
      title: quiz.title,
      description: quiz.description ?? null,
      tags: quiz.tags ?? [],
      status: quiz.status,
      authorId: quiz.authorId,
      authorRole: quiz.authorRole,
      defaultPoints: quiz.defaultPoints,
      penaltyEnabled: quiz.penaltyEnabled,
      penaltyPoints: quiz.penaltyPoints ?? null,
      shareableLink: quiz.shareableLink ?? null,
      createdAt: quiz.createdAt,
      updatedAt: quiz.updatedAt,
    };
  }

  private toPublicQuestion(quiz: Quiz, question: QuizQuestion): PublicQuizQuestion {
    const { points, penaltyEnabled, penaltyPoints } = resolveEffectiveScoring(quiz, question);
    return {
      id: question.id,
      order: question.order,
      category: question.category,
      prompt: question.prompt,
      options: question.options ?? undefined,
      multipleChoiceScoringMode: question.multipleChoiceScoringMode ?? undefined,
      shortTextScoringMode: question.shortTextScoringMode ?? undefined,
      points,
      penaltyEnabled,
      penaltyPoints: penaltyEnabled ? penaltyPoints : undefined,
    };
  }

  private toPublicDetail(quiz: Quiz): PublicQuizDetail {
    const questions = [...(quiz.questions ?? [])].sort((a, b) => a.order - b.order);
    return {
      ...this.toPublicSummary(quiz),
      questions: questions.map((question) => this.toPublicQuestion(quiz, question)),
    };
  }

  // ───────────────────────────────────────────────────────────────────────
  // Création
  // ───────────────────────────────────────────────────────────────────────

  private validateQuestionDto(question: CreateQuizQuestionDto, index: number): void {
    const position = index + 1;

    switch (question.category) {
      case QuizQuestionCategory.SINGLE_CHOICE: {
        if (!question.options || question.options.length < 2) {
          throw new BadRequestException(
            `Question ${position} : une question à choix unique doit proposer au moins deux choix`,
          );
        }
        const correctCount = question.options.filter((option) => option.isCorrect).length;
        if (correctCount !== 1) {
          throw new BadRequestException(
            `Question ${position} : une question à choix unique doit avoir exactement une bonne réponse`,
          );
        }
        break;
      }

      case QuizQuestionCategory.MULTIPLE_CHOICE: {
        if (!question.options || question.options.length < 2) {
          throw new BadRequestException(
            `Question ${position} : une question à choix multiples doit proposer au moins deux choix`,
          );
        }
        const correctCount = question.options.filter((option) => option.isCorrect).length;
        if (correctCount < 1) {
          throw new BadRequestException(
            `Question ${position} : une question à choix multiples doit avoir au moins une bonne réponse`,
          );
        }
        break;
      }

      case QuizQuestionCategory.SHORT_TEXT: {
        if (!question.keywords || question.keywords.length === 0) {
          throw new BadRequestException(
            `Question ${position} : une question à texte court doit avoir au moins un mot-clé attendu`,
          );
        }
        break;
      }

      default:
        throw new BadRequestException(`Question ${position} : catégorie de question inconnue`);
    }
  }

  private buildQuestionEntity(question: CreateQuizQuestionDto, index: number, quizId: string): QuizQuestion {
    const isChoiceCategory =
      question.category === QuizQuestionCategory.SINGLE_CHOICE ||
      question.category === QuizQuestionCategory.MULTIPLE_CHOICE;

    let options: QuizQuestionOption[] | null = null;
    let correctOptionIds: string[] | null = null;

    if (isChoiceCategory) {
      const optionsWithIds = question.options.map((option) => ({
        id: option.id ?? randomUUID(),
        text: option.text,
        isCorrect: option.isCorrect,
      }));
      options = optionsWithIds.map(({ id, text }) => ({ id, text }));
      correctOptionIds = optionsWithIds.filter((option) => option.isCorrect).map((option) => option.id);
    }

    return this.quizQuestionRepository.create({
      quizId,
      order: index + 1,
      category: question.category,
      prompt: question.prompt,
      options,
      correctOptionIds,
      keywords: question.category === QuizQuestionCategory.SHORT_TEXT ? question.keywords : null,
      multipleChoiceScoringMode:
        question.category === QuizQuestionCategory.MULTIPLE_CHOICE
          ? question.multipleChoiceScoringMode ?? MultipleChoiceScoringMode.ALL_OR_NOTHING
          : null,
      shortTextScoringMode:
        question.category === QuizQuestionCategory.SHORT_TEXT
          ? question.shortTextScoringMode ?? ShortTextScoringMode.ALL_OR_NOTHING
          : null,
      pointsOverride: question.pointsOverride ?? null,
      penaltyEnabledOverride: question.penaltyEnabledOverride ?? null,
      penaltyPointsOverride: question.penaltyPointsOverride ?? null,
    });
  }

  async create(createQuizDto: CreateQuizDto, authorId: string, authorRole: string): Promise<PublicQuizDetail> {
    if (!CREATOR_ROLES.includes(authorRole as UserRole)) {
      throw new ForbiddenException('Seuls les formateurs, AP et RP peuvent créer un quizz');
    }

    if (!createQuizDto.questions || createQuizDto.questions.length === 0) {
      throw new BadRequestException('Un quizz doit contenir au moins une question');
    }

    createQuizDto.questions.forEach((question, index) => this.validateQuestionDto(question, index));

    // RP/AP auto-validés, professeur soumis à validation (arbitrage du 2026-08-28)
    const status =
      authorRole === UserRole.FORMATEUR ? ContentStatus.PENDING_VALIDATION : ContentStatus.VALIDATED;

    const quiz = this.quizRepository.create({
      title: createQuizDto.title,
      description: createQuizDto.description,
      tags: createQuizDto.tags ?? [],
      authorId,
      authorRole,
      status,
      defaultPoints: createQuizDto.defaultPoints ?? 1,
      penaltyEnabled: createQuizDto.penaltyEnabled ?? false,
      penaltyPoints: createQuizDto.penaltyPoints,
      shareableLink: null,
    });

    const savedQuiz = await this.quizRepository.save(quiz);

    const questionEntities = createQuizDto.questions.map((question, index) =>
      this.buildQuestionEntity(question, index, savedQuiz.id),
    );
    const savedQuestions = await this.quizQuestionRepository.save(questionEntities);

    savedQuiz.shareableLink = `/quizzes/${savedQuiz.id}`;
    await this.quizRepository.save(savedQuiz);
    savedQuiz.questions = savedQuestions;

    return this.toPublicDetail(savedQuiz);
  }

  // ───────────────────────────────────────────────────────────────────────
  // Lecture / recherche
  // ───────────────────────────────────────────────────────────────────────

  async search(
    searchParams: SearchQuizDto,
    callerId: string,
    callerRole: string,
  ): Promise<{ items: PublicQuizSummary[]; total: number }> {
    const page = searchParams.page ?? 1;
    const limit = searchParams.limit ?? 20;
    const skip = (page - 1) * limit;

    const qb = this.quizRepository.createQueryBuilder('quiz');

    if (!this.isAdminRole(callerRole)) {
      // Un quizz non validé reste invisible aux autres, sauf à son auteur
      qb.andWhere('(quiz.status = :validated OR quiz.authorId = :callerId)', {
        validated: ContentStatus.VALIDATED,
        callerId,
      });
    }

    if (searchParams.tag) {
      qb.andWhere(':tag = ANY(quiz.tags)', { tag: searchParams.tag });
    }

    if (searchParams.keyword) {
      qb.andWhere('quiz.title ILIKE :keyword', { keyword: `%${searchParams.keyword}%` });
    }

    qb.orderBy('quiz.createdAt', 'DESC').skip(skip).take(limit);

    const [items, total] = await qb.getManyAndCount();

    return { items: items.map((quiz) => this.toPublicSummary(quiz)), total };
  }

  async findOne(quizId: string, callerId: string, callerRole: string): Promise<PublicQuizDetail> {
    const quiz = await this.quizRepository.findOne({
      where: { id: quizId },
      relations: ['questions'],
    });
    if (!quiz) {
      throw new NotFoundException(`Quizz ${quizId} introuvable`);
    }

    const isOwner = quiz.authorId === callerId;
    if (quiz.status !== ContentStatus.VALIDATED && !isOwner && !this.isAdminRole(callerRole)) {
      // Un quizz non validé n'existe pas pour qui n'a pas le droit de le voir
      throw new NotFoundException(`Quizz ${quizId} introuvable`);
    }

    return this.toPublicDetail(quiz);
  }

  async getPendingValidation(
    callerRole: string,
    page = 1,
    limit = 20,
  ): Promise<{ items: PublicQuizSummary[]; total: number }> {
    if (!VALIDATOR_ROLES.includes(callerRole as UserRole)) {
      throw new ForbiddenException('Seuls les AP et RP peuvent consulter les quizz en attente de validation');
    }

    const skip = (page - 1) * limit;
    const [items, total] = await this.quizRepository.findAndCount({
      where: { status: ContentStatus.PENDING_VALIDATION },
      order: { createdAt: 'ASC' },
      skip,
      take: limit,
    });

    return { items: items.map((quiz) => this.toPublicSummary(quiz)), total };
  }

  // ───────────────────────────────────────────────────────────────────────
  // Notation interne — jamais de solution en clair hors de cette méthode
  // ───────────────────────────────────────────────────────────────────────

  async gradeQuiz(quizId: string, gradeQuizDto: GradeQuizDto): Promise<QuizGradeResult> {
    const quiz = await this.quizRepository.findOne({
      where: { id: quizId },
      relations: ['questions'],
    });
    if (!quiz) {
      throw new NotFoundException(`Quizz ${quizId} introuvable`);
    }

    return gradeQuiz(quiz, gradeQuizDto.answers ?? []);
  }
}
