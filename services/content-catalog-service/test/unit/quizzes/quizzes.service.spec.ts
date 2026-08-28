/**
 * Unit tests — QuizzesService
 *
 * Couvre :
 *   - create()              → rôles autorisés, validation des questions, statut selon le rôle créateur
 *   - search() / findOne()  → la solution n'est jamais exposée, visibilité par statut
 *   - getPendingValidation()→ réservé AP/RP
 *   - gradeQuiz()           → délègue à la notation pure, 404 si introuvable
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { QuizzesService } from '../../../src/quizzes/quizzes.service';
import { Quiz } from '../../../src/quizzes/entities/quiz.entity';
import { QuizQuestion } from '../../../src/quizzes/entities/quiz-question.entity';
import { QuizQuestionCategory } from '../../../src/quizzes/enums/quiz-question-category.enum';
import { ContentStatus } from '../../../src/common/enums/content-status.enum';

const FORMATEUR_ID = 'form-0000-4000-a000-aaaaaaaaaaaa';
const OTHER_FORMATEUR_ID = 'form-0000-4000-a000-bbbbbbbbbbbb';
const RP_ID = 'rp00-0000-4000-b000-bbbbbbbbbbbb';
const ELEVE_ID = 'elev-0000-4000-c000-cccccccccccc';
const QUIZ_ID = 'quiz-0000-4000-d000-dddddddddddd';

function buildMockQuizRepo() {
  const qb = {
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn(),
  };
  return {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    findAndCount: jest.fn(),
    createQueryBuilder: jest.fn(() => qb),
    __qb: qb,
  };
}

function buildMockQuestionRepo() {
  return {
    create: jest.fn((data) => data),
    save: jest.fn((data) => Promise.resolve(data)),
  };
}

function buildSampleQuiz(overrides: Partial<Quiz> = {}): Quiz {
  return {
    id: QUIZ_ID,
    title: 'Quizz test',
    description: null,
    tags: ['algèbre'],
    authorId: FORMATEUR_ID,
    authorRole: 'formateur',
    status: ContentStatus.VALIDATED,
    defaultPoints: 1,
    penaltyEnabled: false,
    penaltyPoints: null,
    shareableLink: '/quizzes/quiz-0000',
    questions: [],
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

function buildSampleQuestion(overrides: Partial<QuizQuestion> = {}): QuizQuestion {
  return {
    id: 'question-0001',
    quizId: QUIZ_ID,
    order: 1,
    category: QuizQuestionCategory.SINGLE_CHOICE,
    prompt: 'Combien font 2+2 ?',
    options: [
      { id: 'opt-a', text: 'Trois' },
      { id: 'opt-b', text: 'Quatre' },
    ],
    correctOptionIds: ['opt-b'],
    keywords: null,
    multipleChoiceScoringMode: null,
    shortTextScoringMode: null,
    pointsOverride: null,
    penaltyEnabledOverride: null,
    penaltyPointsOverride: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as QuizQuestion;
}

describe('QuizzesService', () => {
  let quizzesService: QuizzesService;
  let quizRepo: ReturnType<typeof buildMockQuizRepo>;
  let questionRepo: ReturnType<typeof buildMockQuestionRepo>;

  beforeEach(async () => {
    quizRepo = buildMockQuizRepo();
    questionRepo = buildMockQuestionRepo();

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        QuizzesService,
        { provide: getRepositoryToken(Quiz), useValue: quizRepo },
        { provide: getRepositoryToken(QuizQuestion), useValue: questionRepo },
      ],
    }).compile();

    quizzesService = moduleRef.get<QuizzesService>(QuizzesService);
  });

  afterEach(() => jest.clearAllMocks());

  // ─────────────────────────────────────────────────────────────────────────
  // create()
  // ─────────────────────────────────────────────────────────────────────────

  describe('create()', () => {
    const validDto = {
      title: 'Quizz trimestre 1',
      questions: [
        {
          category: QuizQuestionCategory.SINGLE_CHOICE,
          prompt: 'Combien font 2+2 ?',
          options: [
            { text: 'Trois', isCorrect: false },
            { text: 'Quatre', isCorrect: true },
          ],
        },
      ],
    };

    it('un formateur crée un quizz en attente de validation', async () => {
      const saved = buildSampleQuiz({ authorRole: 'formateur', status: ContentStatus.PENDING_VALIDATION });
      quizRepo.create.mockReturnValue(saved);
      quizRepo.save.mockResolvedValue(saved);

      const result = await quizzesService.create(validDto as any, FORMATEUR_ID, 'formateur');

      expect(result.status).toBe(ContentStatus.PENDING_VALIDATION);
      expect(result).not.toHaveProperty('correctOptionIds');
      expect(result.questions[0]).not.toHaveProperty('correctOptionIds' as any);
    });

    it('un RP crée un quizz auto-validé', async () => {
      const saved = buildSampleQuiz({ authorId: RP_ID, authorRole: 'responsable_pedagogique', status: ContentStatus.VALIDATED });
      quizRepo.create.mockReturnValue(saved);
      quizRepo.save.mockResolvedValue(saved);

      const result = await quizzesService.create(validDto as any, RP_ID, 'responsable_pedagogique');

      expect(result.status).toBe(ContentStatus.VALIDATED);
    });

    it('lève ForbiddenException si un élève tente de créer un quizz', async () => {
      await expect(
        quizzesService.create(validDto as any, ELEVE_ID, 'eleve'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lève BadRequestException si la liste de questions est vide', async () => {
      await expect(
        quizzesService.create({ title: 'Vide', questions: [] } as any, FORMATEUR_ID, 'formateur'),
      ).rejects.toThrow(BadRequestException);
    });

    it('lève BadRequestException pour un choix unique sans bonne réponse', async () => {
      const dto = {
        title: 'Invalide',
        questions: [
          {
            category: QuizQuestionCategory.SINGLE_CHOICE,
            prompt: 'Question ?',
            options: [
              { text: 'A', isCorrect: false },
              { text: 'B', isCorrect: false },
            ],
          },
        ],
      };

      await expect(
        quizzesService.create(dto as any, FORMATEUR_ID, 'formateur'),
      ).rejects.toThrow(BadRequestException);
    });

    it('lève BadRequestException pour un choix unique avec deux bonnes réponses', async () => {
      const dto = {
        title: 'Invalide',
        questions: [
          {
            category: QuizQuestionCategory.SINGLE_CHOICE,
            prompt: 'Question ?',
            options: [
              { text: 'A', isCorrect: true },
              { text: 'B', isCorrect: true },
            ],
          },
        ],
      };

      await expect(
        quizzesService.create(dto as any, FORMATEUR_ID, 'formateur'),
      ).rejects.toThrow(BadRequestException);
    });

    it('lève BadRequestException pour un texte court sans mot-clé', async () => {
      const dto = {
        title: 'Invalide',
        questions: [
          { category: QuizQuestionCategory.SHORT_TEXT, prompt: 'Question ?', keywords: [] },
        ],
      };

      await expect(
        quizzesService.create(dto as any, FORMATEUR_ID, 'formateur'),
      ).rejects.toThrow(BadRequestException);
    });

    it('lève BadRequestException pour un choix multiple sans bonne réponse', async () => {
      const dto = {
        title: 'Invalide',
        questions: [
          {
            category: QuizQuestionCategory.MULTIPLE_CHOICE,
            prompt: 'Question ?',
            options: [
              { text: 'A', isCorrect: false },
              { text: 'B', isCorrect: false },
            ],
          },
        ],
      };

      await expect(
        quizzesService.create(dto as any, FORMATEUR_ID, 'formateur'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // search()
  // ─────────────────────────────────────────────────────────────────────────

  describe('search()', () => {
    it('restreint aux quizz validés (ou propres) pour un élève', async () => {
      quizRepo.__qb.getManyAndCount.mockResolvedValue([[], 0]);

      await quizzesService.search({}, ELEVE_ID, 'eleve');

      expect(quizRepo.__qb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('quiz.status = :validated OR quiz.authorId'),
        expect.objectContaining({ validated: ContentStatus.VALIDATED, callerId: ELEVE_ID }),
      );
    });

    it('ne restreint pas la visibilité pour un RP', async () => {
      quizRepo.__qb.getManyAndCount.mockResolvedValue([[buildSampleQuiz()], 1]);

      const result = await quizzesService.search({}, RP_ID, 'responsable_pedagogique');

      const statusFilterCalls = quizRepo.__qb.andWhere.mock.calls.filter(([clause]) =>
        String(clause).includes('quiz.status = :validated'),
      );
      expect(statusFilterCalls).toHaveLength(0);
      expect(result.total).toBe(1);
    });

    it('filtre par tag quand fourni', async () => {
      quizRepo.__qb.getManyAndCount.mockResolvedValue([[], 0]);

      await quizzesService.search({ tag: 'algèbre' }, FORMATEUR_ID, 'formateur');

      expect(quizRepo.__qb.andWhere).toHaveBeenCalledWith(
        ':tag = ANY(quiz.tags)',
        expect.objectContaining({ tag: 'algèbre' }),
      );
    });

    it('la solution n\'apparaît jamais dans un résultat de recherche', async () => {
      const quizWithQuestions = buildSampleQuiz({ questions: [buildSampleQuestion()] });
      quizRepo.__qb.getManyAndCount.mockResolvedValue([[quizWithQuestions], 1]);

      const result = await quizzesService.search({}, FORMATEUR_ID, 'formateur');

      expect(JSON.stringify(result)).not.toMatch(/correctOptionIds/);
      expect(JSON.stringify(result)).not.toMatch(/keywords/);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // findOne()
  // ─────────────────────────────────────────────────────────────────────────

  describe('findOne()', () => {
    it('retourne un quizz validé sans jamais exposer la solution', async () => {
      const quiz = buildSampleQuiz({ questions: [buildSampleQuestion()] });
      quizRepo.findOne.mockResolvedValue(quiz);

      const result = await quizzesService.findOne(QUIZ_ID, ELEVE_ID, 'eleve');

      expect(result.questions[0].options).toEqual([
        { id: 'opt-a', text: 'Trois' },
        { id: 'opt-b', text: 'Quatre' },
      ]);
      expect(JSON.stringify(result)).not.toMatch(/correctOptionIds/);
    });

    it('lève NotFoundException si le quizz est introuvable', async () => {
      quizRepo.findOne.mockResolvedValue(null);

      await expect(quizzesService.findOne(QUIZ_ID, ELEVE_ID, 'eleve')).rejects.toThrow(NotFoundException);
    });

    it('masque un quizz non validé à un tiers non administrateur (404, jamais 403)', async () => {
      const quiz = buildSampleQuiz({ status: ContentStatus.PENDING_VALIDATION, authorId: FORMATEUR_ID });
      quizRepo.findOne.mockResolvedValue(quiz);

      await expect(
        quizzesService.findOne(QUIZ_ID, OTHER_FORMATEUR_ID, 'formateur'),
      ).rejects.toThrow(NotFoundException);
    });

    it('permet à l\'auteur de voir son propre quizz non validé', async () => {
      const quiz = buildSampleQuiz({ status: ContentStatus.PENDING_VALIDATION, authorId: FORMATEUR_ID });
      quizRepo.findOne.mockResolvedValue(quiz);

      const result = await quizzesService.findOne(QUIZ_ID, FORMATEUR_ID, 'formateur');
      expect(result.id).toBe(QUIZ_ID);
    });

    it('permet à un RP de voir un quizz non validé d\'un tiers', async () => {
      const quiz = buildSampleQuiz({ status: ContentStatus.PENDING_VALIDATION, authorId: FORMATEUR_ID });
      quizRepo.findOne.mockResolvedValue(quiz);

      const result = await quizzesService.findOne(QUIZ_ID, RP_ID, 'responsable_pedagogique');
      expect(result.id).toBe(QUIZ_ID);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // getPendingValidation()
  // ─────────────────────────────────────────────────────────────────────────

  describe('getPendingValidation()', () => {
    it('autorise un RP', async () => {
      quizRepo.findAndCount.mockResolvedValue([[buildSampleQuiz({ status: ContentStatus.PENDING_VALIDATION })], 1]);

      const result = await quizzesService.getPendingValidation('responsable_pedagogique');
      expect(result.total).toBe(1);
    });

    it('lève ForbiddenException pour un formateur', async () => {
      await expect(quizzesService.getPendingValidation('formateur')).rejects.toThrow(ForbiddenException);
    });

    it('lève ForbiddenException pour un élève', async () => {
      await expect(quizzesService.getPendingValidation('eleve')).rejects.toThrow(ForbiddenException);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // gradeQuiz()
  // ─────────────────────────────────────────────────────────────────────────

  describe('gradeQuiz()', () => {
    it('note un quizz existant en déléguant à la notation pure', async () => {
      const quiz = buildSampleQuiz({ questions: [buildSampleQuestion()] });
      quizRepo.findOne.mockResolvedValue(quiz);

      const result = await quizzesService.gradeQuiz(QUIZ_ID, {
        answers: [{ questionId: 'question-0001', selectedOptionIds: ['opt-b'] }],
      });

      expect(result.score).toBe(1);
      expect(result.maxScore).toBe(1);
      expect(result.details[0].isCorrect).toBe(true);
    });

    it('lève NotFoundException si le quizz est introuvable', async () => {
      quizRepo.findOne.mockResolvedValue(null);

      await expect(
        quizzesService.gradeQuiz(QUIZ_ID, { answers: [] }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
