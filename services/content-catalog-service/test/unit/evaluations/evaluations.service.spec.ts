/**
 * Unit tests — EvaluationsService
 *
 * Couvre (arbitrage du 2026-09-01, "Refonte des Evaluations : notation
 * manuelle, demande de correction, notifications" — périmètre
 * content-catalog-service uniquement) :
 *   - create()  → seuls formateur/AP/RP, exige au moins un exercice, exige
 *                 une durée > 0, statut fixé selon le rôle (pending_validation
 *                 pour un formateur, validated pour AP/RP — aligné Quizz/Exercice)
 *   - search()  → élève et parent ne voient que les évaluations validées,
 *                 filtre par tag (ANY) et mot-clé (ILIKE) désormais appliqués
 *   - removeEvaluation() → réservé RP/TI/auteur
 *
 * `startAttempt()`/`hasActiveAttempt()` ont disparu avec `EvaluationAttempt`
 * (retirée de ce service, migre vers `learning-activity-service`) — plus
 * aucun test ne les couvre ici.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { EvaluationsService } from '../../../src/evaluations/evaluations.service';
import { Evaluation } from '../../../src/evaluations/entities/evaluation.entity';
import { ContentStatus } from '../../../src/common/enums/content-status.enum';
import { ExercisePart } from '../../../src/exercises/entities/exercise-part.entity';
import { ProfileRelationsClient } from '../../../src/common/clients/profile-relations.client';

const FORMATEUR_ID    = 'form-0000-4000-a000-aaaaaaaaaaaa';
const AP_ID           = 'apid-0000-4000-a000-aaaaaaaaaaaa';
const RP_ID           = 'rpid-0000-4000-a000-aaaaaaaaaaaa';
const ELEVE_ID        = 'elev-0000-4000-b000-bbbbbbbbbbbb';
const OTHER_ID        = 'othe-0000-4000-c000-cccccccccccc';
const EVALUATION_ID   = 'eval-0000-4000-d000-dddddddddddd';

function buildMockQueryBuilder(result: [Evaluation[], number] = [[], 0]) {
  const qb: any = {
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue(result),
  };
  return qb;
}

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

function buildMockProfileRelationsClient() {
  return {
    hasAnimatorOfTeacherRelation: jest.fn(),
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
    scoring: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

describe('EvaluationsService', () => {
  let evaluationsService: EvaluationsService;
  let evaluationRepo: ReturnType<typeof buildMockRepo>;
  let exercisePartRepo: ReturnType<typeof buildMockExercisePartRepo>;
  let profileRelationsClient: ReturnType<typeof buildMockProfileRelationsClient>;

  beforeEach(async () => {
    evaluationRepo = buildMockRepo();
    exercisePartRepo = buildMockExercisePartRepo();
    profileRelationsClient = buildMockProfileRelationsClient();

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        EvaluationsService,
        { provide: getRepositoryToken(Evaluation), useValue: evaluationRepo },
        { provide: getRepositoryToken(ExercisePart), useValue: exercisePartRepo },
        { provide: ProfileRelationsClient, useValue: profileRelationsClient },
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
      durationSeconds: 1800,
    };

    it('crée une évaluation pending_validation pour un formateur', async () => {
      const savedEvaluation = buildSampleEvaluation({ status: ContentStatus.PENDING_VALIDATION });
      evaluationRepo.create.mockReturnValue(savedEvaluation);
      evaluationRepo.save.mockResolvedValue(savedEvaluation);

      const result = await evaluationsService.create(validDto, FORMATEUR_ID, 'formateur');

      expect(result).toBeDefined();
      expect(evaluationRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ status: ContentStatus.PENDING_VALIDATION }),
      );
    });

    it('crée une évaluation validated pour un animateur_pedagogique', async () => {
      const savedEvaluation = buildSampleEvaluation({ authorRole: 'animateur_pedagogique', status: ContentStatus.VALIDATED });
      evaluationRepo.create.mockReturnValue(savedEvaluation);
      evaluationRepo.save.mockResolvedValue(savedEvaluation);

      await evaluationsService.create(validDto, AP_ID, 'animateur_pedagogique');

      expect(evaluationRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ status: ContentStatus.VALIDATED }),
      );
    });

    it('crée une évaluation validated pour un responsable_pedagogique', async () => {
      const savedEvaluation = buildSampleEvaluation({ authorRole: 'responsable_pedagogique', status: ContentStatus.VALIDATED });
      evaluationRepo.create.mockReturnValue(savedEvaluation);
      evaluationRepo.save.mockResolvedValue(savedEvaluation);

      await evaluationsService.create(validDto, RP_ID, 'responsable_pedagogique');

      expect(evaluationRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ status: ContentStatus.VALIDATED }),
      );
    });

    it('lève ForbiddenException si un élève tente de créer une évaluation', async () => {
      await expect(
        evaluationsService.create(validDto, ELEVE_ID, 'eleve'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lève BadRequestException si la liste d\'exercices est vide', async () => {
      await expect(
        evaluationsService.create(
          { title: 'Test', exerciseItems: [], durationSeconds: 1800 },
          FORMATEUR_ID,
          'formateur',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('lève BadRequestException si durationSeconds est absent', async () => {
      await expect(
        evaluationsService.create(
          { title: 'Test', exerciseItems: [{ exerciseId: 'exer-0001', order: 1 }] } as any,
          FORMATEUR_ID,
          'formateur',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('lève BadRequestException si durationSeconds est nul ou négatif', async () => {
      await expect(
        evaluationsService.create(
          { title: 'Test', exerciseItems: [{ exerciseId: 'exer-0001', order: 1 }], durationSeconds: 0 },
          FORMATEUR_ID,
          'formateur',
        ),
      ).rejects.toThrow(BadRequestException);

      await expect(
        evaluationsService.create(
          { title: 'Test', exerciseItems: [{ exerciseId: 'exer-0001', order: 1 }], durationSeconds: -10 },
          FORMATEUR_ID,
          'formateur',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // search()
  // ─────────────────────────────────────────────────────────────────────────

  describe('search()', () => {
    it('filtre sur status=validated pour les élèves', async () => {
      const qb = buildMockQueryBuilder();
      evaluationRepo.createQueryBuilder.mockReturnValue(qb);

      await evaluationsService.search({}, 'eleve');

      expect(qb.andWhere).toHaveBeenCalledWith(
        'evaluation.status = :validated',
        expect.objectContaining({ validated: ContentStatus.VALIDATED }),
      );
    });

    it('ne filtre pas le statut pour un formateur', async () => {
      const qb = buildMockQueryBuilder([[buildSampleEvaluation()], 1]);
      evaluationRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await evaluationsService.search({}, 'formateur');

      const statusCalls = qb.andWhere.mock.calls.filter((call: any[]) => call[0].includes('status'));
      expect(statusCalls.length).toBe(0);
      expect(result.total).toBe(1);
    });

    it('applique le filtre par tag via ANY(tags)', async () => {
      const qb = buildMockQueryBuilder();
      evaluationRepo.createQueryBuilder.mockReturnValue(qb);

      await evaluationsService.search({ tag: 'algèbre' }, 'formateur');

      expect(qb.andWhere).toHaveBeenCalledWith(
        ':tag = ANY(evaluation.tags)',
        expect.objectContaining({ tag: 'algèbre' }),
      );
    });

    it('applique le filtre par mot-clé via ILIKE sur le titre', async () => {
      const qb = buildMockQueryBuilder();
      evaluationRepo.createQueryBuilder.mockReturnValue(qb);

      await evaluationsService.search({ keyword: 'trimestre' }, 'formateur');

      expect(qb.andWhere).toHaveBeenCalledWith(
        'evaluation.title ILIKE :keyword',
        expect.objectContaining({ keyword: '%trimestre%' }),
      );
    });

    it('n\'applique aucun filtre tag/mot-clé si absents des paramètres', async () => {
      const qb = buildMockQueryBuilder();
      evaluationRepo.createQueryBuilder.mockReturnValue(qb);

      await evaluationsService.search({}, 'formateur');

      const tagCalls = qb.andWhere.mock.calls.filter((call: any[]) => call[0].includes('ANY'));
      const keywordCalls = qb.andWhere.mock.calls.filter((call: any[]) => call[0].includes('ILIKE'));
      expect(tagCalls.length).toBe(0);
      expect(keywordCalls.length).toBe(0);
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
