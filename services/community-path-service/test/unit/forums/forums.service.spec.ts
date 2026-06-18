/**
 * Unit tests — ForumsService
 *
 * Couvre :
 *   - createForum()    → seuls RP/AP peuvent créer; AP => non publié, RP => publié
 *   - findAllForums()  → RP/TI voient tout; autres voient uniquement publiés
 *   - addComment()     → forum publié, rôle compatible, utilisateur non exclu
 *   - excludeMember()  → propriétaire ou RP, pas de double exclusion
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { ForumsService, isRoleAllowedForForumPublic } from '../../../src/forums/forums.service';
import { Forum } from '../../../src/forums/entities/forum.entity';
import { ForumComment } from '../../../src/forums/entities/forum-comment.entity';
import { ForumExclusion } from '../../../src/forums/entities/forum-exclusion.entity';
import { ForumPublic } from '../../../src/common/enums/forum-public.enum';

const RP_ID        = 'rp-0000-4000-a000-aaaaaaaaaaaa';
const AP_ID        = 'ap-0000-4000-b000-bbbbbbbbbbbb';
const ELEVE_ID     = 'el-0000-4000-c000-cccccccccccc';
const FORMATEUR_ID = 'fo-0000-4000-d000-dddddddddddd';
const FORUM_ID     = 'fr-0000-4000-0000-000000000000';

function buildMockRepo() {
  return {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    count: jest.fn(),
    remove: jest.fn(),
  };
}

function buildSampleForum(overrides: Partial<Forum> = {}): Forum {
  return {
    id: FORUM_ID,
    title: 'Forum Algèbre',
    description: 'Discussion autour de l\'algèbre',
    level: 'seconde',
    difficulty: 'intermédiaire',
    theme: 'algèbre',
    competences: null,
    tags: null,
    public: ForumPublic.MIXTE,
    createdById: RP_ID,
    createdByRole: 'responsable_pedagogique',
    isPublished: true,
    comments: [],
    exclusions: [],
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

describe('ForumsService', () => {
  let forumsService: ForumsService;
  let forumRepo: ReturnType<typeof buildMockRepo>;
  let commentRepo: ReturnType<typeof buildMockRepo>;
  let exclusionRepo: ReturnType<typeof buildMockRepo>;

  beforeEach(async () => {
    forumRepo = buildMockRepo();
    commentRepo = buildMockRepo();
    exclusionRepo = buildMockRepo();

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        ForumsService,
        { provide: getRepositoryToken(Forum), useValue: forumRepo },
        { provide: getRepositoryToken(ForumComment), useValue: commentRepo },
        { provide: getRepositoryToken(ForumExclusion), useValue: exclusionRepo },
      ],
    }).compile();

    forumsService = moduleRef.get<ForumsService>(ForumsService);
  });

  afterEach(() => jest.clearAllMocks());

  // ─────────────────────────────────────────────────────────────────────────
  // createForum()
  // ─────────────────────────────────────────────────────────────────────────

  describe('createForum()', () => {
    const validDto = { title: 'Forum Algèbre', description: 'Discussion algèbre' };

    it('le RP peut créer un forum, publié directement', async () => {
      const savedForum = buildSampleForum({ isPublished: true });
      forumRepo.create.mockReturnValue(savedForum);
      forumRepo.save.mockResolvedValue(savedForum);

      const result = await forumsService.createForum(validDto, RP_ID, 'responsable_pedagogique');

      expect(forumRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ isPublished: true, createdById: RP_ID }),
      );
      expect(result.isPublished).toBe(true);
    });

    it('l\'AP peut créer un forum, non publié (en attente de validation RP)', async () => {
      const savedForum = buildSampleForum({ isPublished: false, createdById: AP_ID, createdByRole: 'animateur_pedagogique' });
      forumRepo.create.mockReturnValue(savedForum);
      forumRepo.save.mockResolvedValue(savedForum);

      const result = await forumsService.createForum(validDto, AP_ID, 'animateur_pedagogique');

      expect(forumRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ isPublished: false, createdById: AP_ID }),
      );
      expect(result.isPublished).toBe(false);
    });

    it('lève ForbiddenException si un élève tente de créer un forum', async () => {
      await expect(
        forumsService.createForum(validDto, ELEVE_ID, 'eleve'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lève ForbiddenException si un formateur tente de créer un forum', async () => {
      await expect(
        forumsService.createForum(validDto, FORMATEUR_ID, 'formateur'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('applique le public MIXTE par défaut si non précisé', async () => {
      const savedForum = buildSampleForum();
      forumRepo.create.mockReturnValue(savedForum);
      forumRepo.save.mockResolvedValue(savedForum);

      await forumsService.createForum(validDto, RP_ID, 'responsable_pedagogique');

      expect(forumRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ public: ForumPublic.MIXTE }),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // findAllForums()
  // ─────────────────────────────────────────────────────────────────────────

  describe('findAllForums()', () => {
    it('le RP voit tous les forums sans filtre de publication', async () => {
      forumRepo.find.mockResolvedValue([buildSampleForum()]);

      await forumsService.findAllForums('responsable_pedagogique');

      expect(forumRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      );
    });

    it('le TI voit tous les forums sans filtre de publication', async () => {
      forumRepo.find.mockResolvedValue([buildSampleForum()]);

      await forumsService.findAllForums('technicien_informatique');

      expect(forumRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      );
    });

    it('un élève ne voit que les forums publiés', async () => {
      forumRepo.find.mockResolvedValue([buildSampleForum({ isPublished: true })]);

      await forumsService.findAllForums('eleve');

      expect(forumRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isPublished: true } }),
      );
    });

    it('un formateur ne voit que les forums publiés', async () => {
      forumRepo.find.mockResolvedValue([]);

      await forumsService.findAllForums('formateur');

      expect(forumRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isPublished: true } }),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // addComment()
  // ─────────────────────────────────────────────────────────────────────────

  describe('addComment()', () => {
    it('un élève peut commenter un forum MIXTE publié', async () => {
      const forum = buildSampleForum({ public: ForumPublic.MIXTE, isPublished: true, exclusions: [] });
      forumRepo.findOne.mockResolvedValue(forum);
      const savedComment = { id: 'cmt-001', forumId: FORUM_ID, authorId: ELEVE_ID, content: 'Bonne question', createdAt: new Date() };
      commentRepo.create.mockReturnValue(savedComment);
      commentRepo.save.mockResolvedValue(savedComment);

      const result = await forumsService.addComment(
        FORUM_ID,
        { content: 'Bonne question' },
        ELEVE_ID,
        'eleve',
      );

      expect(result.authorId).toBe(ELEVE_ID);
    });

    it('un formateur peut commenter un forum PROFESSEUR publié', async () => {
      const forum = buildSampleForum({ public: ForumPublic.PROFESSEUR, isPublished: true, exclusions: [] });
      forumRepo.findOne.mockResolvedValue(forum);
      const savedComment = { id: 'cmt-002', forumId: FORUM_ID, authorId: FORMATEUR_ID, content: 'Réponse', createdAt: new Date() };
      commentRepo.create.mockReturnValue(savedComment);
      commentRepo.save.mockResolvedValue(savedComment);

      const result = await forumsService.addComment(
        FORUM_ID,
        { content: 'Réponse' },
        FORMATEUR_ID,
        'formateur',
      );

      expect(result.authorId).toBe(FORMATEUR_ID);
    });

    it('lève ForbiddenException si le forum n\'est pas publié', async () => {
      forumRepo.findOne.mockResolvedValue(buildSampleForum({ isPublished: false }));

      await expect(
        forumsService.addComment(FORUM_ID, { content: 'Test' }, ELEVE_ID, 'eleve'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lève ForbiddenException si un élève commente un forum PROFESSEUR', async () => {
      forumRepo.findOne.mockResolvedValue(
        buildSampleForum({ public: ForumPublic.PROFESSEUR, isPublished: true, exclusions: [] }),
      );

      await expect(
        forumsService.addComment(FORUM_ID, { content: 'Test' }, ELEVE_ID, 'eleve'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lève ForbiddenException si l\'utilisateur est exclu du forum', async () => {
      const forum = buildSampleForum({
        isPublished: true,
        exclusions: [
          { id: 'exc-001', forumId: FORUM_ID, excludedUserId: ELEVE_ID, excludedByUserId: RP_ID, reason: null, createdAt: new Date(), forum: null },
        ],
      });
      forumRepo.findOne.mockResolvedValue(forum);

      await expect(
        forumsService.addComment(FORUM_ID, { content: 'Test' }, ELEVE_ID, 'eleve'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lève NotFoundException si le forum est introuvable', async () => {
      forumRepo.findOne.mockResolvedValue(null);

      await expect(
        forumsService.addComment(FORUM_ID, { content: 'Test' }, ELEVE_ID, 'eleve'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // excludeMember()
  // ─────────────────────────────────────────────────────────────────────────

  describe('excludeMember()', () => {
    it('le propriétaire du forum peut exclure un membre', async () => {
      forumRepo.findOne.mockResolvedValue(buildSampleForum({ createdById: RP_ID }));
      exclusionRepo.findOne.mockResolvedValue(null);
      const savedExclusion = { id: 'exc-001', forumId: FORUM_ID, excludedUserId: ELEVE_ID, excludedByUserId: RP_ID, reason: null, createdAt: new Date() };
      exclusionRepo.create.mockReturnValue(savedExclusion);
      exclusionRepo.save.mockResolvedValue(savedExclusion);

      const result = await forumsService.excludeMember(
        FORUM_ID,
        { excludedUserId: ELEVE_ID },
        RP_ID,
        'responsable_pedagogique',
      );

      expect(result.excludedUserId).toBe(ELEVE_ID);
    });

    it('un RP peut exclure un membre même s\'il n\'est pas propriétaire', async () => {
      const otherRpId = 'rp-other-id';
      forumRepo.findOne.mockResolvedValue(buildSampleForum({ createdById: AP_ID }));
      exclusionRepo.findOne.mockResolvedValue(null);
      const savedExclusion = { id: 'exc-002', forumId: FORUM_ID, excludedUserId: ELEVE_ID, excludedByUserId: otherRpId, reason: null, createdAt: new Date() };
      exclusionRepo.create.mockReturnValue(savedExclusion);
      exclusionRepo.save.mockResolvedValue(savedExclusion);

      const result = await forumsService.excludeMember(
        FORUM_ID,
        { excludedUserId: ELEVE_ID },
        otherRpId,
        'responsable_pedagogique',
      );

      expect(result).toBeDefined();
    });

    it('lève ForbiddenException si un formateur (non propriétaire) tente d\'exclure', async () => {
      forumRepo.findOne.mockResolvedValue(buildSampleForum({ createdById: RP_ID }));

      await expect(
        forumsService.excludeMember(
          FORUM_ID,
          { excludedUserId: ELEVE_ID },
          FORMATEUR_ID,
          'formateur',
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lève BadRequestException si l\'utilisateur est déjà exclu', async () => {
      forumRepo.findOne.mockResolvedValue(buildSampleForum({ createdById: RP_ID }));
      exclusionRepo.findOne.mockResolvedValue({ id: 'exc-existing' });

      await expect(
        forumsService.excludeMember(
          FORUM_ID,
          { excludedUserId: ELEVE_ID },
          RP_ID,
          'responsable_pedagogique',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('lève NotFoundException si le forum est introuvable', async () => {
      forumRepo.findOne.mockResolvedValue(null);

      await expect(
        forumsService.excludeMember(
          FORUM_ID,
          { excludedUserId: ELEVE_ID },
          RP_ID,
          'responsable_pedagogique',
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // isRoleAllowedForForumPublic() — helper
  // ─────────────────────────────────────────────────────────────────────────

  describe('isRoleAllowedForForumPublic()', () => {
    it('tous les rôles peuvent accéder à un forum MIXTE', () => {
      expect(isRoleAllowedForForumPublic('eleve', ForumPublic.MIXTE)).toBe(true);
      expect(isRoleAllowedForForumPublic('formateur', ForumPublic.MIXTE)).toBe(true);
      expect(isRoleAllowedForForumPublic('parent_financeur', ForumPublic.MIXTE)).toBe(true);
    });

    it('un élève peut accéder à un forum ETUDIANT', () => {
      expect(isRoleAllowedForForumPublic('eleve', ForumPublic.ETUDIANT)).toBe(true);
    });

    it('un formateur ne peut pas accéder à un forum ETUDIANT', () => {
      expect(isRoleAllowedForForumPublic('formateur', ForumPublic.ETUDIANT)).toBe(false);
    });

    it('un formateur peut accéder à un forum PROFESSEUR', () => {
      expect(isRoleAllowedForForumPublic('formateur', ForumPublic.PROFESSEUR)).toBe(true);
    });

    it('un élève ne peut pas accéder à un forum PROFESSEUR', () => {
      expect(isRoleAllowedForForumPublic('eleve', ForumPublic.PROFESSEUR)).toBe(false);
    });
  });
});
