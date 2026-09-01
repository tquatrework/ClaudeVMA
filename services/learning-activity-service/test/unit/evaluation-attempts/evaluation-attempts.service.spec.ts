/**
 * Unit tests — EvaluationAttemptsService
 *
 * Couvre :
 *   - start()             → rôle autorisé/refusé, Évaluation non validée (400),
 *                            calcul de deadlineAt, snapshot des exerciseIds
 *   - submitAnswer()       → tentative introuvable/d'un tiers, tentative close,
 *                            délai écoulé, Exercice hors Évaluation, upsert idempotent
 *   - submit()             → clôture, refus de re-clôturer
 *   - requestCorrection()  → tentative non close, demande déjà en cours,
 *                            bascule ALL_DECLINED si aucun professeur lié,
 *                            PENDING + événement sinon
 *   - findOne() / history()
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { EvaluationAttemptsService } from '../../../src/evaluation-attempts/evaluation-attempts.service';
import { EvaluationAttempt } from '../../../src/evaluation-attempts/entities/evaluation-attempt.entity';
import { EvaluationCorrectionRequest } from '../../../src/evaluation-attempts/entities/evaluation-correction-request.entity';
import { EvaluationStructureClientService } from '../../../src/evaluation-attempts/evaluation-structure-client.service';
import { ProfileRelationsClientService } from '../../../src/evaluation-attempts/profile-relations-client.service';
import { EventsService } from '../../../src/evaluation-attempts/events/events.service';
import {
  EVALUATION_CORRECTION_REQUESTED,
  EVALUATION_CORRECTION_ALL_DECLINED,
} from '../../../src/evaluation-attempts/events/evaluation-event-types';
import { EvaluationAttemptStatus } from '../../../src/common/enums/evaluation-attempt-status.enum';
import { EvaluationCorrectionStatus } from '../../../src/common/enums/evaluation-correction-status.enum';
import { UserRole } from '../../../src/common/enums/user-role.enum';

const ELEVE_ID = 'el-0000-4000-c000-cccccccccccc';
const OTHER_ELEVE_ID = 'el-0000-4000-c000-dddddddddddd';
const EVALUATION_ID = 'ev-0000-4000-a000-aaaaaaaaaaaa';
const ATTEMPT_ID = 'at-0000-4000-b000-bbbbbbbbbbbb';
const EXERCISE_ID = 'ex-0000-4000-d000-eeeeeeeeeeee';
const PART_ID = 'part-0000-4000-e000-ffffffffffff';

function buildMockRepo() {
  return { create: jest.fn((data) => data), save: jest.fn(), find: jest.fn(), findOne: jest.fn() };
}

function buildSampleAttempt(overrides: Partial<EvaluationAttempt> = {}): EvaluationAttempt {
  return {
    id: ATTEMPT_ID,
    evaluationId: EVALUATION_ID,
    userId: ELEVE_ID,
    userRole: UserRole.ELEVE,
    status: EvaluationAttemptStatus.IN_PROGRESS,
    exerciseIds: [EXERCISE_ID],
    answers: [],
    startedAt: new Date(),
    deadlineAt: new Date(Date.now() + 3600 * 1000),
    completedAt: null,
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('EvaluationAttemptsService', () => {
  let service: EvaluationAttemptsService;
  let attemptRepo: ReturnType<typeof buildMockRepo>;
  let correctionRepo: ReturnType<typeof buildMockRepo>;
  let structureClient: { getStructure: jest.Mock };
  let relationsClient: { getLinkedTeacherIds: jest.Mock };
  let eventsService: { emit: jest.Mock };

  beforeEach(async () => {
    attemptRepo = buildMockRepo();
    correctionRepo = buildMockRepo();
    structureClient = { getStructure: jest.fn() };
    relationsClient = { getLinkedTeacherIds: jest.fn() };
    eventsService = { emit: jest.fn().mockResolvedValue(undefined) };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        EvaluationAttemptsService,
        { provide: getRepositoryToken(EvaluationAttempt), useValue: attemptRepo },
        { provide: getRepositoryToken(EvaluationCorrectionRequest), useValue: correctionRepo },
        { provide: EvaluationStructureClientService, useValue: structureClient },
        { provide: ProfileRelationsClientService, useValue: relationsClient },
        { provide: EventsService, useValue: eventsService },
      ],
    }).compile();

    service = moduleRef.get(EvaluationAttemptsService);
  });

  describe('start', () => {
    it('refuse un rôle non autorisé', async () => {
      await expect(
        service.start({ evaluationId: EVALUATION_ID }, ELEVE_ID, UserRole.PARENT_FINANCEUR, 'Bearer x'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('refuse si l\'Évaluation n\'est pas validée', async () => {
      structureClient.getStructure.mockResolvedValue({
        id: EVALUATION_ID,
        status: 'pending_validation',
        durationSeconds: 1800,
        exerciseItems: [],
      });

      await expect(
        service.start({ evaluationId: EVALUATION_ID }, ELEVE_ID, UserRole.ELEVE, 'Bearer x'),
      ).rejects.toThrow(BadRequestException);
    });

    it('démarre une tentative et calcule deadlineAt à partir de durationSeconds', async () => {
      structureClient.getStructure.mockResolvedValue({
        id: EVALUATION_ID,
        status: 'validated',
        durationSeconds: 1800,
        exerciseItems: [{ exerciseId: EXERCISE_ID, order: 0 }],
      });
      attemptRepo.save.mockImplementation(async (data) => ({ id: ATTEMPT_ID, ...data }));

      const before = Date.now();
      const result = await service.start(
        { evaluationId: EVALUATION_ID },
        ELEVE_ID,
        UserRole.ELEVE,
        'Bearer x',
      );
      const after = Date.now();

      expect(result.id).toBe(ATTEMPT_ID);
      expect(result.status).toBe(EvaluationAttemptStatus.IN_PROGRESS);
      const deadlineMs = new Date(result.deadlineAt).getTime();
      expect(deadlineMs).toBeGreaterThanOrEqual(before + 1800 * 1000);
      expect(deadlineMs).toBeLessThanOrEqual(after + 1800 * 1000);
      expect(attemptRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ exerciseIds: [EXERCISE_ID], answers: [] }),
      );
    });
  });

  describe('submitAnswer', () => {
    const answerDto = { exerciseId: EXERCISE_ID, partId: PART_ID, content: [{ type: 'text', content: 'ma réponse' }] };

    it('refuse un rôle non autorisé', async () => {
      await expect(
        service.submitAnswer(ATTEMPT_ID, answerDto as never, ELEVE_ID, UserRole.PARENT_FINANCEUR),
      ).rejects.toThrow(ForbiddenException);
    });

    it('renvoie 404 si la tentative est introuvable ou d\'un tiers', async () => {
      attemptRepo.findOne.mockResolvedValue(buildSampleAttempt({ userId: OTHER_ELEVE_ID }));

      await expect(
        service.submitAnswer(ATTEMPT_ID, answerDto as never, ELEVE_ID, UserRole.ELEVE),
      ).rejects.toThrow(NotFoundException);
    });

    it('refuse si la tentative est déjà terminée', async () => {
      attemptRepo.findOne.mockResolvedValue(
        buildSampleAttempt({ status: EvaluationAttemptStatus.COMPLETED }),
      );

      await expect(
        service.submitAnswer(ATTEMPT_ID, answerDto as never, ELEVE_ID, UserRole.ELEVE),
      ).rejects.toThrow(BadRequestException);
    });

    it('refuse si le délai est écoulé', async () => {
      attemptRepo.findOne.mockResolvedValue(
        buildSampleAttempt({ deadlineAt: new Date(Date.now() - 1000) }),
      );

      await expect(
        service.submitAnswer(ATTEMPT_ID, answerDto as never, ELEVE_ID, UserRole.ELEVE),
      ).rejects.toThrow(BadRequestException);
    });

    it('refuse si l\'Exercice ne fait pas partie de l\'Évaluation', async () => {
      attemptRepo.findOne.mockResolvedValue(buildSampleAttempt({ exerciseIds: ['autre-exercice'] }));

      await expect(
        service.submitAnswer(ATTEMPT_ID, answerDto as never, ELEVE_ID, UserRole.ELEVE),
      ).rejects.toThrow(BadRequestException);
    });

    it('enregistre une réponse et remplace idempotemment une réponse existante pour le même bloc', async () => {
      const attempt = buildSampleAttempt({
        answers: [
          {
            exerciseId: EXERCISE_ID,
            partId: PART_ID,
            content: [{ type: 'text', content: 'ancienne réponse' }],
            answeredAt: '2026-09-01T10:05:00.000Z',
          },
        ],
      });
      attemptRepo.findOne.mockResolvedValue(attempt);
      attemptRepo.save.mockImplementation(async (data) => data);

      const result = await service.submitAnswer(ATTEMPT_ID, answerDto as never, ELEVE_ID, UserRole.ELEVE);

      expect(result.answers).toHaveLength(1);
      expect(result.answers[0].content).toEqual([{ type: 'text', content: 'ma réponse' }]);
    });
  });

  describe('submit', () => {
    it('refuse un rôle non autorisé', async () => {
      await expect(service.submit(ATTEMPT_ID, ELEVE_ID, UserRole.PARENT_FINANCEUR)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('renvoie 404 si la tentative est introuvable', async () => {
      attemptRepo.findOne.mockResolvedValue(null);

      await expect(service.submit(ATTEMPT_ID, ELEVE_ID, UserRole.ELEVE)).rejects.toThrow(NotFoundException);
    });

    it('refuse de re-clôturer une tentative déjà terminée', async () => {
      attemptRepo.findOne.mockResolvedValue(
        buildSampleAttempt({ status: EvaluationAttemptStatus.COMPLETED }),
      );

      await expect(service.submit(ATTEMPT_ID, ELEVE_ID, UserRole.ELEVE)).rejects.toThrow(BadRequestException);
    });

    it('clôture une tentative en cours, même après l\'échéance', async () => {
      attemptRepo.findOne.mockResolvedValue(
        buildSampleAttempt({ deadlineAt: new Date(Date.now() - 1000) }),
      );
      attemptRepo.save.mockImplementation(async (data) => data);

      const result = await service.submit(ATTEMPT_ID, ELEVE_ID, UserRole.ELEVE);

      expect(result.status).toBe(EvaluationAttemptStatus.COMPLETED);
      expect(result.completedAt).not.toBeNull();
    });
  });

  describe('requestCorrection', () => {
    it('refuse si la tentative n\'est pas encore clôturée', async () => {
      attemptRepo.findOne.mockResolvedValue(buildSampleAttempt());

      await expect(service.requestCorrection(ATTEMPT_ID, ELEVE_ID, UserRole.ELEVE)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('refuse si une demande active existe déjà pour cette tentative', async () => {
      attemptRepo.findOne.mockResolvedValue(
        buildSampleAttempt({ status: EvaluationAttemptStatus.COMPLETED }),
      );
      correctionRepo.findOne.mockResolvedValue({
        id: 'req-1',
        status: EvaluationCorrectionStatus.PENDING,
      });

      await expect(service.requestCorrection(ATTEMPT_ID, ELEVE_ID, UserRole.ELEVE)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('bascule directement en ALL_DECLINED si aucun professeur n\'est lié à l\'élève', async () => {
      attemptRepo.findOne.mockResolvedValue(
        buildSampleAttempt({ status: EvaluationAttemptStatus.COMPLETED }),
      );
      correctionRepo.findOne.mockResolvedValue(null);
      relationsClient.getLinkedTeacherIds.mockResolvedValue([]);
      correctionRepo.save.mockImplementation(async (data) => ({ id: 'req-1', ...data }));

      const result = await service.requestCorrection(ATTEMPT_ID, ELEVE_ID, UserRole.ELEVE, 'corr-1');

      expect(result.status).toBe(EvaluationCorrectionStatus.ALL_DECLINED);
      expect(eventsService.emit).toHaveBeenCalledWith(
        EVALUATION_CORRECTION_ALL_DECLINED,
        expect.objectContaining({ studentId: ELEVE_ID, reason: 'no_linked_teacher' }),
        'corr-1',
      );
    });

    it('crée une demande PENDING et notifie les professeurs liés + le RP', async () => {
      attemptRepo.findOne.mockResolvedValue(
        buildSampleAttempt({ status: EvaluationAttemptStatus.COMPLETED }),
      );
      correctionRepo.findOne.mockResolvedValue(null);
      relationsClient.getLinkedTeacherIds.mockResolvedValue(['t1', 't2']);
      correctionRepo.save.mockImplementation(async (data) => ({ id: 'req-1', ...data }));

      const result = await service.requestCorrection(ATTEMPT_ID, ELEVE_ID, UserRole.ELEVE, 'corr-1');

      expect(result.status).toBe(EvaluationCorrectionStatus.PENDING);
      expect(eventsService.emit).toHaveBeenCalledWith(
        EVALUATION_CORRECTION_REQUESTED,
        expect.objectContaining({ studentId: ELEVE_ID, teacherIds: ['t1', 't2'] }),
        'corr-1',
      );
    });
  });

  describe('findOne', () => {
    it('calcule timeExpired', async () => {
      attemptRepo.findOne.mockResolvedValue(
        buildSampleAttempt({ deadlineAt: new Date(Date.now() - 1000) }),
      );

      const result = await service.findOne(ATTEMPT_ID, ELEVE_ID, UserRole.ELEVE);

      expect(result.timeExpired).toBe(true);
    });
  });

  describe('history', () => {
    it('renvoie uniquement les tentatives de l\'utilisateur', async () => {
      attemptRepo.find.mockResolvedValue([buildSampleAttempt()]);

      const result = await service.history(ELEVE_ID);

      expect(attemptRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: ELEVE_ID } }),
      );
      expect(result).toHaveLength(1);
    });
  });
});
