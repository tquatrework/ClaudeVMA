/**
 * Unit tests — EvaluationsService
 *
 * Couvre :
 *   - create()       → seuls formateur/AP/RP, exige au moins un exercice
 *   - search()       → élève et parent ne voient que les évaluations validées
 *   - startAttempt() → réservé aux élèves, évaluation doit être validée
 *   - removeEvaluation() → réservé RP/TI/auteur
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { EvaluationsService } from '../../../src/evaluations/evaluations.service';
import { Evaluation } from '../../../src/evaluations/entities/evaluation.entity';
import { EvaluationAttempt, AttemptStatus } from '../../../src/evaluations/entities/evaluation-attempt.entity';
import { ContentStatus } from '../../../src/common/enums/content-status.enum';

const FORMATEUR_ID    = 'form-0000-4000-a000-aaaaaaaaaaaa';
const ELEVE_ID        = 'elev-0000-4000-b000-bbbbbbbbbbbb';
const OTHER_ID        = 'othe-0000-4000-c000-cccccccccccc';
const EVALUATION_ID   = 'eval-0000-4000-d000-dddddddddddd';

function buildMockRepo() {
  return {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    findAndCount: jest.fn(),
  };
}

function buildSampleEvaluation(overrides: Partial<Evaluation> = {}): Evaluation {
  return {
    id: EVALUATION_ID,
    title: 'Évaluation de test',
    description: 'Test',
    exerciseItems: [{ exerciseId: 'exer-0000', order: 1 }],
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
    attempts: [],
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

describe('EvaluationsService', () => {
  let evaluationsService: EvaluationsService;
  let evaluationRepo: ReturnType<typeof buildMockRepo>;
  let attemptRepo: ReturnType<typeof buildMockRepo>;

  beforeEach(async () => {
    evaluationRepo = buildMockRepo();
    attemptRepo = buildMockRepo();

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        EvaluationsService,
        { provide: getRepositoryToken(Evaluation), useValue: evaluationRepo },
        { provide: getRepositoryToken(EvaluationAttempt), useValue: attemptRepo },
      ],
    }).compile();

    evaluationsService = moduleRef.get<EvaluationsService>(EvaluationsService);
  });

  afterEach(() => jest.clearAllMocks());

  // ─────────────────────────────────────────────────────────────────────────
  // create()
  // ─────────────────────────────────────────────────────────────────────────

  describe('create()', () => {
    const validDto = {
      title: 'Eval trimestre 1',
      exerciseItems: [{ exerciseId: 'exer-0001', order: 1 }],
    };

    it('crée une évaluation pour un formateur', async () => {
      const savedEvaluation = buildSampleEvaluation({ status: ContentStatus.DRAFT });
      evaluationRepo.create.mockReturnValue(savedEvaluation);
      evaluationRepo.save.mockResolvedValue(savedEvaluation);

      const result = await evaluationsService.create(validDto, FORMATEUR_ID, 'formateur');

      expect(result).toBeDefined();
      expect(evaluationRepo.create).toHaveBeenCalled();
    });

    it('lève ForbiddenException si un élève tente de créer une évaluation', async () => {
      await expect(
        evaluationsService.create(validDto, ELEVE_ID, 'eleve'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lève BadRequestException si la liste d\'exercices est vide', async () => {
      await expect(
        evaluationsService.create({ title: 'Test', exerciseItems: [] }, FORMATEUR_ID, 'formateur'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // search()
  // ─────────────────────────────────────────────────────────────────────────

  describe('search()', () => {
    it('filtre sur status=validated pour les élèves', async () => {
      evaluationRepo.findAndCount.mockResolvedValue([[], 0]);

      await evaluationsService.search({}, 'eleve');

      expect(evaluationRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ status: ContentStatus.VALIDATED }) }),
      );
    });

    it('ne filtre pas le statut pour un formateur', async () => {
      evaluationRepo.findAndCount.mockResolvedValue([[buildSampleEvaluation()], 1]);

      const result = await evaluationsService.search({}, 'formateur');

      const callArg = evaluationRepo.findAndCount.mock.calls[0][0];
      expect(callArg.where.status).toBeUndefined();
      expect(result.total).toBe(1);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // startAttempt()
  // ─────────────────────────────────────────────────────────────────────────

  describe('startAttempt()', () => {
    it('permet à un élève de démarrer une tentative sur une évaluation validée', async () => {
      evaluationRepo.findOne.mockResolvedValue(buildSampleEvaluation({ status: ContentStatus.VALIDATED }));
      attemptRepo.findOne.mockResolvedValue(null);
      const savedAttempt = { id: 'atmp-0000', evaluationId: EVALUATION_ID, studentId: ELEVE_ID, status: AttemptStatus.IN_PROGRESS };
      attemptRepo.create.mockReturnValue(savedAttempt);
      attemptRepo.save.mockResolvedValue(savedAttempt);

      const result = await evaluationsService.startAttempt(EVALUATION_ID, {}, ELEVE_ID, 'eleve');

      expect(result.status).toBe(AttemptStatus.IN_PROGRESS);
    });

    it('lève ForbiddenException si un formateur tente de passer une évaluation', async () => {
      await expect(
        evaluationsService.startAttempt(EVALUATION_ID, {}, FORMATEUR_ID, 'formateur'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lève BadRequestException si l\'évaluation n\'est pas validée', async () => {
      evaluationRepo.findOne.mockResolvedValue(buildSampleEvaluation({ status: ContentStatus.DRAFT }));

      await expect(
        evaluationsService.startAttempt(EVALUATION_ID, {}, ELEVE_ID, 'eleve'),
      ).rejects.toThrow(BadRequestException);
    });

    it('lève BadRequestException si une tentative est déjà en cours', async () => {
      evaluationRepo.findOne.mockResolvedValue(buildSampleEvaluation({ status: ContentStatus.VALIDATED }));
      attemptRepo.findOne.mockResolvedValue({ id: 'atmp-existing', status: AttemptStatus.IN_PROGRESS });

      await expect(
        evaluationsService.startAttempt(EVALUATION_ID, {}, ELEVE_ID, 'eleve'),
      ).rejects.toThrow(BadRequestException);
    });

    it('lève NotFoundException si l\'évaluation est introuvable', async () => {
      evaluationRepo.findOne.mockResolvedValue(null);

      await expect(
        evaluationsService.startAttempt(EVALUATION_ID, {}, ELEVE_ID, 'eleve'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // removeEvaluation()
  // ─────────────────────────────────────────────────────────────────────────

  describe('removeEvaluation()', () => {
    it('le RP peut retirer n\'importe quelle évaluation', async () => {
      const evaluation = buildSampleEvaluation();
      evaluationRepo.findOne.mockResolvedValue(evaluation);
      evaluationRepo.save.mockResolvedValue({ ...evaluation, status: ContentStatus.REMOVED });

      await expect(
        evaluationsService.removeEvaluation(EVALUATION_ID, OTHER_ID, 'responsable_pedagogique'),
      ).resolves.toBeUndefined();

      expect(evaluationRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: ContentStatus.REMOVED }),
      );
    });

    it('lève ForbiddenException si un élève tente de retirer une évaluation', async () => {
      evaluationRepo.findOne.mockResolvedValue(buildSampleEvaluation({ authorId: FORMATEUR_ID }));

      await expect(
        evaluationsService.removeEvaluation(EVALUATION_ID, ELEVE_ID, 'eleve'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lève NotFoundException si l\'évaluation est introuvable', async () => {
      evaluationRepo.findOne.mockResolvedValue(null);

      await expect(
        evaluationsService.removeEvaluation(EVALUATION_ID, FORMATEUR_ID, 'formateur'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
