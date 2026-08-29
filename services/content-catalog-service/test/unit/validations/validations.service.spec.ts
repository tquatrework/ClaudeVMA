/**
 * Unit tests — ValidationsService
 *
 * Couvre :
 *   - validateContent()    → réservé AP/RP, commentaire obligatoire en rejet, met à jour le statut
 *   - requestValidation()  → réservé formateurs/AP/RP, passe à pending_validation
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { ValidationsService } from '../../../src/validations/validations.service';
import { ContentValidation } from '../../../src/validations/entities/content-validation.entity';
import { Exercise } from '../../../src/exercises/entities/exercise.entity';
import { Evaluation } from '../../../src/evaluations/entities/evaluation.entity';
import { Tutorial } from '../../../src/tutorials/entities/tutorial.entity';
import { Quiz } from '../../../src/quizzes/entities/quiz.entity';
import { ContentType } from '../../../src/common/enums/content-type.enum';
import { ContentStatus } from '../../../src/common/enums/content-status.enum';
import { ProfileRelationsClient } from '../../../src/common/clients/profile-relations.client';

const AP_ID         = 'ap00-0000-4000-a000-aaaaaaaaaaaa';
const RP_ID         = 'rp00-0000-4000-b000-bbbbbbbbbbbb';
const FORMATEUR_ID  = 'form-0000-4000-c000-cccccccccccc';
const ELEVE_ID      = 'elev-0000-4000-d000-dddddddddddd';
const EXERCISE_ID   = 'exer-0000-4000-e000-eeeeeeeeeeee';

function buildMockRepo() {
  return {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    findAndCount: jest.fn(),
  };
}

function buildSampleExercise(overrides: Partial<Exercise> = {}): Exercise {
  return {
    id: EXERCISE_ID,
    title: 'Exercice test',
    description: null,
    level: 'seconde',
    difficulty: 'moyen',
    theme: 'algèbre',
    competencies: [],
    tags: [],
    authorId: FORMATEUR_ID,
    authorRole: 'formateur',
    status: ContentStatus.DRAFT,
    shareableLink: null,
    parts: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Exercise;
}

describe('ValidationsService', () => {
  let validationsService: ValidationsService;
  let validationRepo: ReturnType<typeof buildMockRepo>;
  let exerciseRepo: ReturnType<typeof buildMockRepo>;
  let evaluationRepo: ReturnType<typeof buildMockRepo>;
  let tutorialRepo: ReturnType<typeof buildMockRepo>;
  let quizRepo: ReturnType<typeof buildMockRepo>;
  let profileRelationsClient: { hasAnimatorOfTeacherRelation: jest.Mock };

  beforeEach(async () => {
    validationRepo = buildMockRepo();
    exerciseRepo = buildMockRepo();
    evaluationRepo = buildMockRepo();
    tutorialRepo = buildMockRepo();
    quizRepo = buildMockRepo();
    profileRelationsClient = { hasAnimatorOfTeacherRelation: jest.fn() };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        ValidationsService,
        { provide: getRepositoryToken(ContentValidation), useValue: validationRepo },
        { provide: getRepositoryToken(Exercise), useValue: exerciseRepo },
        { provide: getRepositoryToken(Evaluation), useValue: evaluationRepo },
        { provide: getRepositoryToken(Tutorial), useValue: tutorialRepo },
        { provide: getRepositoryToken(Quiz), useValue: quizRepo },
        { provide: ProfileRelationsClient, useValue: profileRelationsClient },
      ],
    }).compile();

    validationsService = moduleRef.get<ValidationsService>(ValidationsService);
  });

  afterEach(() => jest.clearAllMocks());

  // ─────────────────────────────────────────────────────────────────────────
  // validateContent()
  // ─────────────────────────────────────────────────────────────────────────

  describe('validateContent()', () => {
    it('l\'AP qui anime le formateur auteur peut valider un exercice (arbitrage du 2026-08-29)', async () => {
      exerciseRepo.findOne.mockResolvedValue(buildSampleExercise({ status: ContentStatus.PENDING_VALIDATION }));
      exerciseRepo.save.mockResolvedValue({});
      profileRelationsClient.hasAnimatorOfTeacherRelation.mockResolvedValue(true);
      const savedValidation = { id: 'val-0001', decision: ContentStatus.VALIDATED };
      validationRepo.create.mockReturnValue(savedValidation);
      validationRepo.save.mockResolvedValue(savedValidation);

      const result = await validationsService.validateContent(
        EXERCISE_ID,
        ContentType.EXERCISE,
        { decision: ContentStatus.VALIDATED },
        AP_ID,
        'animateur_pedagogique',
      );

      expect(result.decision).toBe(ContentStatus.VALIDATED);
      expect(profileRelationsClient.hasAnimatorOfTeacherRelation).toHaveBeenCalledWith(AP_ID, FORMATEUR_ID);
    });

    it('lève ForbiddenException si l\'AP n\'anime pas le formateur auteur de l\'exercice', async () => {
      exerciseRepo.findOne.mockResolvedValue(buildSampleExercise({ status: ContentStatus.PENDING_VALIDATION }));
      profileRelationsClient.hasAnimatorOfTeacherRelation.mockResolvedValue(false);

      await expect(
        validationsService.validateContent(
          EXERCISE_ID,
          ContentType.EXERCISE,
          { decision: ContentStatus.VALIDATED },
          AP_ID,
          'animateur_pedagogique',
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lève ForbiddenException si un formateur tente de valider', async () => {
      await expect(
        validationsService.validateContent(
          EXERCISE_ID,
          ContentType.EXERCISE,
          { decision: ContentStatus.VALIDATED },
          FORMATEUR_ID,
          'formateur',
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lève ForbiddenException si un élève tente de valider', async () => {
      await expect(
        validationsService.validateContent(
          EXERCISE_ID,
          ContentType.EXERCISE,
          { decision: ContentStatus.VALIDATED },
          ELEVE_ID,
          'eleve',
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lève BadRequestException si le rejet n\'a pas de commentaire', async () => {
      await expect(
        validationsService.validateContent(
          EXERCISE_ID,
          ContentType.EXERCISE,
          { decision: ContentStatus.REJECTED },
          RP_ID,
          'responsable_pedagogique',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('permet le rejet avec un commentaire', async () => {
      exerciseRepo.findOne.mockResolvedValue(buildSampleExercise({ status: ContentStatus.PENDING_VALIDATION }));
      exerciseRepo.save.mockResolvedValue({});
      const savedValidation = { id: 'val-0002', decision: ContentStatus.REJECTED, comment: 'Non conforme' };
      validationRepo.create.mockReturnValue(savedValidation);
      validationRepo.save.mockResolvedValue(savedValidation);

      const result = await validationsService.validateContent(
        EXERCISE_ID,
        ContentType.EXERCISE,
        { decision: ContentStatus.REJECTED, comment: 'Non conforme' },
        RP_ID,
        'responsable_pedagogique',
      );

      expect(result.decision).toBe(ContentStatus.REJECTED);
    });

    it('lève NotFoundException si l\'exercice est introuvable', async () => {
      exerciseRepo.findOne.mockResolvedValue(null);

      await expect(
        validationsService.validateContent(
          EXERCISE_ID,
          ContentType.EXERCISE,
          { decision: ContentStatus.VALIDATED },
          AP_ID,
          'animateur_pedagogique',
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // requestValidation()
  // ─────────────────────────────────────────────────────────────────────────

  describe('requestValidation()', () => {
    it('un formateur peut soumettre son exercice à validation', async () => {
      exerciseRepo.findOne.mockResolvedValue(buildSampleExercise({ status: ContentStatus.DRAFT }));
      exerciseRepo.save.mockResolvedValue({});

      await expect(
        validationsService.requestValidation(
          EXERCISE_ID,
          ContentType.EXERCISE,
          FORMATEUR_ID,
          'formateur',
        ),
      ).resolves.toBeUndefined();

      expect(exerciseRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: ContentStatus.PENDING_VALIDATION }),
      );
    });

    it('lève ForbiddenException si un élève tente de soumettre à validation', async () => {
      await expect(
        validationsService.requestValidation(
          EXERCISE_ID,
          ContentType.EXERCISE,
          ELEVE_ID,
          'eleve',
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lève NotFoundException si l\'exercice est introuvable', async () => {
      exerciseRepo.findOne.mockResolvedValue(null);

      await expect(
        validationsService.requestValidation(
          EXERCISE_ID,
          ContentType.EXERCISE,
          FORMATEUR_ID,
          'formateur',
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
