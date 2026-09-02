/**
 * Unit tests — EvaluationsService, barème informatif (arbitrage du
 * 2026-09-02, docs/architecture.md, "Barème informatif pour l'Évaluation")
 * et route d'édition PUT /evaluations/:id ajoutée à cette occasion.
 *
 * Couvre :
 *   - create()/update() acceptent un `scoring` optionnel, validé avant
 *     écriture (référence à un exercice/bloc réel, unicité, cohérence de
 *     mode) — jamais d'entrée orpheline ou mal formée absorbée en silence.
 *   - update() : 404 si introuvable, 403 si l'appelant n'est pas l'auteur,
 *     effet sur le statut selon le rôle de l'auteur (copie de la règle
 *     Quizz/Exercice du 2026-08-28/29).
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { EvaluationsService } from '../../../src/evaluations/evaluations.service';
import { Evaluation } from '../../../src/evaluations/entities/evaluation.entity';
import { ContentStatus } from '../../../src/common/enums/content-status.enum';
import { ExercisePart } from '../../../src/exercises/entities/exercise-part.entity';
import { ExercisePartCategory } from '../../../src/exercises/enums/exercise-part-category.enum';
import { EvaluationScoringMode } from '../../../src/evaluations/enums/evaluation-scoring-mode.enum';

const FORMATEUR_ID  = 'form-0000-4000-a000-aaaaaaaaaaaa';
const AP_ID         = 'apid-0000-4000-a000-aaaaaaaaaaaa';
const OTHER_ID      = 'othe-0000-4000-c000-cccccccccccc';
const EVALUATION_ID = 'eval-0000-4000-d000-dddddddddddd';
const EXERCISE_1    = 'exer-0001-4000-e000-eeeeeeeeeeee';
const EXERCISE_2    = 'exer-0002-4000-e000-eeeeeeeeeeee';
const PART_Q1       = 'part-0001-4000-f000-ffffffffffff';
const PART_Q2       = 'part-0002-4000-f000-ffffffffffff';

function buildMockRepo() {
  return {
    create: jest.fn((v) => v),
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
    exerciseItems: [
      { exerciseId: EXERCISE_1, order: 1 },
      { exerciseId: EXERCISE_2, order: 2 },
    ],
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

function buildQuestionPart(overrides: Partial<ExercisePart> = {}): ExercisePart {
  return {
    id: PART_Q1,
    exerciseId: EXERCISE_1,
    partNumber: 2,
    category: ExercisePartCategory.QUESTION,
    items: [],
    solution: null,
    createdAt: new Date(),
    ...overrides,
  } as ExercisePart;
}

describe('EvaluationsService — barème informatif et update()', () => {
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

  const baseDto = {
    title: 'Eval trimestre 1',
    exerciseItems: [
      { exerciseId: EXERCISE_1, order: 1 },
      { exerciseId: EXERCISE_2, order: 2 },
    ],
    durationSeconds: 1800,
  };

  // ───────────────────────────────────────────────────────────────────────
  // create() — mode per_exercise
  // ───────────────────────────────────────────────────────────────────────

  describe('create() — barème per_exercise', () => {
    it('accepte un barème valide (une entrée par exercice)', async () => {
      const dto = {
        ...baseDto,
        scoring: {
          mode: EvaluationScoringMode.PER_EXERCISE,
          entries: [
            { exerciseId: EXERCISE_1, points: 10 },
            { exerciseId: EXERCISE_2, points: 5 },
          ],
        },
      };
      evaluationRepo.save.mockImplementation((v) => Promise.resolve(v));

      const result = await evaluationsService.create(dto as any, FORMATEUR_ID, 'formateur');

      expect(result.scoring).toEqual(dto.scoring);
    });

    it('refuse une entrée avec partId en mode per_exercise', async () => {
      const dto = {
        ...baseDto,
        scoring: {
          mode: EvaluationScoringMode.PER_EXERCISE,
          entries: [{ exerciseId: EXERCISE_1, partId: PART_Q1, points: 10 }],
        },
      };

      await expect(
        evaluationsService.create(dto as any, FORMATEUR_ID, 'formateur'),
      ).rejects.toThrow(BadRequestException);
    });

    it('refuse une entrée référençant un exercice absent de la suite', async () => {
      const dto = {
        ...baseDto,
        scoring: {
          mode: EvaluationScoringMode.PER_EXERCISE,
          entries: [{ exerciseId: 'exer-inconnu-0000-0000-000000000000', points: 10 }],
        },
      };

      await expect(
        evaluationsService.create(dto as any, FORMATEUR_ID, 'formateur'),
      ).rejects.toThrow(BadRequestException);
    });

    it('refuse un doublon d\'exercice', async () => {
      const dto = {
        ...baseDto,
        scoring: {
          mode: EvaluationScoringMode.PER_EXERCISE,
          entries: [
            { exerciseId: EXERCISE_1, points: 10 },
            { exerciseId: EXERCISE_1, points: 5 },
          ],
        },
      };

      await expect(
        evaluationsService.create(dto as any, FORMATEUR_ID, 'formateur'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ───────────────────────────────────────────────────────────────────────
  // create() — mode per_question
  // ───────────────────────────────────────────────────────────────────────

  describe('create() — barème per_question', () => {
    it('accepte un barème valide (bloc question réel, appartenant au bon exercice)', async () => {
      exercisePartRepo.find.mockResolvedValue([buildQuestionPart({ id: PART_Q1, exerciseId: EXERCISE_1 })]);
      const dto = {
        ...baseDto,
        scoring: {
          mode: EvaluationScoringMode.PER_QUESTION,
          entries: [{ exerciseId: EXERCISE_1, partId: PART_Q1, points: 3 }],
        },
      };
      evaluationRepo.save.mockImplementation((v) => Promise.resolve(v));

      const result = await evaluationsService.create(dto as any, FORMATEUR_ID, 'formateur');

      expect(result.scoring).toEqual(dto.scoring);
      expect(exercisePartRepo.find).toHaveBeenCalled();
    });

    it('refuse une entrée sans partId', async () => {
      const dto = {
        ...baseDto,
        scoring: {
          mode: EvaluationScoringMode.PER_QUESTION,
          entries: [{ exerciseId: EXERCISE_1, points: 3 }],
        },
      };

      await expect(
        evaluationsService.create(dto as any, FORMATEUR_ID, 'formateur'),
      ).rejects.toThrow(BadRequestException);
    });

    it('refuse un partId introuvable', async () => {
      exercisePartRepo.find.mockResolvedValue([]);
      const dto = {
        ...baseDto,
        scoring: {
          mode: EvaluationScoringMode.PER_QUESTION,
          entries: [{ exerciseId: EXERCISE_1, partId: PART_Q1, points: 3 }],
        },
      };

      await expect(
        evaluationsService.create(dto as any, FORMATEUR_ID, 'formateur'),
      ).rejects.toThrow(BadRequestException);
    });

    it('refuse un partId appartenant à un autre exercice que celui déclaré', async () => {
      exercisePartRepo.find.mockResolvedValue([buildQuestionPart({ id: PART_Q1, exerciseId: EXERCISE_2 })]);
      const dto = {
        ...baseDto,
        scoring: {
          mode: EvaluationScoringMode.PER_QUESTION,
          entries: [{ exerciseId: EXERCISE_1, partId: PART_Q1, points: 3 }],
        },
      };

      await expect(
        evaluationsService.create(dto as any, FORMATEUR_ID, 'formateur'),
      ).rejects.toThrow(BadRequestException);
    });

    it('refuse un bloc qui n\'est pas de catégorie question', async () => {
      exercisePartRepo.find.mockResolvedValue([
        buildQuestionPart({ id: PART_Q1, exerciseId: EXERCISE_1, category: ExercisePartCategory.STATEMENT }),
      ]);
      const dto = {
        ...baseDto,
        scoring: {
          mode: EvaluationScoringMode.PER_QUESTION,
          entries: [{ exerciseId: EXERCISE_1, partId: PART_Q1, points: 3 }],
        },
      };

      await expect(
        evaluationsService.create(dto as any, FORMATEUR_ID, 'formateur'),
      ).rejects.toThrow(BadRequestException);
    });

    it('refuse un doublon de bloc question', async () => {
      exercisePartRepo.find.mockResolvedValue([
        buildQuestionPart({ id: PART_Q1, exerciseId: EXERCISE_1 }),
      ]);
      const dto = {
        ...baseDto,
        scoring: {
          mode: EvaluationScoringMode.PER_QUESTION,
          entries: [
            { exerciseId: EXERCISE_1, partId: PART_Q1, points: 3 },
            { exerciseId: EXERCISE_1, partId: PART_Q1, points: 5 },
          ],
        },
      };

      await expect(
        evaluationsService.create(dto as any, FORMATEUR_ID, 'formateur'),
      ).rejects.toThrow(BadRequestException);
    });

    it('accepte deux blocs question de deux exercices différents', async () => {
      exercisePartRepo.find.mockResolvedValue([
        buildQuestionPart({ id: PART_Q1, exerciseId: EXERCISE_1 }),
        buildQuestionPart({ id: PART_Q2, exerciseId: EXERCISE_2 }),
      ]);
      const dto = {
        ...baseDto,
        scoring: {
          mode: EvaluationScoringMode.PER_QUESTION,
          entries: [
            { exerciseId: EXERCISE_1, partId: PART_Q1, points: 3 },
            { exerciseId: EXERCISE_2, partId: PART_Q2, points: 7 },
          ],
        },
      };
      evaluationRepo.save.mockImplementation((v) => Promise.resolve(v));

      const result = await evaluationsService.create(dto as any, FORMATEUR_ID, 'formateur');

      expect(result.scoring).toEqual(dto.scoring);
    });
  });

  it('crée sans erreur une évaluation sans aucun barème (facultatif)', async () => {
    evaluationRepo.save.mockImplementation((v) => Promise.resolve(v));

    const result = await evaluationsService.create(baseDto as any, FORMATEUR_ID, 'formateur');

    expect(result.scoring).toBeNull();
    expect(exercisePartRepo.find).not.toHaveBeenCalled();
  });

  // ───────────────────────────────────────────────────────────────────────
  // update()
  // ───────────────────────────────────────────────────────────────────────

  describe('update()', () => {
    it('lève NotFoundException si l\'évaluation est introuvable', async () => {
      evaluationRepo.findOne.mockResolvedValue(null);

      await expect(
        evaluationsService.update(EVALUATION_ID, baseDto as any, FORMATEUR_ID, 'formateur'),
      ).rejects.toThrow(NotFoundException);
    });

    it('lève ForbiddenException si l\'appelant n\'est pas l\'auteur', async () => {
      const evaluation = buildSampleEvaluation({ authorId: FORMATEUR_ID });
      evaluationRepo.findOne.mockResolvedValue(evaluation);

      await expect(
        evaluationsService.update(EVALUATION_ID, baseDto as any, OTHER_ID, 'formateur'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('un formateur qui édite une évaluation validated la fait repasser pending_validation', async () => {
      const evaluation = buildSampleEvaluation({ authorId: FORMATEUR_ID, status: ContentStatus.VALIDATED });
      evaluationRepo.findOne.mockResolvedValue(evaluation);
      evaluationRepo.save.mockImplementation((v) => Promise.resolve(v));

      const result = await evaluationsService.update(
        EVALUATION_ID,
        baseDto as any,
        FORMATEUR_ID,
        'formateur',
      );

      expect(result.status).toBe(ContentStatus.PENDING_VALIDATION);
    });

    it('un AP/RP qui édite sa propre évaluation ne change pas son statut', async () => {
      const evaluation = buildSampleEvaluation({
        authorId: AP_ID,
        authorRole: 'animateur_pedagogique',
        status: ContentStatus.VALIDATED,
      });
      evaluationRepo.findOne.mockResolvedValue(evaluation);
      evaluationRepo.save.mockImplementation((v) => Promise.resolve(v));

      const result = await evaluationsService.update(
        EVALUATION_ID,
        baseDto as any,
        AP_ID,
        'animateur_pedagogique',
      );

      expect(result.status).toBe(ContentStatus.VALIDATED);
    });

    it('remplace intégralement le barème existant (nouveau barème appliqué)', async () => {
      const evaluation = buildSampleEvaluation({
        authorId: FORMATEUR_ID,
        scoring: {
          mode: EvaluationScoringMode.PER_EXERCISE,
          entries: [{ exerciseId: EXERCISE_1, points: 1 }],
        },
      });
      evaluationRepo.findOne.mockResolvedValue(evaluation);
      evaluationRepo.save.mockImplementation((v) => Promise.resolve(v));

      const newScoring = {
        mode: EvaluationScoringMode.PER_EXERCISE,
        entries: [
          { exerciseId: EXERCISE_1, points: 8 },
          { exerciseId: EXERCISE_2, points: 12 },
        ],
      };

      const result = await evaluationsService.update(
        EVALUATION_ID,
        { ...baseDto, scoring: newScoring } as any,
        FORMATEUR_ID,
        'formateur',
      );

      expect(result.scoring).toEqual(newScoring);
    });

    it('retire le barème si scoring est omis à l\'édition', async () => {
      const evaluation = buildSampleEvaluation({
        authorId: FORMATEUR_ID,
        scoring: {
          mode: EvaluationScoringMode.PER_EXERCISE,
          entries: [{ exerciseId: EXERCISE_1, points: 1 }],
        },
      });
      evaluationRepo.findOne.mockResolvedValue(evaluation);
      evaluationRepo.save.mockImplementation((v) => Promise.resolve(v));

      const result = await evaluationsService.update(
        EVALUATION_ID,
        baseDto as any,
        FORMATEUR_ID,
        'formateur',
      );

      expect(result.scoring).toBeNull();
    });

    it('lève BadRequestException si exerciseItems est vide', async () => {
      const evaluation = buildSampleEvaluation({ authorId: FORMATEUR_ID });
      evaluationRepo.findOne.mockResolvedValue(evaluation);

      await expect(
        evaluationsService.update(
          EVALUATION_ID,
          { ...baseDto, exerciseItems: [] } as any,
          FORMATEUR_ID,
          'formateur',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('lève BadRequestException si durationSeconds est absent/invalide', async () => {
      const evaluation = buildSampleEvaluation({ authorId: FORMATEUR_ID });
      evaluationRepo.findOne.mockResolvedValue(evaluation);

      await expect(
        evaluationsService.update(
          EVALUATION_ID,
          { ...baseDto, durationSeconds: 0 } as any,
          FORMATEUR_ID,
          'formateur',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
