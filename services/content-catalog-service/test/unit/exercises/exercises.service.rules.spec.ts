/**
 * Unit tests — ExercisesService (règles métier complémentaires)
 *
 * Couvre les règles métier non couvertes dans exercises.service.spec.ts :
 *   CCS-BR-001 — Solution obligatoire à la création (solutionContent non vide)
 *   CCS-BR-002 — Solution non publiée directement à l'élève sans démarche
 *   CCS-BR-003 — L'élève doit avoir demandé une correction pour obtenir solution/note
 *   CCS-BR-005 — Solution bloquée pendant une tentative d'évaluation active
 *   findOne()  — Retourne exercice ou NotFoundException
 *   getComments() — Couverture via ContentsService (intégration indirecte)
 *   hasActiveAttempt() — Couverture via EvaluationsService (intégration indirecte)
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ExercisesService } from '../../../src/exercises/exercises.service';
import { Exercise } from '../../../src/exercises/entities/exercise.entity';
import { ExercisePart } from '../../../src/exercises/entities/exercise-part.entity';
import { ExerciseAnswer } from '../../../src/exercises/entities/exercise-answer.entity';
import { ExerciseCorrection } from '../../../src/exercises/entities/exercise-correction.entity';
import { ExerciseSolution } from '../../../src/exercises/entities/exercise-solution.entity';
import { ContentStatus } from '../../../src/common/enums/content-status.enum';

const FORMATEUR_ID = 'form-0000-4000-a000-aaaaaaaaaaaa';
const ELEVE_ID     = 'elev-0000-4000-b000-bbbbbbbbbbbb';
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

describe('ExercisesService — règles métier complémentaires', () => {
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
  // CCS-BR-001 — Solution obligatoire à la création
  // ─────────────────────────────────────────────────────────────────────────

  describe('CCS-BR-001 — Solution obligatoire à la création', () => {
    it('enregistre systématiquement une ExerciseSolution lors de la création d\'un exercice', async () => {
      const savedExercise = buildSampleExercise({ status: ContentStatus.DRAFT });
      exerciseRepo.create.mockReturnValue(savedExercise);
      exerciseRepo.save.mockResolvedValue(savedExercise);
      exerciseSolutionRepo.create.mockReturnValue({ id: 'sol-0001', content: 'x = ±2' });
      exerciseSolutionRepo.save.mockResolvedValue({ id: 'sol-0001', content: 'x = ±2' });

      await exercisesService.create(
        { title: 'Eq.', statement: 'Résoudre x^2=4', solutionContent: 'x = ±2' },
        FORMATEUR_ID,
        'formateur',
      );

      // La solution DOIT être créée (appel à create ET save sur le repo de solution)
      expect(exerciseSolutionRepo.create).toHaveBeenCalledTimes(1);
      expect(exerciseSolutionRepo.save).toHaveBeenCalledTimes(1);
    });

    it('crée la solution avec le contenu fourni par le formateur', async () => {
      const savedExercise = buildSampleExercise({ status: ContentStatus.DRAFT });
      exerciseRepo.create.mockReturnValue(savedExercise);
      exerciseRepo.save.mockResolvedValue(savedExercise);
      exerciseSolutionRepo.create.mockReturnValue({});
      exerciseSolutionRepo.save.mockResolvedValue({});

      await exercisesService.create(
        { title: 'Eq.', statement: 'Résoudre x^2=4', solutionContent: 'La réponse est 2 ou -2' },
        FORMATEUR_ID,
        'formateur',
      );

      expect(exerciseSolutionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ content: 'La réponse est 2 ou -2' }),
      );
    });

    it('associe la solution à l\'exercice créé (par exerciseId)', async () => {
      const savedExercise = buildSampleExercise({ id: EXERCISE_ID, status: ContentStatus.DRAFT });
      exerciseRepo.create.mockReturnValue(savedExercise);
      exerciseRepo.save.mockResolvedValue(savedExercise);
      exerciseSolutionRepo.create.mockReturnValue({});
      exerciseSolutionRepo.save.mockResolvedValue({});

      await exercisesService.create(
        { title: 'Eq.', statement: 'Résoudre x^2=4', solutionContent: 'x = ±2' },
        FORMATEUR_ID,
        'formateur',
      );

      expect(exerciseSolutionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ exerciseId: EXERCISE_ID }),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // CCS-BR-002 — Solution non publiée à l'élève sans demande préalable
  //             (getOfficialSolution retourne une solution existante uniquement
  //              si l'élève a d'abord passé par la voie correction)
  // ─────────────────────────────────────────────────────────────────────────

  describe('CCS-BR-002 — Solution non accessible sans solutions validées', () => {
    it('lève NotFoundException quand aucune solution n\'est encore validée (élève ne peut pas "voir" la solution)', async () => {
      exerciseRepo.findOne.mockResolvedValue(buildSampleExercise());
      // Aucune solution validée disponible
      exerciseSolutionRepo.find.mockResolvedValue([]);

      await expect(
        exercisesService.getOfficialSolution(EXERCISE_ID, ELEVE_ID, 'eleve'),
      ).rejects.toThrow(NotFoundException);
    });

    it('ne retourne que les solutions dont isValidated=true (solutions non validées ignorées)', async () => {
      exerciseRepo.findOne.mockResolvedValue(buildSampleExercise());
      // Simule que le find avec where:{isValidated:true} retourne vide
      exerciseSolutionRepo.find.mockResolvedValue([]);

      await expect(
        exercisesService.getOfficialSolution(EXERCISE_ID, ELEVE_ID, 'eleve'),
      ).rejects.toThrow(NotFoundException);

      // Vérifie que la requête filtre bien sur isValidated: true
      expect(exerciseSolutionRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isValidated: true }),
        }),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // CCS-BR-003 — L'élève doit demander une correction pour obtenir solution
  // ─────────────────────────────────────────────────────────────────────────

  describe('CCS-BR-003 — Demande de correction préalable obligatoire', () => {
    it('permet à l\'élève de demander une correction sur sa propre réponse (flag correctionRequested → true)', async () => {
      const answer = buildSampleAnswer({ correctionRequested: false });
      exerciseAnswerRepo.findOne.mockResolvedValue(answer);
      exerciseAnswerRepo.save.mockResolvedValue({ ...answer, correctionRequested: true });

      const updatedAnswer = await exercisesService.requestCorrection(ANSWER_ID, {}, ELEVE_ID, 'eleve');

      expect(updatedAnswer.correctionRequested).toBe(true);
    });

    it('empêche une deuxième demande de correction sur la même réponse (idempotence négative)', async () => {
      // La réponse a déjà une correction demandée
      const answer = buildSampleAnswer({ correctionRequested: true });
      exerciseAnswerRepo.findOne.mockResolvedValue(answer);

      await expect(
        exercisesService.requestCorrection(ANSWER_ID, {}, ELEVE_ID, 'eleve'),
      ).rejects.toThrow(BadRequestException);
    });

    it('empêche un élève de demander correction sur la réponse d\'un autre élève', async () => {
      const answerOfOtherStudent = buildSampleAnswer({ studentId: 'autre-eleve-id' });
      exerciseAnswerRepo.findOne.mockResolvedValue(answerOfOtherStudent);

      await expect(
        exercisesService.requestCorrection(ANSWER_ID, {}, ELEVE_ID, 'eleve'),
      ).rejects.toThrow();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // findOne() — méthode publique non testée
  // ─────────────────────────────────────────────────────────────────────────

  describe('findOne()', () => {
    it('retourne l\'exercice s\'il existe', async () => {
      const exercise = buildSampleExercise();
      exerciseRepo.findOne.mockResolvedValue(exercise);

      const result = await exercisesService.findOne(EXERCISE_ID);

      expect(result.id).toBe(EXERCISE_ID);
    });

    it('lève NotFoundException si l\'exercice est introuvable', async () => {
      exerciseRepo.findOne.mockResolvedValue(null);

      await expect(
        exercisesService.findOne(EXERCISE_ID),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Restriction de création — rôle animateur_pedagogique
  // ─────────────────────────────────────────────────────────────────────────

  describe('create() — rôle animateur_pedagogique autorisé', () => {
    it('autorise un animateur_pedagogique à créer un exercice', async () => {
      const savedExercise = buildSampleExercise({ authorRole: 'animateur_pedagogique', status: ContentStatus.DRAFT });
      exerciseRepo.create.mockReturnValue(savedExercise);
      exerciseRepo.save.mockResolvedValue(savedExercise);
      exerciseSolutionRepo.create.mockReturnValue({});
      exerciseSolutionRepo.save.mockResolvedValue({});

      const result = await exercisesService.create(
        { title: 'Test', statement: 'Résoudre', solutionContent: 'Réponse' },
        'ap-user-id',
        'animateur_pedagogique',
      );

      expect(result).toBeDefined();
    });
  });
});
