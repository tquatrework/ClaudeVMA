/**
 * Unit tests — ExercisesService
 *
 * Couvre :
 *   - create()              → seuls formateur/AP/RP peuvent créer, solution obligatoire
 *   - search()              → filtrage par rôle (élève et parent voient uniquement le validé)
 *   - submitAnswer()        → réservé aux élèves, exercice doit être validé
 *   - requestCorrection()   → l'élève ne peut corriger que ses propres réponses
 *   - proposeSolution()     → réservé aux formateurs/AP/RP
 *   - getOfficialSolution() → retourne la moins chère des solutions validées
 *   - removeExercise()      → réservé RP/TI/auteur, passe en status REMOVED
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { ExercisesService } from '../../../src/exercises/exercises.service';
import { Exercise } from '../../../src/exercises/entities/exercise.entity';
import { ExercisePart } from '../../../src/exercises/entities/exercise-part.entity';
import { ExerciseAnswer } from '../../../src/exercises/entities/exercise-answer.entity';
import { ExerciseCorrection } from '../../../src/exercises/entities/exercise-correction.entity';
import { ExerciseSolution } from '../../../src/exercises/entities/exercise-solution.entity';
import { ContentStatus } from '../../../src/common/enums/content-status.enum';

const FORMATEUR_ID = 'form-0000-4000-a000-aaaaaaaaaaaa';
const ELEVE_ID     = 'elev-0000-4000-b000-bbbbbbbbbbbb';
const OTHER_ID     = 'othe-0000-4000-c000-cccccccccccc';
const EXERCISE_ID  = 'exer-0000-4000-d000-dddddddddddd';
const ANSWER_ID    = 'answ-0000-4000-e000-eeeeeeeeeeee';

function buildMockRepo() {
  return {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    findAndCount: jest.fn(),
    remove: jest.fn(),
  };
}

function buildSampleExercise(overrides: Partial<Exercise> = {}): Exercise {
  return {
    id: EXERCISE_ID,
    title: 'Exercice de test',
    description: 'Description',
    statement: 'Résoudre x^2 = 4',
    level: 'seconde',
    difficulty: 'moyen',
    theme: 'algèbre',
    competencies: ['calculer'],
    tags: ['équation'],
    correctionCost: 5,
    authorId: FORMATEUR_ID,
    authorRole: 'formateur',
    status: ContentStatus.VALIDATED,
    shareableLink: '/exercises/exer-0000',
    parts: [],
    answers: [],
    solutions: [],
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

function buildSampleAnswer(overrides: Partial<ExerciseAnswer> = {}): ExerciseAnswer {
  return {
    id: ANSWER_ID,
    exerciseId: EXERCISE_ID,
    studentId: ELEVE_ID,
    content: 'x = 2 ou x = -2',
    partId: null,
    correctionRequested: false,
    correctionId: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    exercise: null,
    ...overrides,
  };
}

describe('ExercisesService', () => {
  let exercisesService: ExercisesService;
  let exerciseRepo: ReturnType<typeof buildMockRepo>;
  let exercisePartRepo: ReturnType<typeof buildMockRepo>;
  let exerciseAnswerRepo: ReturnType<typeof buildMockRepo>;
  let exerciseCorrectionRepo: ReturnType<typeof buildMockRepo>;
  let exerciseSolutionRepo: ReturnType<typeof buildMockRepo>;

  beforeEach(async () => {
    exerciseRepo = buildMockRepo();
    exercisePartRepo = buildMockRepo();
    exerciseAnswerRepo = buildMockRepo();
    exerciseCorrectionRepo = buildMockRepo();
    exerciseSolutionRepo = buildMockRepo();

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        ExercisesService,
        { provide: getRepositoryToken(Exercise), useValue: exerciseRepo },
        { provide: getRepositoryToken(ExercisePart), useValue: exercisePartRepo },
        { provide: getRepositoryToken(ExerciseAnswer), useValue: exerciseAnswerRepo },
        { provide: getRepositoryToken(ExerciseCorrection), useValue: exerciseCorrectionRepo },
        { provide: getRepositoryToken(ExerciseSolution), useValue: exerciseSolutionRepo },
      ],
    }).compile();

    exercisesService = moduleRef.get<ExercisesService>(ExercisesService);
  });

  afterEach(() => jest.clearAllMocks());

  // ─────────────────────────────────────────────────────────────────────────
  // create()
  // ─────────────────────────────────────────────────────────────────────────

  describe('create()', () => {
    const validDto = {
      title: 'Équation du second degré',
      statement: 'Résoudre x^2 - 4 = 0',
      solutionContent: 'x = 2 ou x = -2',
    };

    it('crée un exercice avec sa solution quand le formateur le soumets', async () => {
      const savedExercise = buildSampleExercise({ status: ContentStatus.DRAFT });
      exerciseRepo.create.mockReturnValue(savedExercise);
      exerciseRepo.save.mockResolvedValue(savedExercise);
      exerciseSolutionRepo.create.mockReturnValue({});
      exerciseSolutionRepo.save.mockResolvedValue({});

      const result = await exercisesService.create(validDto, FORMATEUR_ID, 'formateur');

      expect(exerciseRepo.create).toHaveBeenCalled();
      expect(exerciseSolutionRepo.create).toHaveBeenCalled();
      expect(result.authorId).toBe(FORMATEUR_ID);
    });

    it('lève ForbiddenException si un élève tente de créer un exercice', async () => {
      await expect(
        exercisesService.create(validDto, ELEVE_ID, 'eleve'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lève ForbiddenException si un parent tente de créer un exercice', async () => {
      await expect(
        exercisesService.create(validDto, OTHER_ID, 'parent_financeur'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('autorise un responsable_pedagogique à créer un exercice', async () => {
      const savedExercise = buildSampleExercise({ authorRole: 'responsable_pedagogique', status: ContentStatus.DRAFT });
      exerciseRepo.create.mockReturnValue(savedExercise);
      exerciseRepo.save.mockResolvedValue(savedExercise);
      exerciseSolutionRepo.create.mockReturnValue({});
      exerciseSolutionRepo.save.mockResolvedValue({});

      const result = await exercisesService.create(validDto, OTHER_ID, 'responsable_pedagogique');

      expect(result).toBeDefined();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // search()
  // ─────────────────────────────────────────────────────────────────────────

  describe('search()', () => {
    it('filtre sur status=validated pour les élèves', async () => {
      exerciseRepo.findAndCount.mockResolvedValue([[], 0]);

      await exercisesService.search({}, 'eleve');

      expect(exerciseRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ status: ContentStatus.VALIDATED }) }),
      );
    });

    it('filtre sur status=validated pour les parents', async () => {
      exerciseRepo.findAndCount.mockResolvedValue([[], 0]);

      await exercisesService.search({}, 'parent_financeur');

      expect(exerciseRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ status: ContentStatus.VALIDATED }) }),
      );
    });

    it('ne filtre pas le statut pour un formateur', async () => {
      exerciseRepo.findAndCount.mockResolvedValue([[buildSampleExercise()], 1]);

      const result = await exercisesService.search({}, 'formateur');

      const callArg = exerciseRepo.findAndCount.mock.calls[0][0];
      expect(callArg.where.status).toBeUndefined();
      expect(result.total).toBe(1);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // submitAnswer()
  // ─────────────────────────────────────────────────────────────────────────

  describe('submitAnswer()', () => {
    it('permet à un élève de soumettre une réponse à un exercice validé', async () => {
      const exercise = buildSampleExercise({ status: ContentStatus.VALIDATED });
      const savedAnswer = buildSampleAnswer();
      exerciseRepo.findOne.mockResolvedValue(exercise);
      exerciseAnswerRepo.create.mockReturnValue(savedAnswer);
      exerciseAnswerRepo.save.mockResolvedValue(savedAnswer);

      const result = await exercisesService.submitAnswer(
        EXERCISE_ID,
        { content: 'x = 2' },
        ELEVE_ID,
        'eleve',
      );

      expect(result.studentId).toBe(ELEVE_ID);
    });

    it('lève ForbiddenException si un formateur soumet une réponse', async () => {
      await expect(
        exercisesService.submitAnswer(EXERCISE_ID, { content: 'x = 2' }, FORMATEUR_ID, 'formateur'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lève BadRequestException si l\'exercice n\'est pas validé', async () => {
      exerciseRepo.findOne.mockResolvedValue(buildSampleExercise({ status: ContentStatus.DRAFT }));

      await expect(
        exercisesService.submitAnswer(EXERCISE_ID, { content: 'x = 2' }, ELEVE_ID, 'eleve'),
      ).rejects.toThrow(BadRequestException);
    });

    it('lève NotFoundException si l\'exercice est introuvable', async () => {
      exerciseRepo.findOne.mockResolvedValue(null);

      await expect(
        exercisesService.submitAnswer(EXERCISE_ID, { content: 'x = 2' }, ELEVE_ID, 'eleve'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // requestCorrection()
  // ─────────────────────────────────────────────────────────────────────────

  describe('requestCorrection()', () => {
    it('permet à l\'élève de demander la correction de sa propre réponse', async () => {
      const answer = buildSampleAnswer({ correctionRequested: false });
      exerciseAnswerRepo.findOne.mockResolvedValue(answer);
      exerciseAnswerRepo.save.mockResolvedValue({ ...answer, correctionRequested: true });

      const result = await exercisesService.requestCorrection(ANSWER_ID, {}, ELEVE_ID, 'eleve');

      expect(result.correctionRequested).toBe(true);
    });

    it('lève ForbiddenException si l\'élève demande la correction d\'une réponse d\'un autre', async () => {
      const answer = buildSampleAnswer({ studentId: OTHER_ID });
      exerciseAnswerRepo.findOne.mockResolvedValue(answer);

      await expect(
        exercisesService.requestCorrection(ANSWER_ID, {}, ELEVE_ID, 'eleve'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lève BadRequestException si une correction est déjà demandée', async () => {
      const answer = buildSampleAnswer({ correctionRequested: true });
      exerciseAnswerRepo.findOne.mockResolvedValue(answer);

      await expect(
        exercisesService.requestCorrection(ANSWER_ID, {}, ELEVE_ID, 'eleve'),
      ).rejects.toThrow(BadRequestException);
    });

    it('lève NotFoundException si la réponse est introuvable', async () => {
      exerciseAnswerRepo.findOne.mockResolvedValue(null);

      await expect(
        exercisesService.requestCorrection(ANSWER_ID, {}, ELEVE_ID, 'eleve'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // proposeSolution()
  // ─────────────────────────────────────────────────────────────────────────

  describe('proposeSolution()', () => {
    it('permet à un formateur de proposer une solution', async () => {
      exerciseRepo.findOne.mockResolvedValue(buildSampleExercise());
      const savedSolution = { id: 'sol-0000', exerciseId: EXERCISE_ID, authorId: FORMATEUR_ID };
      exerciseSolutionRepo.create.mockReturnValue(savedSolution);
      exerciseSolutionRepo.save.mockResolvedValue(savedSolution);

      const result = await exercisesService.proposeSolution(
        EXERCISE_ID,
        { content: 'x = ±2', cost: 3 },
        FORMATEUR_ID,
        'formateur',
      );

      expect(result.authorId).toBe(FORMATEUR_ID);
    });

    it('lève ForbiddenException si un élève tente de proposer une solution', async () => {
      await expect(
        exercisesService.proposeSolution(EXERCISE_ID, { content: 'x = 2' }, ELEVE_ID, 'eleve'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lève NotFoundException si l\'exercice est introuvable', async () => {
      exerciseRepo.findOne.mockResolvedValue(null);

      await expect(
        exercisesService.proposeSolution(EXERCISE_ID, { content: 'x = 2' }, FORMATEUR_ID, 'formateur'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // getOfficialSolution()
  // ─────────────────────────────────────────────────────────────────────────

  describe('getOfficialSolution()', () => {
    it('retourne la moins chère des solutions validées', async () => {
      exerciseRepo.findOne.mockResolvedValue(buildSampleExercise());
      const cheapSolution = { id: 'sol-cheap', cost: 2, isValidated: true };
      exerciseSolutionRepo.find.mockResolvedValue([cheapSolution]);

      const result = await exercisesService.getOfficialSolution(EXERCISE_ID, ELEVE_ID, 'eleve');

      expect(result.cost).toBe(2);
    });

    it('lève NotFoundException si aucune solution validée', async () => {
      exerciseRepo.findOne.mockResolvedValue(buildSampleExercise());
      exerciseSolutionRepo.find.mockResolvedValue([]);

      await expect(
        exercisesService.getOfficialSolution(EXERCISE_ID, ELEVE_ID, 'eleve'),
      ).rejects.toThrow(NotFoundException);
    });

    it('lève NotFoundException si l\'exercice est introuvable', async () => {
      exerciseRepo.findOne.mockResolvedValue(null);

      await expect(
        exercisesService.getOfficialSolution(EXERCISE_ID, ELEVE_ID, 'eleve'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // removeExercise()
  // ─────────────────────────────────────────────────────────────────────────

  describe('removeExercise()', () => {
    it('le RP peut retirer n\'importe quel exercice', async () => {
      const exercise = buildSampleExercise();
      exerciseRepo.findOne.mockResolvedValue(exercise);
      exerciseRepo.save.mockResolvedValue({ ...exercise, status: ContentStatus.REMOVED });

      await expect(
        exercisesService.removeExercise(EXERCISE_ID, OTHER_ID, 'responsable_pedagogique'),
      ).resolves.toBeUndefined();

      expect(exerciseRepo.save).toHaveBeenCalledWith(expect.objectContaining({ status: ContentStatus.REMOVED }));
    });

    it('le TI peut retirer n\'importe quel exercice', async () => {
      const exercise = buildSampleExercise();
      exerciseRepo.findOne.mockResolvedValue(exercise);
      exerciseRepo.save.mockResolvedValue({ ...exercise, status: ContentStatus.REMOVED });

      await expect(
        exercisesService.removeExercise(EXERCISE_ID, OTHER_ID, 'technicien_informatique'),
      ).resolves.toBeUndefined();
    });

    it('l\'auteur peut retirer son propre exercice', async () => {
      const exercise = buildSampleExercise({ authorId: FORMATEUR_ID });
      exerciseRepo.findOne.mockResolvedValue(exercise);
      exerciseRepo.save.mockResolvedValue({ ...exercise, status: ContentStatus.REMOVED });

      await expect(
        exercisesService.removeExercise(EXERCISE_ID, FORMATEUR_ID, 'formateur'),
      ).resolves.toBeUndefined();
    });

    it('lève ForbiddenException si un autre formateur tente de retirer l\'exercice', async () => {
      const exercise = buildSampleExercise({ authorId: FORMATEUR_ID });
      exerciseRepo.findOne.mockResolvedValue(exercise);

      await expect(
        exercisesService.removeExercise(EXERCISE_ID, OTHER_ID, 'formateur'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lève NotFoundException si l\'exercice est introuvable', async () => {
      exerciseRepo.findOne.mockResolvedValue(null);

      await expect(
        exercisesService.removeExercise(EXERCISE_ID, FORMATEUR_ID, 'formateur'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
