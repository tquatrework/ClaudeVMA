/**
 * Unit tests — ValidationsService, couverture ContentType.QUIZ
 *
 * Couvre le réemploi du flux de validation générique (AP/RP) pour les
 * quizz, sur le même modèle que exercise/evaluation/tutorial :
 *   - requestValidation() → un professeur peut soumettre son quizz
 *   - validateContent()   → AP/RP peuvent valider ou rejeter, commentaire
 *                            obligatoire en cas de rejet
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ValidationsService } from '../../../src/validations/validations.service';
import { ContentValidation } from '../../../src/validations/entities/content-validation.entity';
import { Exercise } from '../../../src/exercises/entities/exercise.entity';
import { Evaluation } from '../../../src/evaluations/entities/evaluation.entity';
import { Tutorial } from '../../../src/tutorials/entities/tutorial.entity';
import { Quiz } from '../../../src/quizzes/entities/quiz.entity';
import { ContentType } from '../../../src/common/enums/content-type.enum';
import { ContentStatus } from '../../../src/common/enums/content-status.enum';
import { ProfileRelationsClient } from '../../../src/common/clients/profile-relations.client';

const AP_ID        = 'ap00-0000-4000-a000-aaaaaaaaaaaa';
const RP_ID        = 'rp00-0000-4000-b000-bbbbbbbbbbbb';
const FORMATEUR_ID = 'form-0000-4000-c000-cccccccccccc';
const ELEVE_ID     = 'elev-0000-4000-d000-dddddddddddd';
const QUIZ_ID      = 'quiz-0000-4000-e000-eeeeeeeeeeee';

function buildMockRepo() {
  return {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    findAndCount: jest.fn(),
  };
}

function buildSampleQuiz(overrides: Partial<Quiz> = {}): Quiz {
  return {
    id: QUIZ_ID,
    title: 'Quizz test',
    description: null,
    tags: ['algèbre'],
    authorId: FORMATEUR_ID,
    authorRole: 'formateur',
    status: ContentStatus.PENDING_VALIDATION,
    defaultPoints: 1,
    penaltyEnabled: false,
    penaltyPoints: null,
    shareableLink: null,
    questions: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Quiz;
}

describe('ValidationsService — ContentType.QUIZ', () => {
  let validationsService: ValidationsService;
  let validationRepo: ReturnType<typeof buildMockRepo>;
  let quizRepo: ReturnType<typeof buildMockRepo>;
  let profileRelationsClient: { hasAnimatorOfTeacherRelation: jest.Mock };

  beforeEach(async () => {
    validationRepo = buildMockRepo();
    quizRepo = buildMockRepo();
    profileRelationsClient = { hasAnimatorOfTeacherRelation: jest.fn() };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        ValidationsService,
        { provide: getRepositoryToken(ContentValidation), useValue: validationRepo },
        { provide: getRepositoryToken(Exercise), useValue: buildMockRepo() },
        { provide: getRepositoryToken(Evaluation), useValue: buildMockRepo() },
        { provide: getRepositoryToken(Tutorial), useValue: buildMockRepo() },
        { provide: getRepositoryToken(Quiz), useValue: quizRepo },
        { provide: ProfileRelationsClient, useValue: profileRelationsClient },
      ],
    }).compile();

    validationsService = moduleRef.get<ValidationsService>(ValidationsService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('requestValidation() — quizz', () => {
    it('un formateur peut soumettre son quizz à validation', async () => {
      quizRepo.findOne.mockResolvedValue(buildSampleQuiz());
      quizRepo.save.mockResolvedValue({});

      await expect(
        validationsService.requestValidation(QUIZ_ID, ContentType.QUIZ, FORMATEUR_ID, 'formateur'),
      ).resolves.toBeUndefined();

      expect(quizRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: ContentStatus.PENDING_VALIDATION }),
      );
    });

    it('lève ForbiddenException si un élève tente de soumettre un quizz à validation', async () => {
      await expect(
        validationsService.requestValidation(QUIZ_ID, ContentType.QUIZ, ELEVE_ID, 'eleve'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lève NotFoundException si le quizz est introuvable', async () => {
      quizRepo.findOne.mockResolvedValue(null);

      await expect(
        validationsService.requestValidation(QUIZ_ID, ContentType.QUIZ, FORMATEUR_ID, 'formateur'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('validateContent() — quizz', () => {
    it('un RP peut valider un quizz créé par un professeur', async () => {
      quizRepo.findOne.mockResolvedValue(buildSampleQuiz());
      quizRepo.save.mockResolvedValue({});
      const savedValidation = { id: 'val-quiz-0001', decision: ContentStatus.VALIDATED };
      validationRepo.create.mockReturnValue(savedValidation);
      validationRepo.save.mockResolvedValue(savedValidation);

      const result = await validationsService.validateContent(
        QUIZ_ID,
        ContentType.QUIZ,
        { decision: ContentStatus.VALIDATED },
        RP_ID,
        'responsable_pedagogique',
      );

      expect(result.decision).toBe(ContentStatus.VALIDATED);
      expect(quizRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: ContentStatus.VALIDATED }),
      );
      expect(profileRelationsClient.hasAnimatorOfTeacherRelation).not.toHaveBeenCalled();
    });

    it('lève ForbiddenException si un formateur tente de valider un quizz', async () => {
      await expect(
        validationsService.validateContent(
          QUIZ_ID,
          ContentType.QUIZ,
          { decision: ContentStatus.VALIDATED },
          FORMATEUR_ID,
          'formateur',
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lève BadRequestException si le rejet d\'un quizz n\'a pas de commentaire', async () => {
      await expect(
        validationsService.validateContent(
          QUIZ_ID,
          ContentType.QUIZ,
          { decision: ContentStatus.REJECTED },
          AP_ID,
          'animateur_pedagogique',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('lève NotFoundException si le quizz est introuvable', async () => {
      quizRepo.findOne.mockResolvedValue(null);

      await expect(
        validationsService.validateContent(
          QUIZ_ID,
          ContentType.QUIZ,
          { decision: ContentStatus.VALIDATED },
          AP_ID,
          'animateur_pedagogique',
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('validateContent() — scoping AP par relation animator_of_teacher', () => {
    it('un AP qui anime le formateur auteur peut valider son quizz', async () => {
      quizRepo.findOne.mockResolvedValue(buildSampleQuiz());
      quizRepo.save.mockResolvedValue({});
      const savedValidation = { id: 'val-quiz-0002', decision: ContentStatus.VALIDATED };
      validationRepo.create.mockReturnValue(savedValidation);
      validationRepo.save.mockResolvedValue(savedValidation);
      profileRelationsClient.hasAnimatorOfTeacherRelation.mockResolvedValue(true);

      const result = await validationsService.validateContent(
        QUIZ_ID,
        ContentType.QUIZ,
        { decision: ContentStatus.VALIDATED },
        AP_ID,
        'animateur_pedagogique',
      );

      expect(result.decision).toBe(ContentStatus.VALIDATED);
      expect(profileRelationsClient.hasAnimatorOfTeacherRelation).toHaveBeenCalledWith(
        AP_ID,
        FORMATEUR_ID,
      );
    });

    it('lève ForbiddenException si l\'AP n\'anime pas le formateur auteur', async () => {
      quizRepo.findOne.mockResolvedValue(buildSampleQuiz());
      profileRelationsClient.hasAnimatorOfTeacherRelation.mockResolvedValue(false);

      await expect(
        validationsService.validateContent(
          QUIZ_ID,
          ContentType.QUIZ,
          { decision: ContentStatus.VALIDATED },
          AP_ID,
          'animateur_pedagogique',
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('propage une ServiceUnavailableException si profile-service est injoignable', async () => {
      quizRepo.findOne.mockResolvedValue(buildSampleQuiz());
      profileRelationsClient.hasAnimatorOfTeacherRelation.mockRejectedValue(
        new ServiceUnavailableException('profile-service injoignable'),
      );

      await expect(
        validationsService.validateContent(
          QUIZ_ID,
          ContentType.QUIZ,
          { decision: ContentStatus.VALIDATED },
          AP_ID,
          'animateur_pedagogique',
        ),
      ).rejects.toThrow(ServiceUnavailableException);
    });

    it('un RP valide sans jamais consulter la relation, même sans lien avec l\'auteur', async () => {
      quizRepo.findOne.mockResolvedValue(buildSampleQuiz());
      quizRepo.save.mockResolvedValue({});
      const savedValidation = { id: 'val-quiz-0003', decision: ContentStatus.VALIDATED };
      validationRepo.create.mockReturnValue(savedValidation);
      validationRepo.save.mockResolvedValue(savedValidation);
      profileRelationsClient.hasAnimatorOfTeacherRelation.mockResolvedValue(false);

      const result = await validationsService.validateContent(
        QUIZ_ID,
        ContentType.QUIZ,
        { decision: ContentStatus.VALIDATED },
        RP_ID,
        'responsable_pedagogique',
      );

      expect(result.decision).toBe(ContentStatus.VALIDATED);
      expect(profileRelationsClient.hasAnimatorOfTeacherRelation).not.toHaveBeenCalled();
    });
  });

  describe('getValidationHistory() — auteur formateur d\'un quizz refusé (2026-08-28)', () => {
    it('l\'auteur formateur peut relire le motif de son propre refus', async () => {
      quizRepo.findOne.mockResolvedValue(buildSampleQuiz({ authorId: FORMATEUR_ID }));
      validationRepo.find.mockResolvedValue([
        {
          id: 'val-quiz-hist-001',
          decision: ContentStatus.REJECTED,
          comment: 'Barème incohérent',
        },
      ]);

      const result = await validationsService.getValidationHistory(
        QUIZ_ID,
        ContentType.QUIZ,
        FORMATEUR_ID,
        'formateur',
      );

      expect(result).toHaveLength(1);
      expect(result[0].comment).toBe('Barème incohérent');
    });

    it('lève ForbiddenException si un formateur tente de lire l\'historique du quizz d\'un tiers', async () => {
      quizRepo.findOne.mockResolvedValue(buildSampleQuiz({ authorId: AP_ID }));

      await expect(
        validationsService.getValidationHistory(QUIZ_ID, ContentType.QUIZ, FORMATEUR_ID, 'formateur'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('un AP/RP/TI conserve un accès non restreint à l\'historique du quizz', async () => {
      validationRepo.find.mockResolvedValue([]);

      await validationsService.getValidationHistory(QUIZ_ID, ContentType.QUIZ, RP_ID, 'responsable_pedagogique');

      expect(quizRepo.findOne).not.toHaveBeenCalled();
    });
  });
});
