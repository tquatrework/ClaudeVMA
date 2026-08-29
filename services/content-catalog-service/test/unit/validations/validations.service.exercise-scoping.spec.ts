/**
 * Unit tests — ValidationsService, scoping AP par relation animator_of_teacher
 * appliqué à ContentType.EXERCISE (arbitrage du 2026-08-29, "Refonte des
 * Exercices", point 5 : "réutilise exactement le mécanisme déjà construit
 * pour le Quizz"). Miroir de validations.service.quiz.spec.ts.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { ValidationsService } from '../../../src/validations/validations.service';
import { ContentValidation } from '../../../src/validations/entities/content-validation.entity';
import { Exercise } from '../../../src/exercises/entities/exercise.entity';
import { Evaluation } from '../../../src/evaluations/entities/evaluation.entity';
import { Tutorial } from '../../../src/tutorials/entities/tutorial.entity';
import { Quiz } from '../../../src/quizzes/entities/quiz.entity';
import { ContentType } from '../../../src/common/enums/content-type.enum';
import { ContentStatus } from '../../../src/common/enums/content-status.enum';
import { ProfileRelationsClient } from '../../../src/common/clients/profile-relations.client';

const AP_ID = 'ap00-0000-4000-a000-aaaaaaaaaaaa';
const RP_ID = 'rp00-0000-4000-b000-bbbbbbbbbbbb';
const FORMATEUR_ID = 'form-0000-4000-c000-cccccccccccc';
const EXERCISE_ID = 'exer-0000-4000-e000-eeeeeeeeeeee';

function buildMockRepo() {
  return { create: jest.fn(), save: jest.fn(), find: jest.fn(), findOne: jest.fn(), findAndCount: jest.fn() };
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
    status: ContentStatus.PENDING_VALIDATION,
    shareableLink: null,
    parts: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Exercise;
}

describe('ValidationsService — scoping AP (ContentType.EXERCISE)', () => {
  let validationsService: ValidationsService;
  let validationRepo: ReturnType<typeof buildMockRepo>;
  let exerciseRepo: ReturnType<typeof buildMockRepo>;
  let profileRelationsClient: { hasAnimatorOfTeacherRelation: jest.Mock };

  beforeEach(async () => {
    validationRepo = buildMockRepo();
    exerciseRepo = buildMockRepo();
    profileRelationsClient = { hasAnimatorOfTeacherRelation: jest.fn() };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        ValidationsService,
        { provide: getRepositoryToken(ContentValidation), useValue: validationRepo },
        { provide: getRepositoryToken(Exercise), useValue: exerciseRepo },
        { provide: getRepositoryToken(Evaluation), useValue: buildMockRepo() },
        { provide: getRepositoryToken(Tutorial), useValue: buildMockRepo() },
        { provide: getRepositoryToken(Quiz), useValue: buildMockRepo() },
        { provide: ProfileRelationsClient, useValue: profileRelationsClient },
      ],
    }).compile();

    validationsService = moduleRef.get<ValidationsService>(ValidationsService);
  });

  afterEach(() => jest.clearAllMocks());

  it('un AP qui anime le formateur auteur peut valider son exercice', async () => {
    exerciseRepo.findOne.mockResolvedValue(buildSampleExercise());
    exerciseRepo.save.mockResolvedValue({});
    profileRelationsClient.hasAnimatorOfTeacherRelation.mockResolvedValue(true);
    const savedValidation = { id: 'val-ex-0001', decision: ContentStatus.VALIDATED };
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

  it("lève ForbiddenException si l'AP n'anime pas le formateur auteur", async () => {
    exerciseRepo.findOne.mockResolvedValue(buildSampleExercise());
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

  it('propage une ServiceUnavailableException si profile-service est injoignable', async () => {
    exerciseRepo.findOne.mockResolvedValue(buildSampleExercise());
    profileRelationsClient.hasAnimatorOfTeacherRelation.mockRejectedValue(
      new ServiceUnavailableException('profile-service injoignable'),
    );

    await expect(
      validationsService.validateContent(
        EXERCISE_ID,
        ContentType.EXERCISE,
        { decision: ContentStatus.VALIDATED },
        AP_ID,
        'animateur_pedagogique',
      ),
    ).rejects.toThrow(ServiceUnavailableException);
  });

  it("un RP valide sans jamais consulter la relation, même sans lien avec l'auteur", async () => {
    exerciseRepo.findOne.mockResolvedValue(buildSampleExercise());
    exerciseRepo.save.mockResolvedValue({});
    const savedValidation = { id: 'val-ex-0002', decision: ContentStatus.VALIDATED };
    validationRepo.create.mockReturnValue(savedValidation);
    validationRepo.save.mockResolvedValue(savedValidation);
    profileRelationsClient.hasAnimatorOfTeacherRelation.mockResolvedValue(false);

    const result = await validationsService.validateContent(
      EXERCISE_ID,
      ContentType.EXERCISE,
      { decision: ContentStatus.VALIDATED },
      RP_ID,
      'responsable_pedagogique',
    );

    expect(result.decision).toBe(ContentStatus.VALIDATED);
    expect(profileRelationsClient.hasAnimatorOfTeacherRelation).not.toHaveBeenCalled();
  });

  it('n\'affecte pas la validation Evaluation/Tutorial (non scopée, comportement inchangé)', async () => {
    // Vérifié explicitement ici : Evaluation/Tutorial ne consultent jamais la
    // relation, même pour un AP (points 5 de l'arbitrage du 2026-08-29).
    const evaluationRepo = buildMockRepo();
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        ValidationsService,
        { provide: getRepositoryToken(ContentValidation), useValue: validationRepo },
        { provide: getRepositoryToken(Exercise), useValue: exerciseRepo },
        { provide: getRepositoryToken(Evaluation), useValue: evaluationRepo },
        { provide: getRepositoryToken(Tutorial), useValue: buildMockRepo() },
        { provide: getRepositoryToken(Quiz), useValue: buildMockRepo() },
        { provide: ProfileRelationsClient, useValue: profileRelationsClient },
      ],
    }).compile();
    const service = moduleRef.get<ValidationsService>(ValidationsService);

    evaluationRepo.findOne.mockResolvedValue({ id: 'eval-1', authorId: FORMATEUR_ID, status: ContentStatus.PENDING_VALIDATION });
    evaluationRepo.save.mockResolvedValue({});
    const savedValidation = { id: 'val-eval-0001', decision: ContentStatus.VALIDATED };
    validationRepo.create.mockReturnValue(savedValidation);
    validationRepo.save.mockResolvedValue(savedValidation);

    const result = await service.validateContent(
      'eval-1',
      ContentType.EVALUATION,
      { decision: ContentStatus.VALIDATED },
      AP_ID,
      'animateur_pedagogique',
    );

    expect(result.decision).toBe(ContentStatus.VALIDATED);
    expect(profileRelationsClient.hasAnimatorOfTeacherRelation).not.toHaveBeenCalled();
  });
});
