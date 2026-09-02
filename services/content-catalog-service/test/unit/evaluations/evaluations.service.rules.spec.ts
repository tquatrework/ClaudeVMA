/**
 * Unit tests — EvaluationsService (règles métier complémentaires)
 *
 * Couvre les règles métier non couvertes dans evaluations.service.spec.ts :
 *   findOne()          → retourne l'évaluation ou NotFoundException
 *   removeEvaluation() → le TI peut retirer, l'auteur peut retirer la sienne
 *
 * CCS-BR-005 (verrou de tentative en cours) et `hasActiveAttempt()` ont
 * disparu de ce fichier : ils portaient sur `EvaluationAttempt`, retirée de
 * ce service le 2026-09-01 (migre vers `learning-activity-service` — voir
 * docs/architecture.md, "Refonte des Evaluations", point 4).
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { EvaluationsService } from '../../../src/evaluations/evaluations.service';
import { Evaluation } from '../../../src/evaluations/entities/evaluation.entity';
import { ContentStatus } from '../../../src/common/enums/content-status.enum';
import { ExercisePart } from '../../../src/exercises/entities/exercise-part.entity';

const FORMATEUR_ID  = 'form-0000-4000-a000-aaaaaaaaaaaa';
const ELEVE_ID      = 'elev-0000-4000-b000-bbbbbbbbbbbb';
const OTHER_ID      = 'othe-0000-4000-c000-cccccccccccc';
const EVALUATION_ID = 'eval-0000-4000-d000-dddddddddddd';

function buildMockRepo() {
  return {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
}

function buildMockExercisePartRepo() {
  return {
    find: jest.fn().mockResolvedValue([]),
  };
}

function buildSampleEvaluation(overrides: Partial<Evaluation> = {}): Evaluation {
  return {
    id: EVALUATION_ID,
    title: 'Évaluation de test',
    description: 'Test',
    exerciseItems: [{ exerciseId: 'exer-0001', order: 1 }],
    level: 'seconde',
    difficulty: 'moyen',
    theme: 'algèbre',
    competencies: [],
    tags: [],
    durationSeconds: 3600,
    blockBackNavigation: false,
    authorId: FORMATEUR_ID,
    authorRole: 'formateur',
    status: ContentStatus.VALIDATED,
    shareableLink: '/evaluations/eval-0000',
    scoring: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

describe('EvaluationsService — règles métier complémentaires', () => {
  let evaluationsService: EvaluationsService;
  let evaluationRepo: ReturnType<typeof buildMockRepo>;
  let exercisePartRepo: ReturnType<typeof buildMockExercisePartRepo>;

  beforeEach(async () => {
    evaluationRepo = buildMockRepo();
    exercisePartRepo = buildMockExercisePartRepo();

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        EvaluationsService,
        { provide: getRepositoryToken(Evaluation), useValue: evaluationRepo },
        { provide: getRepositoryToken(ExercisePart), useValue: exercisePartRepo },
      ],
    }).compile();

    evaluationsService = moduleRef.get<EvaluationsService>(EvaluationsService);
  });

  afterEach(() => jest.clearAllMocks());

  // ─────────────────────────────────────────────────────────────────────────
  // findOne() — méthode publique non testée
  // ─────────────────────────────────────────────────────────────────────────

  describe('findOne()', () => {
    it('retourne l\'évaluation si elle existe', async () => {
      const evaluation = buildSampleEvaluation();
      evaluationRepo.findOne.mockResolvedValue(evaluation);

      const result = await evaluationsService.findOne(EVALUATION_ID);

      expect(result.id).toBe(EVALUATION_ID);
    });

    it('lève NotFoundException si l\'évaluation est introuvable', async () => {
      evaluationRepo.findOne.mockResolvedValue(null);

      await expect(
        evaluationsService.findOne(EVALUATION_ID),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // removeEvaluation() — cas supplémentaires non couverts
  // ─────────────────────────────────────────────────────────────────────────

  describe('removeEvaluation() — cas supplémentaires', () => {
    it('le TI peut retirer n\'importe quelle évaluation', async () => {
      const evaluation = buildSampleEvaluation();
      evaluationRepo.findOne.mockResolvedValue(evaluation);
      evaluationRepo.save.mockResolvedValue({ ...evaluation, status: ContentStatus.REMOVED });

      await expect(
        evaluationsService.removeEvaluation(EVALUATION_ID, OTHER_ID, 'technicien_informatique'),
      ).resolves.toBeUndefined();

      expect(evaluationRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: ContentStatus.REMOVED }),
      );
    });

    it('l\'auteur peut retirer sa propre évaluation', async () => {
      const evaluation = buildSampleEvaluation({ authorId: FORMATEUR_ID });
      evaluationRepo.findOne.mockResolvedValue(evaluation);
      evaluationRepo.save.mockResolvedValue({ ...evaluation, status: ContentStatus.REMOVED });

      await expect(
        evaluationsService.removeEvaluation(EVALUATION_ID, FORMATEUR_ID, 'formateur'),
      ).resolves.toBeUndefined();
    });

    it('lève ForbiddenException si un formateur tente de retirer l\'évaluation d\'un autre', async () => {
      const evaluation = buildSampleEvaluation({ authorId: FORMATEUR_ID });
      evaluationRepo.findOne.mockResolvedValue(evaluation);

      await expect(
        evaluationsService.removeEvaluation(EVALUATION_ID, OTHER_ID, 'formateur'),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
