/**
 * Unit tests — ValidationsService, scoping AP par relation animator_of_teacher
 * appliqué à ContentType.TUTORIAL (arbitrage du 2026-09-03, "Refonte des
 * Tutos/Vidéos", point 7 : "réutiliser exactement le mécanisme déjà construit
 * pour Quizz/Exercice/Évaluation"). Miroir de
 * validations.service.exercise-scoping.spec.ts. Remplace le comportement
 * "non scopé" précédemment couvert dans ce même fichier avant cette date.
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
import { TutorialFormat } from '../../../src/tutorials/enums/tutorial-format.enum';
import { ProfileRelationsClient } from '../../../src/common/clients/profile-relations.client';

const AP_ID = 'ap00-0000-4000-a000-aaaaaaaaaaaa';
const RP_ID = 'rp00-0000-4000-b000-bbbbbbbbbbbb';
const FORMATEUR_ID = 'form-0000-4000-c000-cccccccccccc';
const TUTORIAL_ID = 'tuto-0000-4000-e000-eeeeeeeeeeee';

function buildMockRepo() {
  return { create: jest.fn(), save: jest.fn(), find: jest.fn(), findOne: jest.fn(), findAndCount: jest.fn() };
}

function buildSampleTutorial(overrides: Partial<Tutorial> = {}): Tutorial {
  return {
    id: TUTORIAL_ID,
    title: 'Tutoriel test',
    description: null,
    theme: 'algèbre',
    tags: [],
    level: 'seconde',
    difficulty: 'moyen',
    competencies: [],
    format: TutorialFormat.POST,
    videoUrl: null,
    linkedQuizId: null,
    authorId: FORMATEUR_ID,
    authorRole: 'formateur',
    status: ContentStatus.PENDING_VALIDATION,
    shareableLink: null,
    blocks: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Tutorial;
}

describe('ValidationsService — scoping AP (ContentType.TUTORIAL)', () => {
  let validationsService: ValidationsService;
  let validationRepo: ReturnType<typeof buildMockRepo>;
  let tutorialRepo: ReturnType<typeof buildMockRepo>;
  let profileRelationsClient: { hasAnimatorOfTeacherRelation: jest.Mock };

  beforeEach(async () => {
    validationRepo = buildMockRepo();
    tutorialRepo = buildMockRepo();
    profileRelationsClient = { hasAnimatorOfTeacherRelation: jest.fn() };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        ValidationsService,
        { provide: getRepositoryToken(ContentValidation), useValue: validationRepo },
        { provide: getRepositoryToken(Exercise), useValue: buildMockRepo() },
        { provide: getRepositoryToken(Evaluation), useValue: buildMockRepo() },
        { provide: getRepositoryToken(Tutorial), useValue: tutorialRepo },
        { provide: getRepositoryToken(Quiz), useValue: buildMockRepo() },
        { provide: ProfileRelationsClient, useValue: profileRelationsClient },
      ],
    }).compile();

    validationsService = moduleRef.get<ValidationsService>(ValidationsService);
  });

  afterEach(() => jest.clearAllMocks());

  it('un AP qui anime le formateur auteur peut valider son tutoriel', async () => {
    tutorialRepo.findOne.mockResolvedValue(buildSampleTutorial());
    tutorialRepo.save.mockResolvedValue({});
    profileRelationsClient.hasAnimatorOfTeacherRelation.mockResolvedValue(true);
    const savedValidation = { id: 'val-tuto-0001', decision: ContentStatus.VALIDATED };
    validationRepo.create.mockReturnValue(savedValidation);
    validationRepo.save.mockResolvedValue(savedValidation);

    const result = await validationsService.validateContent(
      TUTORIAL_ID,
      ContentType.TUTORIAL,
      { decision: ContentStatus.VALIDATED },
      AP_ID,
      'animateur_pedagogique',
    );

    expect(result.decision).toBe(ContentStatus.VALIDATED);
    expect(profileRelationsClient.hasAnimatorOfTeacherRelation).toHaveBeenCalledWith(AP_ID, FORMATEUR_ID);
  });

  it("lève ForbiddenException si l'AP n'anime pas le formateur auteur", async () => {
    tutorialRepo.findOne.mockResolvedValue(buildSampleTutorial());
    profileRelationsClient.hasAnimatorOfTeacherRelation.mockResolvedValue(false);

    await expect(
      validationsService.validateContent(
        TUTORIAL_ID,
        ContentType.TUTORIAL,
        { decision: ContentStatus.VALIDATED },
        AP_ID,
        'animateur_pedagogique',
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('propage une ServiceUnavailableException si profile-service est injoignable', async () => {
    tutorialRepo.findOne.mockResolvedValue(buildSampleTutorial());
    profileRelationsClient.hasAnimatorOfTeacherRelation.mockRejectedValue(
      new ServiceUnavailableException('profile-service injoignable'),
    );

    await expect(
      validationsService.validateContent(
        TUTORIAL_ID,
        ContentType.TUTORIAL,
        { decision: ContentStatus.VALIDATED },
        AP_ID,
        'animateur_pedagogique',
      ),
    ).rejects.toThrow(ServiceUnavailableException);
  });

  it("un RP valide sans jamais consulter la relation, même sans lien avec l'auteur", async () => {
    tutorialRepo.findOne.mockResolvedValue(buildSampleTutorial());
    tutorialRepo.save.mockResolvedValue({});
    const savedValidation = { id: 'val-tuto-0002', decision: ContentStatus.VALIDATED };
    validationRepo.create.mockReturnValue(savedValidation);
    validationRepo.save.mockResolvedValue(savedValidation);
    profileRelationsClient.hasAnimatorOfTeacherRelation.mockResolvedValue(false);

    const result = await validationsService.validateContent(
      TUTORIAL_ID,
      ContentType.TUTORIAL,
      { decision: ContentStatus.VALIDATED },
      RP_ID,
      'responsable_pedagogique',
    );

    expect(result.decision).toBe(ContentStatus.VALIDATED);
    expect(profileRelationsClient.hasAnimatorOfTeacherRelation).not.toHaveBeenCalled();
  });
});
