/**
 * Unit tests — QuizAttemptsService
 *
 * Couvre :
 *   - start()   → seuls élèves/formateurs/RP/AP peuvent démarrer une tentative
 *   - submit()  → notation via QuizGradingClientService, clôture, refus de
 *                 re-soumission, tentative introuvable/non possédée, rôle
 *                 non autorisé, propagation d'une erreur de notation
 *   - history() → uniquement les tentatives terminées de l'utilisateur
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  BadGatewayException,
} from '@nestjs/common';
import { QuizAttemptsService } from '../../../src/quiz-attempts/quiz-attempts.service';
import { QuizAttempt } from '../../../src/quiz-attempts/entities/quiz-attempt.entity';
import { QuizGradingClientService } from '../../../src/quiz-attempts/quiz-grading-client.service';
import { QuizAttemptStatus } from '../../../src/common/enums/quiz-attempt-status.enum';
import { UserRole } from '../../../src/common/enums/user-role.enum';

const ELEVE_ID = 'el-0000-4000-c000-cccccccccccc';
const OTHER_ELEVE_ID = 'el-0000-4000-c000-dddddddddddd';
const QUIZ_ID = 'quiz-0000-4000-a000-aaaaaaaaaaaa';
const ATTEMPT_ID = 'at-0000-4000-b000-bbbbbbbbbbbb';

function buildMockRepo() {
  return {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
  };
}

function buildSampleAttempt(overrides: Partial<QuizAttempt> = {}): QuizAttempt {
  return {
    id: ATTEMPT_ID,
    quizId: QUIZ_ID,
    userId: ELEVE_ID,
    userRole: UserRole.ELEVE,
    status: QuizAttemptStatus.IN_PROGRESS,
    score: null,
    maxScore: null,
    details: null,
    startedAt: new Date('2026-08-28T10:00:00Z'),
    completedAt: null,
    updatedAt: new Date('2026-08-28T10:00:00Z'),
    ...overrides,
  };
}

describe('QuizAttemptsService', () => {
  let quizAttemptsService: QuizAttemptsService;
  let attemptRepo: ReturnType<typeof buildMockRepo>;
  let gradingClient: { grade: jest.Mock };

  beforeEach(async () => {
    attemptRepo = buildMockRepo();
    gradingClient = { grade: jest.fn() };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        QuizAttemptsService,
        { provide: getRepositoryToken(QuizAttempt), useValue: attemptRepo },
        { provide: QuizGradingClientService, useValue: gradingClient },
      ],
    }).compile();

    quizAttemptsService = moduleRef.get(QuizAttemptsService);
  });

  describe('start', () => {
    it('démarre une tentative pour un élève', async () => {
      const created = buildSampleAttempt();
      attemptRepo.create.mockReturnValue(created);
      attemptRepo.save.mockResolvedValue(created);

      const result = await quizAttemptsService.start({ quizId: QUIZ_ID }, ELEVE_ID, UserRole.ELEVE);

      expect(attemptRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          quizId: QUIZ_ID,
          userId: ELEVE_ID,
          userRole: UserRole.ELEVE,
          status: QuizAttemptStatus.IN_PROGRESS,
        }),
      );
      expect(result).toEqual(created);
    });

    it.each([UserRole.FORMATEUR, UserRole.RESPONSABLE_PEDAGOGIQUE, UserRole.ANIMATEUR_PEDAGOGIQUE])(
      'démarre une tentative pour le rôle %s',
      async (role) => {
        const created = buildSampleAttempt({ userRole: role });
        attemptRepo.create.mockReturnValue(created);
        attemptRepo.save.mockResolvedValue(created);

        await expect(
          quizAttemptsService.start({ quizId: QUIZ_ID }, ELEVE_ID, role),
        ).resolves.toEqual(created);
      },
    );

    it('refuse un rôle non autorisé (parent financeur)', async () => {
      await expect(
        quizAttemptsService.start({ quizId: QUIZ_ID }, ELEVE_ID, UserRole.PARENT_FINANCEUR),
      ).rejects.toThrow(ForbiddenException);
      expect(attemptRepo.create).not.toHaveBeenCalled();
    });
  });

  describe('submit', () => {
    it('note et clôture une tentative en cours', async () => {
      const attempt = buildSampleAttempt();
      attemptRepo.findOne.mockResolvedValue(attempt);
      gradingClient.grade.mockResolvedValue({
        score: 4,
        maxScore: 5,
        details: [{ questionId: 'q1', isCorrect: true, pointsEarned: 4, pointsPossible: 5 }],
      });
      attemptRepo.save.mockImplementation((value) => Promise.resolve(value));

      const result = await quizAttemptsService.submit(
        ATTEMPT_ID,
        { answers: [{ questionId: 'q1', selectedOptionIds: ['a'] }] },
        ELEVE_ID,
        UserRole.ELEVE,
        'corr-1',
      );

      expect(gradingClient.grade).toHaveBeenCalledWith(
        QUIZ_ID,
        [{ questionId: 'q1', selectedOptionIds: ['a'] }],
        'corr-1',
      );
      expect(result.status).toBe(QuizAttemptStatus.COMPLETED);
      expect(result.score).toBe(4);
      expect(result.maxScore).toBe(5);
      expect(result.completedAt).toBeInstanceOf(Date);
    });

    it('refuse de re-soumettre une tentative déjà terminée', async () => {
      const attempt = buildSampleAttempt({
        status: QuizAttemptStatus.COMPLETED,
        completedAt: new Date('2026-08-28T11:00:00Z'),
        score: 5,
        maxScore: 5,
      });
      attemptRepo.findOne.mockResolvedValue(attempt);

      await expect(
        quizAttemptsService.submit(ATTEMPT_ID, { answers: [] }, ELEVE_ID, UserRole.ELEVE),
      ).rejects.toThrow(BadRequestException);
      expect(gradingClient.grade).not.toHaveBeenCalled();
    });

    it('renvoie 404 si la tentative est introuvable', async () => {
      attemptRepo.findOne.mockResolvedValue(null);

      await expect(
        quizAttemptsService.submit(ATTEMPT_ID, { answers: [] }, ELEVE_ID, UserRole.ELEVE),
      ).rejects.toThrow(NotFoundException);
    });

    it('renvoie 404 si la tentative appartient à un autre utilisateur (pas de fuite d\'existence)', async () => {
      const attempt = buildSampleAttempt({ userId: OTHER_ELEVE_ID });
      attemptRepo.findOne.mockResolvedValue(attempt);

      await expect(
        quizAttemptsService.submit(ATTEMPT_ID, { answers: [] }, ELEVE_ID, UserRole.ELEVE),
      ).rejects.toThrow(NotFoundException);
      expect(gradingClient.grade).not.toHaveBeenCalled();
    });

    it('refuse un rôle non autorisé avant même de chercher la tentative', async () => {
      await expect(
        quizAttemptsService.submit(ATTEMPT_ID, { answers: [] }, ELEVE_ID, UserRole.PARENT_FINANCEUR),
      ).rejects.toThrow(ForbiddenException);
      expect(attemptRepo.findOne).not.toHaveBeenCalled();
    });

    it('propage une erreur de notation malformée sans persister de résultat partiel', async () => {
      const attempt = buildSampleAttempt();
      attemptRepo.findOne.mockResolvedValue(attempt);
      gradingClient.grade.mockRejectedValue(new BadGatewayException('Réponse malformée'));

      await expect(
        quizAttemptsService.submit(ATTEMPT_ID, { answers: [] }, ELEVE_ID, UserRole.ELEVE),
      ).rejects.toThrow(BadGatewayException);
      expect(attemptRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('history', () => {
    it('ne renvoie que les tentatives terminées de l\'utilisateur', async () => {
      const completed = [
        buildSampleAttempt({ id: 'a1', status: QuizAttemptStatus.COMPLETED, score: 3, maxScore: 5 }),
      ];
      attemptRepo.find.mockResolvedValue(completed);

      const result = await quizAttemptsService.history(ELEVE_ID);

      expect(attemptRepo.find).toHaveBeenCalledWith({
        where: { userId: ELEVE_ID, status: QuizAttemptStatus.COMPLETED },
        order: { completedAt: 'DESC' },
      });
      expect(result).toEqual(completed);
    });
  });
});
