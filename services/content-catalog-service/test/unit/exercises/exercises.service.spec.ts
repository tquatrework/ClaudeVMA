/**
 * Unit tests — ExercisesService (refonte du 2026-08-29)
 *
 * Couvre :
 *   - create()              → rôles créateurs, blocs invalides, statut selon rôle
 *   - update()               → réservé à l'auteur, remplacement intégral, statut
 *   - search()               → visibilité alignée sur le Quizz, filtre par tag
 *   - findOne()               → 404 si non visible, jamais le contenu d'une solution
 *   - getPendingValidation()  → scoping AP par relation animator_of_teacher
 *   - removeExercise()        → réservé RP/TI/auteur, passe en status REMOVED
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { ExercisesService } from '../../../src/exercises/exercises.service';
import { Exercise } from '../../../src/exercises/entities/exercise.entity';
import { ExercisePart } from '../../../src/exercises/entities/exercise-part.entity';
import { ExerciseSolution } from '../../../src/exercises/entities/exercise-solution.entity';
import { ExerciseContentItem } from '../../../src/exercises/entities/exercise-content-item.entity';
import { ExercisePartCategory } from '../../../src/exercises/enums/exercise-part-category.enum';
import { ContentStatus } from '../../../src/common/enums/content-status.enum';
import { ProfileRelationsClient } from '../../../src/common/clients/profile-relations.client';
import { ExerciseImageStorageService } from '../../../src/exercises/exercise-image-storage.service';
import { ExerciseImageTranscoder } from '../../../src/exercises/exercise-image-transcoder';

const FORMATEUR_ID = 'form-0000-4000-a000-aaaaaaaaaaaa';
const AP_ID = 'ap00-0000-4000-b000-bbbbbbbbbbbb';
const RP_ID = 'rp00-0000-4000-c000-cccccccccccc';
const ELEVE_ID = 'elev-0000-4000-d000-dddddddddddd';
const OTHER_ID = 'othe-0000-4000-e000-eeeeeeeeeeee';
const EXERCISE_ID = 'exer-0000-4000-f000-ffffffffffff';

function buildMockRepo() {
  return {
    create: jest.fn((x) => x),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    findAndCount: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
}

function buildQueryBuilder(items: Exercise[] = [], total = items.length) {
  const qb: any = {
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([items, total]),
  };
  return qb;
}

function buildSampleExercise(overrides: Partial<Exercise> = {}): Exercise {
  return {
    id: EXERCISE_ID,
    title: 'Exercice de test',
    description: null,
    level: 'seconde',
    difficulty: 'moyen',
    theme: 'algèbre',
    competencies: ['calculer'],
    tags: ['équation'],
    authorId: FORMATEUR_ID,
    authorRole: 'formateur',
    status: ContentStatus.VALIDATED,
    shareableLink: '/exercises/exer-0000',
    parts: [],
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  } as Exercise;
}

const validCreateDto = {
  title: 'Équation du second degré',
  parts: [
    { category: ExercisePartCategory.STATEMENT, items: [{ type: 'text', content: 'Résoudre x^2 - 4 = 0' }] },
    {
      category: ExercisePartCategory.QUESTION,
      items: [{ type: 'text', content: 'Trouver x' }],
      solution: { items: [{ type: 'text', content: 'x = 2 ou x = -2' }] },
    },
  ],
};

describe('ExercisesService', () => {
  let service: ExercisesService;
  let exerciseRepo: ReturnType<typeof buildMockRepo>;
  let partRepo: ReturnType<typeof buildMockRepo>;
  let solutionRepo: ReturnType<typeof buildMockRepo>;
  let itemRepo: ReturnType<typeof buildMockRepo>;
  let profileRelationsClient: { hasAnimatorOfTeacherRelation: jest.Mock };
  let imageStorage: { save: jest.Mock; read: jest.Mock; delete: jest.Mock };
  let imageTranscoder: { transcode: jest.Mock };

  beforeEach(async () => {
    exerciseRepo = buildMockRepo();
    partRepo = buildMockRepo();
    solutionRepo = buildMockRepo();
    itemRepo = buildMockRepo();
    profileRelationsClient = { hasAnimatorOfTeacherRelation: jest.fn() };
    imageStorage = { save: jest.fn(), read: jest.fn(), delete: jest.fn() };
    imageTranscoder = { transcode: jest.fn() };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        ExercisesService,
        { provide: getRepositoryToken(Exercise), useValue: exerciseRepo },
        { provide: getRepositoryToken(ExercisePart), useValue: partRepo },
        { provide: getRepositoryToken(ExerciseSolution), useValue: solutionRepo },
        { provide: getRepositoryToken(ExerciseContentItem), useValue: itemRepo },
        { provide: ProfileRelationsClient, useValue: profileRelationsClient },
        { provide: ExerciseImageStorageService, useValue: imageStorage },
        { provide: ExerciseImageTranscoder, useValue: imageTranscoder },
      ],
    }).compile();

    service = moduleRef.get<ExercisesService>(ExercisesService);
  });

  afterEach(() => jest.clearAllMocks());

  // ─────────────────────────────────────────────────────────────────────
  // create()
  // ─────────────────────────────────────────────────────────────────────

  describe('create()', () => {
    it('crée un exercice avec blocs et solution quand un formateur le soumet (statut pending_validation)', async () => {
      exerciseRepo.save.mockImplementation((x) => Promise.resolve({ ...x, id: EXERCISE_ID }));
      partRepo.save.mockImplementation((x) => Promise.resolve({ ...x, id: 'part-' + Math.random() }));
      itemRepo.save.mockImplementation((x) => Promise.resolve(x));
      solutionRepo.save.mockImplementation((x) => Promise.resolve({ ...x, id: 'sol-1' }));
      exerciseRepo.findOne.mockResolvedValue(buildSampleExercise({ status: ContentStatus.PENDING_VALIDATION }));

      const result = await service.create(validCreateDto as any, FORMATEUR_ID, 'formateur');

      expect(exerciseRepo.save).toHaveBeenCalled();
      expect(partRepo.save).toHaveBeenCalledTimes(2);
      expect(solutionRepo.save).toHaveBeenCalledTimes(1);
      expect(result.authorId).toBe(FORMATEUR_ID);
    });

    it('crée un exercice validé immédiatement pour un RP', async () => {
      exerciseRepo.save.mockImplementation((x) => Promise.resolve({ ...x, id: EXERCISE_ID }));
      partRepo.save.mockImplementation((x) => Promise.resolve({ ...x, id: 'part-' + Math.random() }));
      itemRepo.save.mockImplementation((x) => Promise.resolve(x));
      solutionRepo.save.mockImplementation((x) => Promise.resolve({ ...x, id: 'sol-1' }));
      exerciseRepo.findOne.mockResolvedValue(
        buildSampleExercise({ authorId: RP_ID, authorRole: 'responsable_pedagogique', status: ContentStatus.VALIDATED }),
      );

      await service.create(validCreateDto as any, RP_ID, 'responsable_pedagogique');

      const createCall = exerciseRepo.create.mock.calls[0][0];
      expect(createCall.status).toBe(ContentStatus.VALIDATED);
    });

    it('lève ForbiddenException si un élève tente de créer un exercice', async () => {
      await expect(service.create(validCreateDto as any, ELEVE_ID, 'eleve')).rejects.toThrow(ForbiddenException);
    });

    it('lève BadRequestException si l\'exercice ne contient aucun bloc', async () => {
      await expect(
        service.create({ title: 'vide', parts: [] } as any, FORMATEUR_ID, 'formateur'),
      ).rejects.toThrow(BadRequestException);
    });

    it('lève BadRequestException si un bloc question n\'a pas de solution', async () => {
      const dto = {
        title: 'sans solution',
        parts: [{ category: ExercisePartCategory.QUESTION, items: [{ type: 'text', content: 'Q1' }] }],
      };
      await expect(service.create(dto as any, FORMATEUR_ID, 'formateur')).rejects.toThrow(BadRequestException);
    });

    it('lève BadRequestException si un bloc énoncé porte une solution', async () => {
      const dto = {
        title: 'énoncé avec solution',
        parts: [
          {
            category: ExercisePartCategory.STATEMENT,
            items: [{ type: 'text', content: 'Énoncé' }],
            solution: { items: [{ type: 'text', content: 'ne devrait pas être là' }] },
          },
        ],
      };
      await expect(service.create(dto as any, FORMATEUR_ID, 'formateur')).rejects.toThrow(BadRequestException);
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // update()
  // ─────────────────────────────────────────────────────────────────────

  describe('update()', () => {
    it('remplace intégralement les blocs et repasse en pending_validation pour un auteur formateur', async () => {
      const existing = buildSampleExercise({ status: ContentStatus.VALIDATED });
      exerciseRepo.findOne.mockResolvedValueOnce(existing).mockResolvedValueOnce({
        ...existing,
        status: ContentStatus.PENDING_VALIDATION,
        parts: [],
      });
      partRepo.find.mockResolvedValue([]);
      solutionRepo.find.mockResolvedValue([]);
      partRepo.save.mockImplementation((x) => Promise.resolve({ ...x, id: 'part-' + Math.random() }));
      itemRepo.save.mockImplementation((x) => Promise.resolve(x));
      solutionRepo.save.mockImplementation((x) => Promise.resolve({ ...x, id: 'sol-1' }));
      exerciseRepo.save.mockResolvedValue(existing);

      const result = await service.update(EXERCISE_ID, validCreateDto as any, FORMATEUR_ID, 'formateur');

      expect(partRepo.delete).toHaveBeenCalledWith({ exerciseId: EXERCISE_ID });
      expect(exerciseRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: ContentStatus.PENDING_VALIDATION }),
      );
      expect(result).toBeDefined();
    });

    it('lève ForbiddenException si l\'appelant n\'est pas l\'auteur', async () => {
      exerciseRepo.findOne.mockResolvedValue(buildSampleExercise({ authorId: FORMATEUR_ID }));

      await expect(
        service.update(EXERCISE_ID, validCreateDto as any, OTHER_ID, 'formateur'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lève NotFoundException si l\'exercice est introuvable', async () => {
      exerciseRepo.findOne.mockResolvedValue(null);

      await expect(
        service.update(EXERCISE_ID, validCreateDto as any, FORMATEUR_ID, 'formateur'),
      ).rejects.toThrow(NotFoundException);
    });

    it('lève BadRequestException si les blocs sont invalides', async () => {
      exerciseRepo.findOne.mockResolvedValue(buildSampleExercise({ authorId: FORMATEUR_ID }));

      await expect(
        service.update(EXERCISE_ID, { title: 't', parts: [] } as any, FORMATEUR_ID, 'formateur'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // search()
  // ─────────────────────────────────────────────────────────────────────

  describe('search()', () => {
    it('restreint aux exercices validés ou propres pour un non-administrateur', async () => {
      const qb = buildQueryBuilder([]);
      exerciseRepo.createQueryBuilder.mockReturnValue(qb);

      await service.search({}, ELEVE_ID, 'eleve');

      expect(qb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('exercise.status = :validated OR exercise.authorId'),
        expect.objectContaining({ validated: ContentStatus.VALIDATED, callerId: ELEVE_ID }),
      );
    });

    it('ne restreint pas la visibilité pour un RP', async () => {
      const qb = buildQueryBuilder([buildSampleExercise()], 1);
      exerciseRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.search({}, RP_ID, 'responsable_pedagogique');

      const statusCalls = qb.andWhere.mock.calls.filter((call: any[]) => call[0].includes('status = :validated'));
      expect(statusCalls).toHaveLength(0);
      expect(result.total).toBe(1);
    });

    it('applique le filtre par tag via ANY(tags)', async () => {
      const qb = buildQueryBuilder([]);
      exerciseRepo.createQueryBuilder.mockReturnValue(qb);

      await service.search({ tag: 'équation' } as any, FORMATEUR_ID, 'formateur');

      expect(qb.andWhere).toHaveBeenCalledWith(':tag = ANY(exercise.tags)', { tag: 'équation' });
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // findOne()
  // ─────────────────────────────────────────────────────────────────────

  describe('findOne()', () => {
    it('retourne l\'exercice validé sans jamais le contenu d\'une solution', async () => {
      const part = {
        id: 'part-1',
        partNumber: 1,
        category: ExercisePartCategory.QUESTION,
        items: [{ id: 'item-1', type: 'text', content: 'Q1', order: 0 }],
        solution: { id: 'sol-1' },
      };
      exerciseRepo.findOne.mockResolvedValue(buildSampleExercise({ parts: [part] as any }));

      const result = await service.findOne(EXERCISE_ID, ELEVE_ID, 'eleve');

      expect(result.parts[0].hasSolution).toBe(true);
      expect((result.parts[0] as any).solution).toBeUndefined();
      expect(JSON.stringify(result)).not.toContain('sol-1');
    });

    it('lève NotFoundException si non validé et appelant n\'est ni auteur ni admin', async () => {
      exerciseRepo.findOne.mockResolvedValue(
        buildSampleExercise({ status: ContentStatus.PENDING_VALIDATION, authorId: FORMATEUR_ID }),
      );

      await expect(service.findOne(EXERCISE_ID, ELEVE_ID, 'eleve')).rejects.toThrow(NotFoundException);
    });

    it('autorise l\'auteur à voir son propre exercice non validé', async () => {
      exerciseRepo.findOne.mockResolvedValue(
        buildSampleExercise({ status: ContentStatus.PENDING_VALIDATION, authorId: FORMATEUR_ID }),
      );

      const result = await service.findOne(EXERCISE_ID, FORMATEUR_ID, 'formateur');
      expect(result.id).toBe(EXERCISE_ID);
    });

    it('lève NotFoundException si l\'exercice n\'existe pas', async () => {
      exerciseRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne(EXERCISE_ID, ELEVE_ID, 'eleve')).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // getPendingValidation()
  // ─────────────────────────────────────────────────────────────────────

  describe('getPendingValidation()', () => {
    it('lève ForbiddenException pour un formateur', async () => {
      await expect(service.getPendingValidation(FORMATEUR_ID, 'formateur')).rejects.toThrow(ForbiddenException);
    });

    it('un RP voit tous les exercices en attente sans consulter la relation', async () => {
      exerciseRepo.findAndCount.mockResolvedValue([[buildSampleExercise()], 1]);

      const result = await service.getPendingValidation(RP_ID, 'responsable_pedagogique');

      expect(result.total).toBe(1);
      expect(profileRelationsClient.hasAnimatorOfTeacherRelation).not.toHaveBeenCalled();
    });

    it('un AP ne voit que les exercices des formateurs qu\'il anime', async () => {
      exerciseRepo.find.mockResolvedValue([buildSampleExercise({ authorId: FORMATEUR_ID })]);
      profileRelationsClient.hasAnimatorOfTeacherRelation.mockResolvedValue(true);

      const result = await service.getPendingValidation(AP_ID, 'animateur_pedagogique');

      expect(result.total).toBe(1);
      expect(profileRelationsClient.hasAnimatorOfTeacherRelation).toHaveBeenCalledWith(AP_ID, FORMATEUR_ID);
    });

    it('un AP sans relation ne voit aucun exercice', async () => {
      exerciseRepo.find.mockResolvedValue([buildSampleExercise({ authorId: FORMATEUR_ID })]);
      profileRelationsClient.hasAnimatorOfTeacherRelation.mockResolvedValue(false);

      const result = await service.getPendingValidation(AP_ID, 'animateur_pedagogique');

      expect(result.total).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // removeExercise()
  // ─────────────────────────────────────────────────────────────────────

  describe('removeExercise()', () => {
    it('le RP peut retirer n\'importe quel exercice', async () => {
      const exercise = buildSampleExercise();
      exerciseRepo.findOne.mockResolvedValue(exercise);
      exerciseRepo.save.mockResolvedValue({ ...exercise, status: ContentStatus.REMOVED });

      await expect(
        service.removeExercise(EXERCISE_ID, OTHER_ID, 'responsable_pedagogique'),
      ).resolves.toBeUndefined();
      expect(exerciseRepo.save).toHaveBeenCalledWith(expect.objectContaining({ status: ContentStatus.REMOVED }));
    });

    it('l\'auteur peut retirer son propre exercice', async () => {
      const exercise = buildSampleExercise({ authorId: FORMATEUR_ID });
      exerciseRepo.findOne.mockResolvedValue(exercise);
      exerciseRepo.save.mockResolvedValue({ ...exercise, status: ContentStatus.REMOVED });

      await expect(service.removeExercise(EXERCISE_ID, FORMATEUR_ID, 'formateur')).resolves.toBeUndefined();
    });

    it('lève ForbiddenException si un autre formateur tente de retirer l\'exercice', async () => {
      exerciseRepo.findOne.mockResolvedValue(buildSampleExercise({ authorId: FORMATEUR_ID }));

      await expect(service.removeExercise(EXERCISE_ID, OTHER_ID, 'formateur')).rejects.toThrow(ForbiddenException);
    });

    it('lève NotFoundException si l\'exercice est introuvable', async () => {
      exerciseRepo.findOne.mockResolvedValue(null);

      await expect(service.removeExercise(EXERCISE_ID, FORMATEUR_ID, 'formateur')).rejects.toThrow(NotFoundException);
    });
  });
});
