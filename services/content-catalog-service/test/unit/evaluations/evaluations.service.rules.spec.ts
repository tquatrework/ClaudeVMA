/**
 * Unit tests — EvaluationsService (règles métier complémentaires)
 *
 * Couvre les règles métier non couvertes dans evaluations.service.spec.ts :
 *   CCS-BR-005 — Solution/contenu bloqué pendant une tentative active
 *   hasActiveAttempt() — vérifie la détection de tentative en cours
 *   findOne()          — retourne l'évaluation ou NotFoundException
 *   removeEvaluation() — le TI peut retirer, l'auteur peut retirer la sienne
 *   create() — animateur_pedagogique autorisé
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { EvaluationsService } from '../../../src/evaluations/evaluations.service';
import { Evaluation } from '../../../src/evaluations/entities/evaluation.entity';
import { EvaluationAttempt, AttemptStatus } from '../../../src/evaluations/entities/evaluation-attempt.entity';
import { ContentStatus } from '../../../src/common/enums/content-status.enum';

const FORMATEUR_ID  = 'form-0000-4000-a000-aaaaaaaaaaaa';
const ELEVE_ID      = 'elev-0000-4000-b000-bbbbbbbbbbbb';
const OTHER_ID      = 'othe-0000-4000-c000-cccccccccccc';
const EVALUATION_ID = 'eval-0000-4000-d000-dddddddddddd';

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
    attempts: [],
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

describe('EvaluationsService — règles métier complémentaires', () => {
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
  // CCS-BR-005 — Solution bloquée pendant une tentative active
  //              L'élève ne peut pas démarrer une nouvelle tentative quand
  //              une est déjà en cours (verrou de progression)
  // ─────────────────────────────────────────────────────────────────────────

  describe('CCS-BR-005 — Blocage lors d\'une tentative active', () => {
    it('empêche un élève de démarrer une nouvelle tentative si une est en cours', async () => {
      evaluationRepo.findOne.mockResolvedValue(buildSampleEvaluation({ status: ContentStatus.VALIDATED }));
      // Une tentative IN_PROGRESS existe déjà
      attemptRepo.findOne.mockResolvedValue({
        id: 'atmp-existing',
        evaluationId: EVALUATION_ID,
        studentId: ELEVE_ID,
        status: AttemptStatus.IN_PROGRESS,
      });

      await expect(
        evaluationsService.startAttempt(EVALUATION_ID, {}, ELEVE_ID, 'eleve'),
      ).rejects.toThrow();
    });

    it('autorise un élève à démarrer une tentative si la précédente est COMPLETED', async () => {
      evaluationRepo.findOne.mockResolvedValue(buildSampleEvaluation({ status: ContentStatus.VALIDATED }));
      // Pas de tentative IN_PROGRESS (la précédente est complétée)
      attemptRepo.findOne.mockResolvedValue(null);
      const newAttempt = {
        id: 'atmp-new',
        evaluationId: EVALUATION_ID,
        studentId: ELEVE_ID,
        status: AttemptStatus.IN_PROGRESS,
      };
      attemptRepo.create.mockReturnValue(newAttempt);
      attemptRepo.save.mockResolvedValue(newAttempt);

      const result = await evaluationsService.startAttempt(EVALUATION_ID, {}, ELEVE_ID, 'eleve');

      expect(result.status).toBe(AttemptStatus.IN_PROGRESS);
    });

    it('vérifie la tentative active en filtrant sur evaluationId ET studentId ET statut IN_PROGRESS', async () => {
      evaluationRepo.findOne.mockResolvedValue(buildSampleEvaluation({ status: ContentStatus.VALIDATED }));
      attemptRepo.findOne.mockResolvedValue(null);
      const newAttempt = { id: 'atmp-0001', status: AttemptStatus.IN_PROGRESS };
      attemptRepo.create.mockReturnValue(newAttempt);
      attemptRepo.save.mockResolvedValue(newAttempt);

      await evaluationsService.startAttempt(EVALUATION_ID, {}, ELEVE_ID, 'eleve');

      expect(attemptRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            evaluationId: EVALUATION_ID,
            studentId: ELEVE_ID,
            status: AttemptStatus.IN_PROGRESS,
          }),
        }),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // hasActiveAttempt() — méthode utilitaire non testée
  // ─────────────────────────────────────────────────────────────────────────

  describe('hasActiveAttempt()', () => {
    it('retourne true si une tentative IN_PROGRESS existe pour cet élève et cette évaluation', async () => {
      attemptRepo.findOne.mockResolvedValue({
        id: 'atmp-0001',
        status: AttemptStatus.IN_PROGRESS,
      });

      const hasActive = await evaluationsService.hasActiveAttempt(ELEVE_ID, EVALUATION_ID);

      expect(hasActive).toBe(true);
    });

    it('retourne false si aucune tentative IN_PROGRESS pour cet élève et cette évaluation', async () => {
      attemptRepo.findOne.mockResolvedValue(null);

      const hasActive = await evaluationsService.hasActiveAttempt(ELEVE_ID, EVALUATION_ID);

      expect(hasActive).toBe(false);
    });
  });

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

  // ─────────────────────────────────────────────────────────────────────────
  // create() — rôle animateur_pedagogique autorisé
  // ─────────────────────────────────────────────────────────────────────────

  describe('create() — animateur_pedagogique autorisé', () => {
    it('autorise un animateur_pedagogique à créer une évaluation', async () => {
      const savedEvaluation = buildSampleEvaluation({ authorRole: 'animateur_pedagogique', status: ContentStatus.DRAFT });
      evaluationRepo.create.mockReturnValue(savedEvaluation);
      evaluationRepo.save.mockResolvedValue(savedEvaluation);

      const result = await evaluationsService.create(
        { title: 'Eval AP', exerciseItems: [{ exerciseId: 'exer-0001', order: 1 }] },
        'ap-user-id',
        'animateur_pedagogique',
      );

      expect(result).toBeDefined();
    });

    it('lève ForbiddenException si un parent tente de créer une évaluation', async () => {
      await expect(
        evaluationsService.create(
          { title: 'Eval Parent', exerciseItems: [{ exerciseId: 'exer-0001', order: 1 }] },
          OTHER_ID,
          'parent_financeur',
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
