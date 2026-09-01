/**
 * Unit tests — ValidationsService, scoping AP par relation animator_of_teacher
 * appliqué à ContentType.EVALUATION (arbitrage du 2026-09-01, "Refonte des
 * Evaluations", point 5 : "cette restriction est levée par le présent
 * arbitrage" — révise la note du 2026-08-28 qui limitait volontairement ce
 * scoping au Quizz). Miroir de validations.service.exercise-scoping.spec.ts.
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
const EVALUATION_ID = 'eval-0000-4000-e000-eeeeeeeeeeee';

function buildMockRepo() {
  return { create: jest.fn(), save: jest.fn(), find: jest.fn(), findOne: jest.fn(), findAndCount: jest.fn() };
}

function buildSampleEvaluation(overrides: Partial<Evaluation> = {}): Evaluation {
  return {
    id: EVALUATION_ID,
    title: 'Évaluation test',
    description: null,
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
    status: ContentStatus.PENDING_VALIDATION,
    shareableLink: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Evaluation;
}

describe('ValidationsService — scoping AP (ContentType.EVALUATION)', () => {
  let validationsService: ValidationsService;
  let validationRepo: ReturnType<typeof buildMockRepo>;
  let evaluationRepo: ReturnType<typeof buildMockRepo>;
  let profileRelationsClient: { hasAnimatorOfTeacherRelation: jest.Mock };

  beforeEach(async () => {
    validationRepo = buildMockRepo();
    evaluationRepo = buildMockRepo();
    profileRelationsClient = { hasAnimatorOfTeacherRelation: jest.fn() };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        ValidationsService,
        { provide: getRepositoryToken(ContentValidation), useValue: validationRepo },
        { provide: getRepositoryToken(Exercise), useValue: buildMockRepo() },
        { provide: getRepositoryToken(Evaluation), useValue: evaluationRepo },
        { provide: getRepositoryToken(Tutorial), useValue: buildMockRepo() },
        { provide: getRepositoryToken(Quiz), useValue: buildMockRepo() },
        { provide: ProfileRelationsClient, useValue: profileRelationsClient },
      ],
    }).compile();

    validationsService = moduleRef.get<ValidationsService>(ValidationsService);
  });

  afterEach(() => jest.clearAllMocks());

  it('un AP qui anime le formateur auteur peut valider son évaluation', async () => {
    evaluationRepo.findOne.mockResolvedValue(buildSampleEvaluation());
    evaluationRepo.save.mockResolvedValue({});
    profileRelationsClient.hasAnimatorOfTeacherRelation.mockResolvedValue(true);
    const savedValidation = { id: 'val-eval-0001', decision: ContentStatus.VALIDATED };
    validationRepo.create.mockReturnValue(savedValidation);
    validationRepo.save.mockResolvedValue(savedValidation);

    const result = await validationsService.validateContent(
      EVALUATION_ID,
      ContentType.EVALUATION,
      { decision: ContentStatus.VALIDATED },
      AP_ID,
      'animateur_pedagogique',
    );

    expect(result.decision).toBe(ContentStatus.VALIDATED);
    expect(profileRelationsClient.hasAnimatorOfTeacherRelation).toHaveBeenCalledWith(AP_ID, FORMATEUR_ID);
  });

  it("lève ForbiddenException si l'AP n'anime pas le formateur auteur", async () => {
    evaluationRepo.findOne.mockResolvedValue(buildSampleEvaluation());
    profileRelationsClient.hasAnimatorOfTeacherRelation.mockResolvedValue(false);

    await expect(
      validationsService.validateContent(
        EVALUATION_ID,
        ContentType.EVALUATION,
        { decision: ContentStatus.VALIDATED },
        AP_ID,
        'animateur_pedagogique',
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('propage une ServiceUnavailableException si profile-service est injoignable', async () => {
    evaluationRepo.findOne.mockResolvedValue(buildSampleEvaluation());
    profileRelationsClient.hasAnimatorOfTeacherRelation.mockRejectedValue(
      new ServiceUnavailableException('profile-service injoignable'),
    );

    await expect(
      validationsService.validateContent(
        EVALUATION_ID,
        ContentType.EVALUATION,
        { decision: ContentStatus.VALIDATED },
        AP_ID,
        'animateur_pedagogique',
      ),
    ).rejects.toThrow(ServiceUnavailableException);
  });

  it("un RP valide sans jamais consulter la relation, même sans lien avec l'auteur", async () => {
    evaluationRepo.findOne.mockResolvedValue(buildSampleEvaluation());
    evaluationRepo.save.mockResolvedValue({});
    const savedValidation = { id: 'val-eval-0002', decision: ContentStatus.VALIDATED };
    validationRepo.create.mockReturnValue(savedValidation);
    validationRepo.save.mockResolvedValue(savedValidation);
    profileRelationsClient.hasAnimatorOfTeacherRelation.mockResolvedValue(false);

    const result = await validationsService.validateContent(
      EVALUATION_ID,
      ContentType.EVALUATION,
      { decision: ContentStatus.VALIDATED },
      RP_ID,
      'responsable_pedagogique',
    );

    expect(result.decision).toBe(ContentStatus.VALIDATED);
    expect(profileRelationsClient.hasAnimatorOfTeacherRelation).not.toHaveBeenCalled();
  });

  it("lève NotFoundException si l'évaluation visée par la validation AP est introuvable", async () => {
    evaluationRepo.findOne.mockResolvedValue(null);

    await expect(
      validationsService.validateContent(
        'unknown-eval',
        ContentType.EVALUATION,
        { decision: ContentStatus.VALIDATED },
        AP_ID,
        'animateur_pedagogique',
      ),
    ).rejects.toThrow('Évaluation unknown-eval introuvable');
    expect(profileRelationsClient.hasAnimatorOfTeacherRelation).not.toHaveBeenCalled();
  });
});
