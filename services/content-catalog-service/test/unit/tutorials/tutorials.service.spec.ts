/**
 * Unit tests — TutorialsService
 *
 * Couvre :
 *   - create()         → seuls formateur/AP/RP peuvent créer
 *   - search()         → élève et parent ne voient que les tutoriels validés
 *   - findOne()        → retourne le tutoriel ou NotFoundException
 *   - removeTutorial() → réservé RP/TI/auteur
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { TutorialsService } from '../../../src/tutorials/tutorials.service';
import { Tutorial } from '../../../src/tutorials/entities/tutorial.entity';
import { ContentStatus } from '../../../src/common/enums/content-status.enum';
import { TutorialType, TutorialFormat } from '../../../src/common/enums/content-type.enum';

const FORMATEUR_ID  = 'form-0000-4000-a000-aaaaaaaaaaaa';
const ELEVE_ID      = 'elev-0000-4000-b000-bbbbbbbbbbbb';
const OTHER_ID      = 'othe-0000-4000-c000-cccccccccccc';
const TUTORIAL_ID   = 'tuto-0000-4000-d000-dddddddddddd';

function buildMockRepo() {
  return {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    findAndCount: jest.fn(),
  };
}

function buildSampleTutorial(overrides: Partial<Tutorial> = {}): Tutorial {
  return {
    id: TUTORIAL_ID,
    title: 'Tutoriel algèbre',
    description: 'Bases de l\'algèbre',
    tutorialType: TutorialType.ACADEMIE,
    format: TutorialFormat.TEXTE,
    level: 'seconde',
    theme: 'algèbre',
    imageUrl: null,
    videoUrl: null,
    textContent: 'Contenu du tutoriel...',
    tags: ['algèbre', 'bases'],
    relatedResourceIds: [],
    relatedEvaluationId: null,
    authorId: FORMATEUR_ID,
    authorRole: 'formateur',
    status: ContentStatus.VALIDATED,
    shareableLink: '/tutorials/tuto-0000',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

describe('TutorialsService', () => {
  let tutorialsService: TutorialsService;
  let tutorialRepo: ReturnType<typeof buildMockRepo>;

  beforeEach(async () => {
    tutorialRepo = buildMockRepo();

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        TutorialsService,
        { provide: getRepositoryToken(Tutorial), useValue: tutorialRepo },
      ],
    }).compile();

    tutorialsService = moduleRef.get<TutorialsService>(TutorialsService);
  });

  afterEach(() => jest.clearAllMocks());

  // ─────────────────────────────────────────────────────────────────────────
  // create()
  // ─────────────────────────────────────────────────────────────────────────

  describe('create()', () => {
    const validDto = {
      title: 'Tutoriel bases algèbre',
      tutorialType: TutorialType.ACADEMIE,
      format: TutorialFormat.TEXTE,
      textContent: 'Contenu...',
    };

    it('crée un tutoriel pour un formateur', async () => {
      const savedTutorial = buildSampleTutorial({ status: ContentStatus.DRAFT });
      tutorialRepo.create.mockReturnValue(savedTutorial);
      tutorialRepo.save.mockResolvedValue(savedTutorial);

      const result = await tutorialsService.create(validDto, FORMATEUR_ID, 'formateur');

      expect(result).toBeDefined();
      expect(tutorialRepo.create).toHaveBeenCalled();
    });

    it('lève ForbiddenException si un élève tente de créer un tutoriel', async () => {
      await expect(
        tutorialsService.create(validDto, ELEVE_ID, 'eleve'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lève ForbiddenException si un parent tente de créer un tutoriel', async () => {
      await expect(
        tutorialsService.create(validDto, OTHER_ID, 'parent_financeur'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // search()
  // ─────────────────────────────────────────────────────────────────────────

  describe('search()', () => {
    it('filtre sur status=validated pour les élèves', async () => {
      tutorialRepo.findAndCount.mockResolvedValue([[], 0]);

      await tutorialsService.search({}, 'eleve');

      expect(tutorialRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ status: ContentStatus.VALIDATED }) }),
      );
    });

    it('filtre sur status=validated pour les parents', async () => {
      tutorialRepo.findAndCount.mockResolvedValue([[], 0]);

      await tutorialsService.search({}, 'parent_financeur');

      expect(tutorialRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ status: ContentStatus.VALIDATED }) }),
      );
    });

    it('ne filtre pas le statut pour un AP', async () => {
      tutorialRepo.findAndCount.mockResolvedValue([[buildSampleTutorial()], 1]);

      const result = await tutorialsService.search({}, 'animateur_pedagogique');

      const callArg = tutorialRepo.findAndCount.mock.calls[0][0];
      expect(callArg.where.status).toBeUndefined();
      expect(result.total).toBe(1);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // findOne()
  // ─────────────────────────────────────────────────────────────────────────

  describe('findOne()', () => {
    it('retourne le tutoriel validé s\'il existe, pour n\'importe quel appelant', async () => {
      tutorialRepo.findOne.mockResolvedValue(buildSampleTutorial());

      const result = await tutorialsService.findOne(TUTORIAL_ID, ELEVE_ID, 'eleve');

      expect(result.id).toBe(TUTORIAL_ID);
    });

    it('lève NotFoundException si le tutoriel est introuvable', async () => {
      tutorialRepo.findOne.mockResolvedValue(null);

      await expect(
        tutorialsService.findOne(TUTORIAL_ID, ELEVE_ID, 'eleve'),
      ).rejects.toThrow(NotFoundException);
    });

    // ───────────────────────────────────────────────────────────────────
    // Visibilité d'un tutoriel non validé pour son validateur RP/AP
    // (arbitrage du 2026-09-02, "Visibilité du contenu en attente de
    // validation, pour son validateur (RP/AP)"). Contrairement au Quizz/
    // Exercice/Évaluation, la décision de validation d'un Tutoriel n'est
    // pas scopée par relation animator_of_teacher (2026-08-29) : la
    // lecture d'un AP reste donc non scopée elle aussi, pas de mock
    // ProfileRelationsClient requis ici.
    // ───────────────────────────────────────────────────────────────────

    it('l\'auteur lit son propre tutoriel en attente de validation', async () => {
      const tutorial = buildSampleTutorial({
        authorId: FORMATEUR_ID,
        status: ContentStatus.PENDING_VALIDATION,
      });
      tutorialRepo.findOne.mockResolvedValue(tutorial);

      const result = await tutorialsService.findOne(TUTORIAL_ID, FORMATEUR_ID, 'formateur');

      expect(result.id).toBe(TUTORIAL_ID);
    });

    it('le RP lit n\'importe quel tutoriel en attente ou rejeté', async () => {
      const tutorial = buildSampleTutorial({
        authorId: FORMATEUR_ID,
        status: ContentStatus.PENDING_VALIDATION,
      });
      tutorialRepo.findOne.mockResolvedValue(tutorial);

      const result = await tutorialsService.findOne(
        TUTORIAL_ID,
        OTHER_ID,
        'responsable_pedagogique',
      );

      expect(result.id).toBe(TUTORIAL_ID);
    });

    it('un AP lit un tutoriel en attente d\'un auteur quelconque (non scopé)', async () => {
      const tutorial = buildSampleTutorial({
        authorId: FORMATEUR_ID,
        status: ContentStatus.PENDING_VALIDATION,
      });
      tutorialRepo.findOne.mockResolvedValue(tutorial);

      const result = await tutorialsService.findOne(
        TUTORIAL_ID,
        OTHER_ID,
        'animateur_pedagogique',
      );

      expect(result.id).toBe(TUTORIAL_ID);
    });

    it('un tiers non-auteur (élève ou formateur) ne voit pas un tutoriel en attente (404)', async () => {
      const tutorial = buildSampleTutorial({
        authorId: FORMATEUR_ID,
        status: ContentStatus.PENDING_VALIDATION,
      });
      tutorialRepo.findOne.mockResolvedValue(tutorial);

      await expect(
        tutorialsService.findOne(TUTORIAL_ID, OTHER_ID, 'eleve'),
      ).rejects.toThrow(NotFoundException);
      await expect(
        tutorialsService.findOne(TUTORIAL_ID, OTHER_ID, 'formateur'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // removeTutorial()
  // ─────────────────────────────────────────────────────────────────────────

  describe('removeTutorial()', () => {
    it('le RP peut retirer n\'importe quel tutoriel', async () => {
      const tutorial = buildSampleTutorial();
      tutorialRepo.findOne.mockResolvedValue(tutorial);
      tutorialRepo.save.mockResolvedValue({ ...tutorial, status: ContentStatus.REMOVED });

      await expect(
        tutorialsService.removeTutorial(TUTORIAL_ID, OTHER_ID, 'responsable_pedagogique'),
      ).resolves.toBeUndefined();

      expect(tutorialRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: ContentStatus.REMOVED }),
      );
    });

    it('l\'auteur peut retirer son propre tutoriel', async () => {
      const tutorial = buildSampleTutorial({ authorId: FORMATEUR_ID });
      tutorialRepo.findOne.mockResolvedValue(tutorial);
      tutorialRepo.save.mockResolvedValue({ ...tutorial, status: ContentStatus.REMOVED });

      await expect(
        tutorialsService.removeTutorial(TUTORIAL_ID, FORMATEUR_ID, 'formateur'),
      ).resolves.toBeUndefined();
    });

    it('lève ForbiddenException si un autre formateur tente de retirer le tutoriel', async () => {
      const tutorial = buildSampleTutorial({ authorId: FORMATEUR_ID });
      tutorialRepo.findOne.mockResolvedValue(tutorial);

      await expect(
        tutorialsService.removeTutorial(TUTORIAL_ID, OTHER_ID, 'formateur'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lève NotFoundException si le tutoriel est introuvable', async () => {
      tutorialRepo.findOne.mockResolvedValue(null);

      await expect(
        tutorialsService.removeTutorial(TUTORIAL_ID, FORMATEUR_ID, 'formateur'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
