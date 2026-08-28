/**
 * Unit tests — ValidationsService (règles métier complémentaires)
 *
 * Couvre les règles métier non couvertes dans validations.service.spec.ts :
 *   - getValidationHistory() — historique des validations non testé
 *   - validateContent() sur évaluation et tutoriel (seul exercice couvert)
 *   - requestValidation() sur évaluation et tutoriel
 *   - Rejet avec commentaire sur évaluation et tutoriel
 *   - Workflow complet : soumission → décision → historique
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
import { TutorialType, TutorialFormat } from '../../../src/common/enums/content-type.enum';
import { ProfileRelationsClient } from '../../../src/common/clients/profile-relations.client';

const AP_ID        = 'ap00-0000-4000-a000-aaaaaaaaaaaa';
const RP_ID        = 'rp00-0000-4000-b000-bbbbbbbbbbbb';
const FORMATEUR_ID = 'form-0000-4000-c000-cccccccccccc';
const ELEVE_ID     = 'elev-0000-4000-d000-dddddddddddd';
const EXERCISE_ID  = 'exer-0000-4000-e000-eeeeeeeeeeee';
const EVALUATION_ID = 'eval-0000-4000-f000-ffffffffffff';
const TUTORIAL_ID  = 'tuto-0000-4000-g000-gggggggggggg';

function buildMockRepo() {
  return {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    findAndCount: jest.fn(),
  };
}

function buildSampleExercise(overrides = {}): Exercise {
  return {
    id: EXERCISE_ID,
    title: 'Exercice test',
    description: null,
    statement: 'Résoudre x^2 = 4',
    level: 'seconde',
    difficulty: 'moyen',
    theme: 'algèbre',
    competencies: [],
    tags: [],
    correctionCost: 5,
    authorId: FORMATEUR_ID,
    authorRole: 'formateur',
    status: ContentStatus.PENDING_VALIDATION,
    shareableLink: null,
    parts: [],
    answers: [],
    solutions: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function buildSampleEvaluation(overrides = {}): Evaluation {
  return {
    id: EVALUATION_ID,
    title: 'Évaluation test',
    description: null,
    exerciseItems: [{ exerciseId: EXERCISE_ID, order: 1 }],
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
    attempts: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function buildSampleTutorial(overrides = {}): Tutorial {
  return {
    id: TUTORIAL_ID,
    title: 'Tutoriel test',
    description: null,
    tutorialType: TutorialType.ACADEMIE,
    format: TutorialFormat.TEXTE,
    level: 'seconde',
    theme: 'algèbre',
    imageUrl: null,
    videoUrl: null,
    textContent: 'Contenu...',
    tags: [],
    relatedResourceIds: [],
    relatedEvaluationId: null,
    authorId: FORMATEUR_ID,
    authorRole: 'formateur',
    status: ContentStatus.PENDING_VALIDATION,
    shareableLink: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('ValidationsService — règles métier complémentaires', () => {
  let validationsService: ValidationsService;
  let validationRepo: ReturnType<typeof buildMockRepo>;
  let exerciseRepo: ReturnType<typeof buildMockRepo>;
  let evaluationRepo: ReturnType<typeof buildMockRepo>;
  let tutorialRepo: ReturnType<typeof buildMockRepo>;
  let quizRepo: ReturnType<typeof buildMockRepo>;

  beforeEach(async () => {
    validationRepo = buildMockRepo();
    exerciseRepo = buildMockRepo();
    evaluationRepo = buildMockRepo();
    tutorialRepo = buildMockRepo();
    quizRepo = buildMockRepo();

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        ValidationsService,
        { provide: getRepositoryToken(ContentValidation), useValue: validationRepo },
        { provide: getRepositoryToken(Exercise), useValue: exerciseRepo },
        { provide: getRepositoryToken(Evaluation), useValue: evaluationRepo },
        { provide: getRepositoryToken(Tutorial), useValue: tutorialRepo },
        { provide: getRepositoryToken(Quiz), useValue: quizRepo },
        { provide: ProfileRelationsClient, useValue: { hasAnimatorOfTeacherRelation: jest.fn() } },
      ],
    }).compile();

    validationsService = moduleRef.get<ValidationsService>(ValidationsService);
  });

  afterEach(() => jest.clearAllMocks());

  // ─────────────────────────────────────────────────────────────────────────
  // validateContent() — couverture pour évaluation et tutoriel
  // ─────────────────────────────────────────────────────────────────────────

  describe('validateContent() — évaluation', () => {
    it('l\'AP peut valider une évaluation', async () => {
      evaluationRepo.findOne.mockResolvedValue(buildSampleEvaluation());
      evaluationRepo.save.mockResolvedValue({});
      const savedValidation = { id: 'val-0001', decision: ContentStatus.VALIDATED };
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
    });

    it('lève BadRequestException si le rejet d\'une évaluation n\'a pas de commentaire', async () => {
      await expect(
        validationsService.validateContent(
          EVALUATION_ID,
          ContentType.EVALUATION,
          { decision: ContentStatus.REJECTED },
          RP_ID,
          'responsable_pedagogique',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('permet le rejet d\'une évaluation avec un commentaire', async () => {
      evaluationRepo.findOne.mockResolvedValue(buildSampleEvaluation());
      evaluationRepo.save.mockResolvedValue({});
      const savedValidation = { id: 'val-0002', decision: ContentStatus.REJECTED, comment: 'Contenu non conforme' };
      validationRepo.create.mockReturnValue(savedValidation);
      validationRepo.save.mockResolvedValue(savedValidation);

      const result = await validationsService.validateContent(
        EVALUATION_ID,
        ContentType.EVALUATION,
        { decision: ContentStatus.REJECTED, comment: 'Contenu non conforme' },
        RP_ID,
        'responsable_pedagogique',
      );

      expect(result.decision).toBe(ContentStatus.REJECTED);
    });

    it('lève NotFoundException si l\'évaluation est introuvable', async () => {
      evaluationRepo.findOne.mockResolvedValue(null);

      await expect(
        validationsService.validateContent(
          EVALUATION_ID,
          ContentType.EVALUATION,
          { decision: ContentStatus.VALIDATED },
          AP_ID,
          'animateur_pedagogique',
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('validateContent() — tutoriel', () => {
    it('l\'AP peut valider un tutoriel', async () => {
      tutorialRepo.findOne.mockResolvedValue(buildSampleTutorial());
      tutorialRepo.save.mockResolvedValue({});
      const savedValidation = { id: 'val-0003', decision: ContentStatus.VALIDATED };
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
    });

    it('lève BadRequestException si le rejet d\'un tutoriel n\'a pas de commentaire', async () => {
      await expect(
        validationsService.validateContent(
          TUTORIAL_ID,
          ContentType.TUTORIAL,
          { decision: ContentStatus.REJECTED },
          RP_ID,
          'responsable_pedagogique',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('lève NotFoundException si le tutoriel est introuvable', async () => {
      tutorialRepo.findOne.mockResolvedValue(null);

      await expect(
        validationsService.validateContent(
          TUTORIAL_ID,
          ContentType.TUTORIAL,
          { decision: ContentStatus.VALIDATED },
          RP_ID,
          'responsable_pedagogique',
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // requestValidation() — couverture pour évaluation et tutoriel
  // ─────────────────────────────────────────────────────────────────────────

  describe('requestValidation() — évaluation', () => {
    it('un formateur peut soumettre son évaluation à validation', async () => {
      evaluationRepo.findOne.mockResolvedValue(buildSampleEvaluation({ status: ContentStatus.DRAFT }));
      evaluationRepo.save.mockResolvedValue({});

      await expect(
        validationsService.requestValidation(
          EVALUATION_ID,
          ContentType.EVALUATION,
          FORMATEUR_ID,
          'formateur',
        ),
      ).resolves.toBeUndefined();

      expect(evaluationRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: ContentStatus.PENDING_VALIDATION }),
      );
    });

    it('lève ForbiddenException si un élève tente de soumettre une évaluation à validation', async () => {
      await expect(
        validationsService.requestValidation(
          EVALUATION_ID,
          ContentType.EVALUATION,
          ELEVE_ID,
          'eleve',
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lève NotFoundException si l\'évaluation est introuvable lors de la soumission', async () => {
      evaluationRepo.findOne.mockResolvedValue(null);

      await expect(
        validationsService.requestValidation(
          EVALUATION_ID,
          ContentType.EVALUATION,
          FORMATEUR_ID,
          'formateur',
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('requestValidation() — tutoriel', () => {
    it('un formateur peut soumettre son tutoriel à validation', async () => {
      tutorialRepo.findOne.mockResolvedValue(buildSampleTutorial({ status: ContentStatus.DRAFT }));
      tutorialRepo.save.mockResolvedValue({});

      await expect(
        validationsService.requestValidation(
          TUTORIAL_ID,
          ContentType.TUTORIAL,
          FORMATEUR_ID,
          'formateur',
        ),
      ).resolves.toBeUndefined();

      expect(tutorialRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: ContentStatus.PENDING_VALIDATION }),
      );
    });

    it('lève ForbiddenException si un parent tente de soumettre un tutoriel à validation', async () => {
      await expect(
        validationsService.requestValidation(
          TUTORIAL_ID,
          ContentType.TUTORIAL,
          'parent-id',
          'parent_financeur',
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lève NotFoundException si le tutoriel est introuvable lors de la soumission', async () => {
      tutorialRepo.findOne.mockResolvedValue(null);

      await expect(
        validationsService.requestValidation(
          TUTORIAL_ID,
          ContentType.TUTORIAL,
          FORMATEUR_ID,
          'formateur',
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // getValidationHistory() — historique non testé
  // ─────────────────────────────────────────────────────────────────────────

  describe('getValidationHistory()', () => {
    it('retourne l\'historique complet des validations pour un contenu donné', async () => {
      const historyEntries = [
        {
          id: 'val-hist-001',
          contentId: EXERCISE_ID,
          contentType: ContentType.EXERCISE,
          validatorId: AP_ID,
          decision: ContentStatus.REJECTED,
          comment: 'Première révision nécessaire',
          createdAt: new Date('2026-01-10T00:00:00Z'),
        },
        {
          id: 'val-hist-002',
          contentId: EXERCISE_ID,
          contentType: ContentType.EXERCISE,
          validatorId: RP_ID,
          decision: ContentStatus.VALIDATED,
          comment: null,
          createdAt: new Date('2026-01-15T00:00:00Z'),
        },
      ];
      validationRepo.find.mockResolvedValue(historyEntries);

      const result = await validationsService.getValidationHistory(
        EXERCISE_ID,
        ContentType.EXERCISE,
      );

      expect(result).toHaveLength(2);
      expect(validationRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            contentId: EXERCISE_ID,
            contentType: ContentType.EXERCISE,
          }),
        }),
      );
    });

    it('retourne un historique vide si aucune validation n\'a été effectuée', async () => {
      validationRepo.find.mockResolvedValue([]);

      const result = await validationsService.getValidationHistory(
        EXERCISE_ID,
        ContentType.EXERCISE,
      );

      expect(result).toHaveLength(0);
    });

    it('trie l\'historique par date de création décroissante (plus récent en premier)', async () => {
      validationRepo.find.mockResolvedValue([]);

      await validationsService.getValidationHistory(EXERCISE_ID, ContentType.EXERCISE);

      expect(validationRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          order: expect.objectContaining({ createdAt: 'DESC' }),
        }),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Workflow complet : soumission → décision AP → historique
  // ─────────────────────────────────────────────────────────────────────────

  describe('Workflow validation complet — soumission → décision', () => {
    it('met à jour le statut de l\'exercice en PENDING_VALIDATION lors de la soumission', async () => {
      const draftExercise = buildSampleExercise({ status: ContentStatus.DRAFT });
      exerciseRepo.findOne.mockResolvedValue(draftExercise);
      exerciseRepo.save.mockResolvedValue({ ...draftExercise, status: ContentStatus.PENDING_VALIDATION });

      await validationsService.requestValidation(
        EXERCISE_ID,
        ContentType.EXERCISE,
        FORMATEUR_ID,
        'formateur',
      );

      expect(exerciseRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: ContentStatus.PENDING_VALIDATION }),
      );
    });

    it('met à jour le statut de l\'exercice en VALIDATED après validation AP', async () => {
      const pendingExercise = buildSampleExercise({ status: ContentStatus.PENDING_VALIDATION });
      exerciseRepo.findOne.mockResolvedValue(pendingExercise);
      exerciseRepo.save.mockResolvedValue({ ...pendingExercise, status: ContentStatus.VALIDATED });
      const savedValidation = { id: 'val-wf-001', decision: ContentStatus.VALIDATED };
      validationRepo.create.mockReturnValue(savedValidation);
      validationRepo.save.mockResolvedValue(savedValidation);

      const result = await validationsService.validateContent(
        EXERCISE_ID,
        ContentType.EXERCISE,
        { decision: ContentStatus.VALIDATED },
        AP_ID,
        'animateur_pedagogique',
      );

      expect(exerciseRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: ContentStatus.VALIDATED }),
      );
      expect(result.decision).toBe(ContentStatus.VALIDATED);
    });

    it('enregistre une entrée d\'historique pour chaque décision de validation', async () => {
      const pendingExercise = buildSampleExercise({ status: ContentStatus.PENDING_VALIDATION });
      exerciseRepo.findOne.mockResolvedValue(pendingExercise);
      exerciseRepo.save.mockResolvedValue({});
      const savedValidation = {
        id: 'val-wf-002',
        contentId: EXERCISE_ID,
        contentType: ContentType.EXERCISE,
        validatorId: AP_ID,
        decision: ContentStatus.REJECTED,
        comment: 'Erreur dans l\'énoncé',
      };
      validationRepo.create.mockReturnValue(savedValidation);
      validationRepo.save.mockResolvedValue(savedValidation);

      await validationsService.validateContent(
        EXERCISE_ID,
        ContentType.EXERCISE,
        { decision: ContentStatus.REJECTED, comment: 'Erreur dans l\'énoncé' },
        AP_ID,
        'animateur_pedagogique',
      );

      // Une entrée doit être créée dans l'historique
      expect(validationRepo.create).toHaveBeenCalledTimes(1);
      expect(validationRepo.save).toHaveBeenCalledTimes(1);
    });
  });
});
