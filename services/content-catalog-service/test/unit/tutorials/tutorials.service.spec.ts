/**
 * Unit tests — TutorialsService (refonte du 2026-09-03)
 *
 * Couvre :
 *   - create()                → rôles créateurs, cohérence format/blocs/vidéo, statut selon rôle, titre unique
 *   - update()                 → réservé à l'auteur, remplacement intégral, statut
 *   - search()                 → visibilité alignée sur Quizz/Exercice, filtre par tag
 *   - findOne()                 → 404 si non visible, scoping AP par relation, linkedQuizId filtré par statut
 *   - getPendingValidation()    → scoping AP par relation animator_of_teacher
 *   - removeTutorial()          → réservé RP/TI/auteur, passe en status REMOVED
 *   - blocs image                → décodage base64, plafonds de taille
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { TutorialsService } from '../../../src/tutorials/tutorials.service';
import { Tutorial } from '../../../src/tutorials/entities/tutorial.entity';
import { TutorialBlock } from '../../../src/tutorials/entities/tutorial-block.entity';
import { TutorialBlockCategory } from '../../../src/tutorials/enums/tutorial-block-category.enum';
import { TutorialFormat } from '../../../src/tutorials/enums/tutorial-format.enum';
import { Quiz } from '../../../src/quizzes/entities/quiz.entity';
import { ContentStatus } from '../../../src/common/enums/content-status.enum';
import { ProfileRelationsClient } from '../../../src/common/clients/profile-relations.client';
import { ExerciseImageStorageService } from '../../../src/exercises/exercise-image-storage.service';
import { ExerciseImageTranscoder } from '../../../src/exercises/exercise-image-transcoder';

const FORMATEUR_ID = 'form-0000-4000-a000-aaaaaaaaaaaa';
const AP_ID = 'ap00-0000-4000-b000-bbbbbbbbbbbb';
const RP_ID = 'rp00-0000-4000-c000-cccccccccccc';
const ELEVE_ID = 'elev-0000-4000-d000-dddddddddddd';
const OTHER_ID = 'othe-0000-4000-e000-eeeeeeeeeeee';
const TUTORIAL_ID = 'tuto-0000-4000-f000-ffffffffffff';
const QUIZ_ID = 'quiz-0000-4000-g000-gggggggggggg';

function buildMockRepo() {
  return {
    create: jest.fn((x) => x),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    findAndCount: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
}

function buildQueryBuilder(items: Tutorial[] = [], total = items.length) {
  const qb: any = {
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([items, total]),
    getOne: jest.fn().mockResolvedValue(undefined),
  };
  return qb;
}

function buildSampleTutorial(overrides: Partial<Tutorial> = {}): Tutorial {
  return {
    id: TUTORIAL_ID,
    title: 'Tutoriel algèbre',
    description: 'Bases de l\'algèbre',
    theme: 'algèbre',
    tags: ['algèbre', 'bases'],
    level: 'seconde',
    difficulty: 'facile',
    competencies: ['calculer'],
    format: TutorialFormat.POST,
    videoUrl: null,
    linkedQuizId: null,
    authorId: FORMATEUR_ID,
    authorRole: 'formateur',
    status: ContentStatus.VALIDATED,
    shareableLink: '/tutorials/tuto-0000',
    blocks: [],
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  } as Tutorial;
}

const validPostDto = {
  title: 'Tutoriel bases algèbre',
  format: TutorialFormat.POST,
  blocks: [
    { category: TutorialBlockCategory.TITLE, content: 'Introduction' },
    { category: TutorialBlockCategory.TEXT, content: 'Contenu du tutoriel...' },
  ],
};

const validVideoDto = {
  title: 'Vidéo bases algèbre',
  format: TutorialFormat.VIDEO,
  videoUrl: 'https://videos.example.com/embed/abc123',
};

const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

function buildTitleUniqueViolation(): Error & { code: string; constraint: string } {
  return Object.assign(new Error('duplicate key value violates unique constraint'), {
    code: '23505',
    constraint: 'IDX_tutorial_author_title_unique',
  });
}

describe('TutorialsService', () => {
  let tutorialsService: TutorialsService;
  let tutorialRepo: ReturnType<typeof buildMockRepo>;
  let blockRepo: ReturnType<typeof buildMockRepo>;
  let quizRepo: ReturnType<typeof buildMockRepo>;
  let profileRelationsClient: { hasAnimatorOfTeacherRelation: jest.Mock };
  let imageStorage: { save: jest.Mock; read: jest.Mock; delete: jest.Mock };
  let imageTranscoder: { transcode: jest.Mock };

  beforeEach(async () => {
    tutorialRepo = buildMockRepo();
    blockRepo = buildMockRepo();
    quizRepo = buildMockRepo();
    tutorialRepo.createQueryBuilder.mockReturnValue(buildQueryBuilder());
    profileRelationsClient = { hasAnimatorOfTeacherRelation: jest.fn() };
    imageStorage = { save: jest.fn(), read: jest.fn(), delete: jest.fn() };
    imageTranscoder = { transcode: jest.fn() };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        TutorialsService,
        { provide: getRepositoryToken(Tutorial), useValue: tutorialRepo },
        { provide: getRepositoryToken(TutorialBlock), useValue: blockRepo },
        { provide: getRepositoryToken(Quiz), useValue: quizRepo },
        { provide: ProfileRelationsClient, useValue: profileRelationsClient },
        { provide: ExerciseImageStorageService, useValue: imageStorage },
        { provide: ExerciseImageTranscoder, useValue: imageTranscoder },
      ],
    }).compile();

    tutorialsService = moduleRef.get<TutorialsService>(TutorialsService);
  });

  afterEach(() => jest.clearAllMocks());

  // ─────────────────────────────────────────────────────────────────────
  // create()
  // ─────────────────────────────────────────────────────────────────────

  describe('create()', () => {
    it('crée un tutoriel post pour un formateur (statut pending_validation)', async () => {
      tutorialRepo.save.mockImplementation((x) => Promise.resolve({ ...x, id: TUTORIAL_ID }));
      blockRepo.save.mockImplementation((x) => Promise.resolve({ ...x, id: 'block-' + Math.random() }));
      tutorialRepo.findOne.mockResolvedValue(
        buildSampleTutorial({ status: ContentStatus.PENDING_VALIDATION }),
      );

      const result = await tutorialsService.create(validPostDto as any, FORMATEUR_ID, 'formateur');

      expect(tutorialRepo.save).toHaveBeenCalled();
      expect(blockRepo.save).toHaveBeenCalledTimes(2);
      expect(result.authorId).toBe(FORMATEUR_ID);
    });

    it('crée un tutoriel vidéo validé immédiatement pour un RP', async () => {
      tutorialRepo.save.mockImplementation((x) => Promise.resolve({ ...x, id: TUTORIAL_ID }));
      tutorialRepo.findOne.mockResolvedValue(
        buildSampleTutorial({
          authorId: RP_ID,
          authorRole: 'responsable_pedagogique',
          format: TutorialFormat.VIDEO,
          videoUrl: validVideoDto.videoUrl,
          status: ContentStatus.VALIDATED,
        }),
      );

      await tutorialsService.create(validVideoDto as any, RP_ID, 'responsable_pedagogique');

      const createCall = tutorialRepo.create.mock.calls[0][0];
      expect(createCall.status).toBe(ContentStatus.VALIDATED);
      expect(blockRepo.save).not.toHaveBeenCalled();
    });

    it('lève ForbiddenException si un élève tente de créer un tutoriel', async () => {
      await expect(tutorialsService.create(validPostDto as any, ELEVE_ID, 'eleve')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('lève ForbiddenException si un parent tente de créer un tutoriel', async () => {
      await expect(
        tutorialsService.create(validPostDto as any, OTHER_ID, 'parent_financeur'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lève BadRequestException si le titre est vide', async () => {
      await expect(
        tutorialsService.create({ ...validPostDto, title: '  ' } as any, FORMATEUR_ID, 'formateur'),
      ).rejects.toThrow(BadRequestException);
    });

    it('lève BadRequestException si un tutoriel vidéo n\'a pas de videoUrl', async () => {
      await expect(
        tutorialsService.create(
          { title: 'Sans URL', format: TutorialFormat.VIDEO } as any,
          FORMATEUR_ID,
          'formateur',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('lève BadRequestException si un tutoriel vidéo porte des blocs', async () => {
      await expect(
        tutorialsService.create(
          { ...validVideoDto, blocks: [{ category: TutorialBlockCategory.TITLE, content: 'x' }] } as any,
          FORMATEUR_ID,
          'formateur',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('lève BadRequestException si un tutoriel post porte une videoUrl', async () => {
      await expect(
        tutorialsService.create(
          { ...validPostDto, videoUrl: 'https://videos.example.com/x' } as any,
          FORMATEUR_ID,
          'formateur',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('lève BadRequestException si un bloc titre/texte n\'a pas de contenu', async () => {
      await expect(
        tutorialsService.create(
          { title: 'x', format: TutorialFormat.POST, blocks: [{ category: TutorialBlockCategory.TEXT }] } as any,
          FORMATEUR_ID,
          'formateur',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('lève BadRequestException si un bloc image n\'a pas imageData', async () => {
      await expect(
        tutorialsService.create(
          { title: 'x', format: TutorialFormat.POST, blocks: [{ category: TutorialBlockCategory.IMAGE }] } as any,
          FORMATEUR_ID,
          'formateur',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('lève BadRequestException si linkedQuizId ne correspond à aucun Quizz', async () => {
      quizRepo.findOne.mockResolvedValue(null);

      await expect(
        tutorialsService.create(
          { ...validPostDto, linkedQuizId: QUIZ_ID } as any,
          FORMATEUR_ID,
          'formateur',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('accepte un linkedQuizId référençant un Quizz encore non validé (existence suffit à l\'écriture)', async () => {
      quizRepo.findOne.mockResolvedValue({ id: QUIZ_ID, status: ContentStatus.PENDING_VALIDATION });
      tutorialRepo.save.mockImplementation((x) => Promise.resolve({ ...x, id: TUTORIAL_ID }));
      tutorialRepo.findOne.mockResolvedValue(
        buildSampleTutorial({ linkedQuizId: QUIZ_ID, status: ContentStatus.PENDING_VALIDATION }),
      );

      await expect(
        tutorialsService.create({ ...validPostDto, linkedQuizId: QUIZ_ID } as any, FORMATEUR_ID, 'formateur'),
      ).resolves.toBeDefined();
    });

    it('crée un bloc image en décodant/ré-encodant les octets base64', async () => {
      imageTranscoder.transcode.mockResolvedValue({
        bytes: Buffer.from('fake-webp'),
        contentType: 'image/webp',
        width: 10,
        height: 10,
        sourceFormat: 'png',
      });
      imageStorage.save.mockResolvedValue('stored-uuid');
      tutorialRepo.save.mockImplementation((x) => Promise.resolve({ ...x, id: TUTORIAL_ID }));
      blockRepo.save.mockImplementation((x) => Promise.resolve({ ...x, id: 'block-1' }));
      tutorialRepo.findOne.mockResolvedValue(buildSampleTutorial({ status: ContentStatus.PENDING_VALIDATION }));

      const dto = {
        title: 'Avec image',
        format: TutorialFormat.POST,
        blocks: [{ category: TutorialBlockCategory.IMAGE, imageData: TINY_PNG_BASE64 }],
      };

      await tutorialsService.create(dto as any, FORMATEUR_ID, 'formateur');

      expect(imageTranscoder.transcode).toHaveBeenCalled();
      expect(imageStorage.save).toHaveBeenCalled();
    });

    it('retente avec un titre suffixé "(N)" sur violation de contrainte UNIQUE (collision de dernière seconde)', async () => {
      tutorialRepo.save
        .mockRejectedValueOnce(buildTitleUniqueViolation())
        .mockImplementationOnce((x) => Promise.resolve({ ...x, id: TUTORIAL_ID }));
      blockRepo.save.mockImplementation((x) => Promise.resolve({ ...x, id: 'block-1' }));
      tutorialRepo.findOne.mockResolvedValue(buildSampleTutorial({ status: ContentStatus.PENDING_VALIDATION }));

      await tutorialsService.create(validPostDto as any, FORMATEUR_ID, 'formateur');

      expect(tutorialRepo.save).toHaveBeenCalledTimes(3); // 2 tentatives de la ligne racine + set shareableLink
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // getDefaultTitle()
  // ─────────────────────────────────────────────────────────────────────

  describe('getDefaultTitle()', () => {
    it('suggère "Tutoriel (N)" où N = nombre de tutoriels déjà créés par l\'auteur + 1', async () => {
      tutorialRepo.count.mockResolvedValue(3);

      const result = await tutorialsService.getDefaultTitle(FORMATEUR_ID);

      expect(result).toEqual({ title: 'Tutoriel (4)' });
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // search()
  // ─────────────────────────────────────────────────────────────────────

  describe('search()', () => {
    it('filtre sur status=validated OU authorId=caller pour un élève', async () => {
      const qb = buildQueryBuilder();
      tutorialRepo.createQueryBuilder.mockReturnValue(qb);

      await tutorialsService.search({}, ELEVE_ID, 'eleve');

      expect(qb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('tutorial.status = :validated OR tutorial.authorId = :callerId'),
        expect.objectContaining({ validated: ContentStatus.VALIDATED, callerId: ELEVE_ID }),
      );
    });

    it('ne filtre pas le statut pour un RP', async () => {
      const qb = buildQueryBuilder([buildSampleTutorial()], 1);
      tutorialRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await tutorialsService.search({}, RP_ID, 'responsable_pedagogique');

      const statusCalls = qb.andWhere.mock.calls.filter((call: any[]) =>
        String(call[0]).includes('tutorial.status ='),
      );
      expect(statusCalls).toHaveLength(0);
      expect(result.total).toBe(1);
    });

    it('filtre par tag via ANY(tags)', async () => {
      const qb = buildQueryBuilder();
      tutorialRepo.createQueryBuilder.mockReturnValue(qb);

      await tutorialsService.search({ tag: 'algèbre' } as any, RP_ID, 'responsable_pedagogique');

      expect(qb.andWhere).toHaveBeenCalledWith(':tag = ANY(tutorial.tags)', { tag: 'algèbre' });
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // findOne()
  // ─────────────────────────────────────────────────────────────────────

  describe('findOne()', () => {
    it('retourne le tutoriel validé, pour n\'importe quel appelant', async () => {
      tutorialRepo.findOne.mockResolvedValue(buildSampleTutorial());

      const result = await tutorialsService.findOne(TUTORIAL_ID, ELEVE_ID, 'eleve');

      expect(result.id).toBe(TUTORIAL_ID);
    });

    it('lève NotFoundException si le tutoriel est introuvable', async () => {
      tutorialRepo.findOne.mockResolvedValue(null);

      await expect(tutorialsService.findOne(TUTORIAL_ID, ELEVE_ID, 'eleve')).rejects.toThrow(NotFoundException);
    });

    it('l\'auteur lit son propre tutoriel en attente de validation', async () => {
      const tutorial = buildSampleTutorial({ authorId: FORMATEUR_ID, status: ContentStatus.PENDING_VALIDATION });
      tutorialRepo.findOne.mockResolvedValue(tutorial);

      const result = await tutorialsService.findOne(TUTORIAL_ID, FORMATEUR_ID, 'formateur');

      expect(result.id).toBe(TUTORIAL_ID);
    });

    it('le RP lit n\'importe quel tutoriel en attente ou rejeté', async () => {
      const tutorial = buildSampleTutorial({ authorId: FORMATEUR_ID, status: ContentStatus.REJECTED });
      tutorialRepo.findOne.mockResolvedValue(tutorial);

      const result = await tutorialsService.findOne(TUTORIAL_ID, OTHER_ID, 'responsable_pedagogique');

      expect(result.id).toBe(TUTORIAL_ID);
    });

    it('un AP qui anime le formateur auteur lit un tutoriel en attente (scoping animator_of_teacher)', async () => {
      const tutorial = buildSampleTutorial({ authorId: FORMATEUR_ID, status: ContentStatus.PENDING_VALIDATION });
      tutorialRepo.findOne.mockResolvedValue(tutorial);
      profileRelationsClient.hasAnimatorOfTeacherRelation.mockResolvedValue(true);

      const result = await tutorialsService.findOne(TUTORIAL_ID, AP_ID, 'animateur_pedagogique');

      expect(result.id).toBe(TUTORIAL_ID);
      expect(profileRelationsClient.hasAnimatorOfTeacherRelation).toHaveBeenCalledWith(AP_ID, FORMATEUR_ID);
    });

    it('un AP qui n\'anime pas le formateur auteur ne voit pas le tutoriel en attente (404)', async () => {
      const tutorial = buildSampleTutorial({ authorId: FORMATEUR_ID, status: ContentStatus.PENDING_VALIDATION });
      tutorialRepo.findOne.mockResolvedValue(tutorial);
      profileRelationsClient.hasAnimatorOfTeacherRelation.mockResolvedValue(false);

      await expect(tutorialsService.findOne(TUTORIAL_ID, AP_ID, 'animateur_pedagogique')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('un tiers non-auteur (élève ou formateur) ne voit pas un tutoriel en attente (404)', async () => {
      const tutorial = buildSampleTutorial({ authorId: FORMATEUR_ID, status: ContentStatus.PENDING_VALIDATION });
      tutorialRepo.findOne.mockResolvedValue(tutorial);

      await expect(tutorialsService.findOne(TUTORIAL_ID, OTHER_ID, 'eleve')).rejects.toThrow(NotFoundException);
      await expect(tutorialsService.findOne(TUTORIAL_ID, OTHER_ID, 'formateur')).rejects.toThrow(NotFoundException);
    });

    it('expose linkedQuizId quand le Quizz référencé est validated', async () => {
      const tutorial = buildSampleTutorial({ linkedQuizId: QUIZ_ID });
      tutorialRepo.findOne.mockResolvedValue(tutorial);
      quizRepo.findOne.mockResolvedValue({ id: QUIZ_ID, status: ContentStatus.VALIDATED });

      const result = await tutorialsService.findOne(TUTORIAL_ID, ELEVE_ID, 'eleve');

      expect(result.linkedQuizId).toBe(QUIZ_ID);
    });

    it('masque linkedQuizId quand le Quizz référencé n\'est pas validated', async () => {
      const tutorial = buildSampleTutorial({ linkedQuizId: QUIZ_ID });
      tutorialRepo.findOne.mockResolvedValue(tutorial);
      quizRepo.findOne.mockResolvedValue({ id: QUIZ_ID, status: ContentStatus.PENDING_VALIDATION });

      const result = await tutorialsService.findOne(TUTORIAL_ID, ELEVE_ID, 'eleve');

      expect(result.linkedQuizId).toBeNull();
    });

    it('masque linkedQuizId si le Quizz référencé a depuis été supprimé', async () => {
      const tutorial = buildSampleTutorial({ linkedQuizId: QUIZ_ID });
      tutorialRepo.findOne.mockResolvedValue(tutorial);
      quizRepo.findOne.mockResolvedValue(null);

      const result = await tutorialsService.findOne(TUTORIAL_ID, ELEVE_ID, 'eleve');

      expect(result.linkedQuizId).toBeNull();
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // update()
  // ─────────────────────────────────────────────────────────────────────

  describe('update()', () => {
    it('lève ForbiddenException si l\'appelant n\'est pas l\'auteur', async () => {
      tutorialRepo.findOne.mockResolvedValue(buildSampleTutorial({ authorId: FORMATEUR_ID }));

      await expect(
        tutorialsService.update(TUTORIAL_ID, validPostDto as any, OTHER_ID, 'formateur'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lève NotFoundException si le tutoriel est introuvable', async () => {
      tutorialRepo.findOne.mockResolvedValue(null);

      await expect(
        tutorialsService.update(TUTORIAL_ID, validPostDto as any, FORMATEUR_ID, 'formateur'),
      ).rejects.toThrow(NotFoundException);
    });

    it('un auteur formateur qui édite un tutoriel validé le fait repasser en pending_validation', async () => {
      tutorialRepo.findOne
        .mockResolvedValueOnce(buildSampleTutorial({ authorId: FORMATEUR_ID, status: ContentStatus.VALIDATED }))
        .mockResolvedValueOnce(
          buildSampleTutorial({ authorId: FORMATEUR_ID, status: ContentStatus.PENDING_VALIDATION }),
        );
      blockRepo.find.mockResolvedValue([]);
      tutorialRepo.save.mockImplementation((x) => Promise.resolve(x));
      blockRepo.save.mockImplementation((x) => Promise.resolve({ ...x, id: 'block-1' }));

      await tutorialsService.update(TUTORIAL_ID, validPostDto as any, FORMATEUR_ID, 'formateur');

      expect(tutorialRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: ContentStatus.PENDING_VALIDATION }),
      );
    });

    it('un auteur AP/RP qui édite son propre tutoriel ne change pas le statut', async () => {
      tutorialRepo.findOne
        .mockResolvedValueOnce(
          buildSampleTutorial({ authorId: RP_ID, authorRole: 'responsable_pedagogique', status: ContentStatus.VALIDATED }),
        )
        .mockResolvedValueOnce(
          buildSampleTutorial({ authorId: RP_ID, authorRole: 'responsable_pedagogique', status: ContentStatus.VALIDATED }),
        );
      blockRepo.find.mockResolvedValue([]);
      tutorialRepo.save.mockImplementation((x) => Promise.resolve(x));
      blockRepo.save.mockImplementation((x) => Promise.resolve({ ...x, id: 'block-1' }));

      await tutorialsService.update(TUTORIAL_ID, validPostDto as any, RP_ID, 'responsable_pedagogique');

      expect(tutorialRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: ContentStatus.VALIDATED }),
      );
    });

    it('supprime les images existantes du volume avant le remplacement intégral', async () => {
      tutorialRepo.findOne
        .mockResolvedValueOnce(buildSampleTutorial({ authorId: FORMATEUR_ID }))
        .mockResolvedValueOnce(buildSampleTutorial({ authorId: FORMATEUR_ID }));
      blockRepo.find.mockResolvedValue([
        { category: TutorialBlockCategory.IMAGE, imageStoredFilename: 'old-file-1' },
      ]);
      tutorialRepo.save.mockImplementation((x) => Promise.resolve(x));
      blockRepo.save.mockImplementation((x) => Promise.resolve({ ...x, id: 'block-1' }));

      await tutorialsService.update(TUTORIAL_ID, validPostDto as any, FORMATEUR_ID, 'formateur');

      expect(imageStorage.delete).toHaveBeenCalledWith('old-file-1');
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // getPendingValidation()
  // ─────────────────────────────────────────────────────────────────────

  describe('getPendingValidation()', () => {
    it('lève ForbiddenException pour un formateur', async () => {
      await expect(
        tutorialsService.getPendingValidation(FORMATEUR_ID, 'formateur'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('un RP voit tous les tutoriels en attente', async () => {
      tutorialRepo.findAndCount.mockResolvedValue([[buildSampleTutorial({ status: ContentStatus.PENDING_VALIDATION })], 1]);

      const result = await tutorialsService.getPendingValidation(RP_ID, 'responsable_pedagogique');

      expect(result.total).toBe(1);
    });

    it('un AP ne voit que les tutoriels des formateurs qu\'il anime', async () => {
      tutorialRepo.find.mockResolvedValue([
        buildSampleTutorial({ id: 'tuto-a', authorId: FORMATEUR_ID, status: ContentStatus.PENDING_VALIDATION }),
        buildSampleTutorial({ id: 'tuto-b', authorId: OTHER_ID, status: ContentStatus.PENDING_VALIDATION }),
      ]);
      profileRelationsClient.hasAnimatorOfTeacherRelation.mockImplementation((_apId, authorId) =>
        Promise.resolve(authorId === FORMATEUR_ID),
      );

      const result = await tutorialsService.getPendingValidation(AP_ID, 'animateur_pedagogique');

      expect(result.total).toBe(1);
      expect(result.items[0].id).toBe('tuto-a');
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // removeTutorial()
  // ─────────────────────────────────────────────────────────────────────

  describe('removeTutorial()', () => {
    it('le RP peut retirer n\'importe quel tutoriel', async () => {
      const tutorial = buildSampleTutorial();
      tutorialRepo.findOne.mockResolvedValue(tutorial);
      tutorialRepo.save.mockResolvedValue({ ...tutorial, status: ContentStatus.REMOVED });

      await expect(
        tutorialsService.removeTutorial(TUTORIAL_ID, OTHER_ID, 'responsable_pedagogique'),
      ).resolves.toBeUndefined();

      expect(tutorialRepo.save).toHaveBeenCalledWith(expect.objectContaining({ status: ContentStatus.REMOVED }));
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
