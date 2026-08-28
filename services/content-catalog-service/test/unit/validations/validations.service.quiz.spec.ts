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
import { ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { ValidationsService } from '../../../src/validations/validations.service';
import { ContentValidation } from '../../../src/validations/entities/content-validation.entity';
import { Exercise } from '../../../src/exercises/entities/exercise.entity';
import { Evaluation } from '../../../src/evaluations/entities/evaluation.entity';
import { Tutorial } from '../../../src/tutorials/entities/tutorial.entity';
import { Quiz } from '../../../src/quizzes/entities/quiz.entity';
import { ContentType } from '../../../src/common/enums/content-type.enum';
import { ContentStatus } from '../../../src/common/enums/content-status.enum';

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

  beforeEach(async () => {
    validationRepo = buildMockRepo();
    quizRepo = buildMockRepo();

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        ValidationsService,
        { provide: getRepositoryToken(ContentValidation), useValue: validationRepo },
        { provide: getRepositoryToken(Exercise), useValue: buildMockRepo() },
        { provide: getRepositoryToken(Evaluation), useValue: buildMockRepo() },
        { provide: getRepositoryToken(Tutorial), useValue: buildMockRepo() },
        { provide: getRepositoryToken(Quiz), useValue: quizRepo },
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
});
