/**
 * Unit tests — ForumsService
 *
 * Couvre le "developpement reel des Forums" (arbitrage du 2026-09-04) :
 *   - createForum()              → seul le RP peut créer un forum, visible immédiatement
 *   - findAllForums()            → masquage par rôle (allowedRoles), recherche par tags
 *   - addComment()               → masquage 404, exclusion, acceptation de charte requise
 *   - deleteComment()            → réservé au RP
 *   - excludeMember()            → propriétaire ou RP, pas de double exclusion
 *   - charte de bonne conduite   → lecture/écriture/acceptation idempotente
 *   - image d'illustration       → upload RP, lecture masquée par rôle
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { ForumsService, isRoleAllowedForForum, isForumHiddenFromRole } from '../../../src/forums/forums.service';
import { Forum } from '../../../src/forums/entities/forum.entity';
import { ForumTopic } from '../../../src/forums/entities/forum-topic.entity';
import { ForumComment } from '../../../src/forums/entities/forum-comment.entity';
import { ForumExclusion } from '../../../src/forums/entities/forum-exclusion.entity';
import { ForumCharterSetting } from '../../../src/forums/entities/forum-charter-setting.entity';
import { ForumCharterAcceptance } from '../../../src/forums/entities/forum-charter-acceptance.entity';
import { ForumImageStorageService } from '../../../src/forums/services/forum-image-storage.service';
import { UserRole } from '../../../src/common/enums/user-role.enum';
import { ForumRestrictableRole } from '../../../src/common/enums/forum-restrictable-role.enum';
import { ForumTopicStatus } from '../../../src/common/enums/forum-topic-status.enum';

const RP_ID = 'rp-0000-4000-a000-aaaaaaaaaaaa';
const AP_ID = 'ap-0000-4000-b000-bbbbbbbbbbbb';
const ELEVE_ID = 'el-0000-4000-c000-cccccccccccc';
const FORMATEUR_ID = 'fo-0000-4000-d000-dddddddddddd';
const FORUM_ID = 'fr-0000-4000-0000-000000000000';
const TOPIC_ID = 'tp-0000-4000-0000-000000000000';

function buildMockRepo() {
  return {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    findAndCount: jest.fn(),
    count: jest.fn(),
    remove: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
}

function buildQueryBuilderMock(result: Forum[]) {
  const qb: any = {
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue(result),
  };
  return qb;
}

function buildSampleForum(overrides: Partial<Forum> = {}): Forum {
  return {
    id: FORUM_ID,
    title: 'Forum Algèbre',
    description: "Discussion autour de l'algèbre",
    tags: null,
    allowedRoles: null,
    createdById: RP_ID,
    createdByRole: UserRole.RESPONSABLE_PEDAGOGIQUE,
    imageFilename: null,
    imageMimeType: null,
    isHidden: false,
    hiddenAt: null,
    hiddenByUserId: null,
    topics: [],
    exclusions: [],
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

function buildSampleTopic(overrides: Partial<ForumTopic> = {}): ForumTopic {
  return {
    id: TOPIC_ID,
    forumId: FORUM_ID,
    forum: null as any,
    title: 'Une question',
    authorId: ELEVE_ID,
    authorRole: UserRole.ELEVE,
    status: ForumTopicStatus.PENDING_VALIDATION,
    isDefault: false,
    validatedByUserId: null,
    validatedAt: null,
    rejectedByUserId: null,
    rejectedAt: null,
    rejectionReason: null,
    comments: [],
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

describe('ForumsService', () => {
  let forumsService: ForumsService;
  let forumRepo: ReturnType<typeof buildMockRepo>;
  let topicRepo: ReturnType<typeof buildMockRepo>;
  let commentRepo: ReturnType<typeof buildMockRepo>;
  let exclusionRepo: ReturnType<typeof buildMockRepo>;
  let charterSettingRepo: ReturnType<typeof buildMockRepo>;
  let charterAcceptanceRepo: ReturnType<typeof buildMockRepo>;
  let imageStorage: { store: jest.Mock; read: jest.Mock; remove: jest.Mock };

  beforeEach(async () => {
    forumRepo = buildMockRepo();
    topicRepo = buildMockRepo();
    commentRepo = buildMockRepo();
    exclusionRepo = buildMockRepo();
    charterSettingRepo = buildMockRepo();
    charterAcceptanceRepo = buildMockRepo();
    imageStorage = { store: jest.fn(), read: jest.fn(), remove: jest.fn() };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        ForumsService,
        { provide: getRepositoryToken(Forum), useValue: forumRepo },
        { provide: getRepositoryToken(ForumTopic), useValue: topicRepo },
        { provide: getRepositoryToken(ForumComment), useValue: commentRepo },
        { provide: getRepositoryToken(ForumExclusion), useValue: exclusionRepo },
        { provide: getRepositoryToken(ForumCharterSetting), useValue: charterSettingRepo },
        { provide: getRepositoryToken(ForumCharterAcceptance), useValue: charterAcceptanceRepo },
        { provide: ForumImageStorageService, useValue: imageStorage },
      ],
    }).compile();

    forumsService = moduleRef.get<ForumsService>(ForumsService);

    // Par défaut, la charte est acceptée pour ne pas polluer les tests
    // de création de sujet/commentaire qui ne portent pas spécifiquement
    // sur ce contrôle.
    charterAcceptanceRepo.findOne.mockResolvedValue({ id: 'acc-1', userId: ELEVE_ID, acceptedAt: new Date() });
  });

  afterEach(() => jest.clearAllMocks());

  // ─────────────────────────────────────────────────────────────────────────
  // createForum()
  // ─────────────────────────────────────────────────────────────────────────

  describe('createForum()', () => {
    const validDto = { title: 'Forum Algèbre', description: 'Discussion algèbre' };

    beforeEach(() => {
      // createForum() crée aussi le sujet système "Sujet général" — mocks
      // par défaut pour ne pas polluer chaque test avec ce détail.
      const defaultTopic = { id: 'topic-default', forumId: FORUM_ID, title: 'Sujet général' };
      topicRepo.create.mockReturnValue(defaultTopic);
      topicRepo.save.mockResolvedValue(defaultTopic);
    });

    it('le RP peut créer un forum, visible immédiatement (allowedRoles null)', async () => {
      const savedForum = buildSampleForum();
      forumRepo.create.mockReturnValue(savedForum);
      forumRepo.save.mockResolvedValue(savedForum);

      const result = await forumsService.createForum(validDto, RP_ID, UserRole.RESPONSABLE_PEDAGOGIQUE);

      expect(forumRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ createdById: RP_ID, allowedRoles: null }),
      );
      expect(result.id).toBe(FORUM_ID);
    });

    it("lève ForbiddenException si l'AP tente de créer un forum (droit retiré)", async () => {
      await expect(
        forumsService.createForum(validDto, AP_ID, UserRole.ANIMATEUR_PEDAGOGIQUE),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lève ForbiddenException si un élève tente de créer un forum', async () => {
      await expect(
        forumsService.createForum(validDto, ELEVE_ID, UserRole.ELEVE),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lève ForbiddenException si un formateur tente de créer un forum', async () => {
      await expect(
        forumsService.createForum(validDto, FORMATEUR_ID, UserRole.FORMATEUR),
      ).rejects.toThrow(ForbiddenException);
    });

    it('enregistre allowedRoles fourni par le RP', async () => {
      const savedForum = buildSampleForum({ allowedRoles: [ForumRestrictableRole.ELEVE] });
      forumRepo.create.mockReturnValue(savedForum);
      forumRepo.save.mockResolvedValue(savedForum);

      await forumsService.createForum(
        { ...validDto, allowedRoles: [ForumRestrictableRole.ELEVE] },
        RP_ID,
        UserRole.RESPONSABLE_PEDAGOGIQUE,
      );

      expect(forumRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ allowedRoles: [ForumRestrictableRole.ELEVE] }),
      );
    });

    it('un allowedRoles vide est normalisé en null (ouvert à tous)', async () => {
      const savedForum = buildSampleForum();
      forumRepo.create.mockReturnValue(savedForum);
      forumRepo.save.mockResolvedValue(savedForum);

      await forumsService.createForum({ ...validDto, allowedRoles: [] }, RP_ID, UserRole.RESPONSABLE_PEDAGOGIQUE);

      expect(forumRepo.create).toHaveBeenCalledWith(expect.objectContaining({ allowedRoles: null }));
    });

    it('crée aussi le sujet système "Sujet général", déjà validé', async () => {
      const savedForum = buildSampleForum();
      forumRepo.create.mockReturnValue(savedForum);
      forumRepo.save.mockResolvedValue(savedForum);

      await forumsService.createForum(validDto, RP_ID, UserRole.RESPONSABLE_PEDAGOGIQUE);

      expect(topicRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          forumId: FORUM_ID,
          title: 'Sujet général',
          isDefault: true,
          status: ForumTopicStatus.VALIDATED,
        }),
      );
      expect(topicRepo.save).toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // findAllForums()
  // ─────────────────────────────────────────────────────────────────────────

  describe('findAllForums()', () => {
    it('le RP voit tous les forums, sans filtre de rôle ni de masquage', async () => {
      const qb = buildQueryBuilderMock([buildSampleForum()]);
      forumRepo.createQueryBuilder.mockReturnValue(qb);

      await forumsService.findAllForums(RP_ID, UserRole.RESPONSABLE_PEDAGOGIQUE);

      // Seul le tri est appliqué, aucune clause de restriction de rôle ni de masquage.
      expect(qb.andWhere).not.toHaveBeenCalled();
    });

    it("l'administrateur financier et le TI voient tous les forums non cachés (bypass admin de la restriction de rôle, mais pas du masquage)", async () => {
      const qbAf = buildQueryBuilderMock([]);
      forumRepo.createQueryBuilder.mockReturnValue(qbAf);
      await forumsService.findAllForums(AP_ID, UserRole.ADMINISTRATEUR_FINANCIER);
      // Pas de clause de restriction de rôle (bypass), mais une clause de masquage (isHidden = false).
      expect(qbAf.andWhere).toHaveBeenCalledTimes(1);
      expect(qbAf.andWhere).toHaveBeenCalledWith('forum.isHidden = false');

      const qbTi = buildQueryBuilderMock([]);
      forumRepo.createQueryBuilder.mockReturnValue(qbTi);
      await forumsService.findAllForums(AP_ID, UserRole.TECHNICIEN_INFORMATIQUE);
      expect(qbTi.andWhere).toHaveBeenCalledTimes(1);
      expect(qbTi.andWhere).toHaveBeenCalledWith('forum.isHidden = false');
    });

    it('un élève déclenche une clause de restriction de rôle et une clause de masquage', async () => {
      const qb = buildQueryBuilderMock([buildSampleForum()]);
      forumRepo.createQueryBuilder.mockReturnValue(qb);

      await forumsService.findAllForums(ELEVE_ID, UserRole.ELEVE);

      expect(qb.andWhere).toHaveBeenCalledTimes(2);
    });

    it('applique un filtre tags supplémentaire quand fourni', async () => {
      const qb = buildQueryBuilderMock([]);
      forumRepo.createQueryBuilder.mockReturnValue(qb);

      await forumsService.findAllForums(RP_ID, UserRole.RESPONSABLE_PEDAGOGIQUE, ['algèbre', 'trigonométrie']);

      // Une clause pour les tags, en plus (le RP n'a ni clause de rôle ni clause de masquage).
      expect(qb.andWhere).toHaveBeenCalledTimes(1);
    });

    it('mine=true filtre par createdById, sans clause de rôle ni de masquage (tous statuts confondus)', async () => {
      const qb = buildQueryBuilderMock([buildSampleForum({ isHidden: true })]);
      forumRepo.createQueryBuilder.mockReturnValue(qb);

      await forumsService.findAllForums(RP_ID, UserRole.RESPONSABLE_PEDAGOGIQUE, undefined, true);

      expect(qb.andWhere).toHaveBeenCalledWith('forum.createdById = :requesterId', { requesterId: RP_ID });
      expect(qb.andWhere).toHaveBeenCalledTimes(1);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // getForum()
  // ─────────────────────────────────────────────────────────────────────────

  describe('getForum()', () => {
    it('renvoie le détail du forum pour un rôle autorisé', async () => {
      const forum = buildSampleForum({ allowedRoles: null });
      forumRepo.findOne.mockResolvedValue(forum);

      const result = await forumsService.getForum(FORUM_ID, UserRole.ELEVE);

      expect(result.id).toBe(FORUM_ID);
    });

    it("lève NotFoundException si le forum n'existe pas", async () => {
      forumRepo.findOne.mockResolvedValue(null);

      await expect(forumsService.getForum(FORUM_ID, UserRole.ELEVE)).rejects.toThrow(NotFoundException);
    });

    it("lève NotFoundException (masquage, pas 403) si le rôle n'est pas autorisé sur ce forum restreint", async () => {
      const forum = buildSampleForum({ allowedRoles: [ForumRestrictableRole.FORMATEUR] });
      forumRepo.findOne.mockResolvedValue(forum);

      await expect(forumsService.getForum(FORUM_ID, UserRole.ELEVE)).rejects.toThrow(NotFoundException);
    });

    it('le RP voit le détail même sur un forum restreint (bypass admin)', async () => {
      const forum = buildSampleForum({ allowedRoles: [ForumRestrictableRole.FORMATEUR] });
      forumRepo.findOne.mockResolvedValue(forum);

      const result = await forumsService.getForum(FORUM_ID, UserRole.RESPONSABLE_PEDAGOGIQUE);

      expect(result.id).toBe(FORUM_ID);
    });

    it('lève NotFoundException (masquage) sur un forum caché pour un élève', async () => {
      const forum = buildSampleForum({ isHidden: true });
      forumRepo.findOne.mockResolvedValue(forum);

      await expect(forumsService.getForum(FORUM_ID, UserRole.ELEVE)).rejects.toThrow(NotFoundException);
    });

    it("lève NotFoundException (masquage) sur un forum caché pour l'administrateur financier", async () => {
      const forum = buildSampleForum({ isHidden: true });
      forumRepo.findOne.mockResolvedValue(forum);

      await expect(
        forumsService.getForum(FORUM_ID, UserRole.ADMINISTRATEUR_FINANCIER),
      ).rejects.toThrow(NotFoundException);
    });

    it('le RP voit le détail même sur un forum caché', async () => {
      const forum = buildSampleForum({ isHidden: true });
      forumRepo.findOne.mockResolvedValue(forum);

      const result = await forumsService.getForum(FORUM_ID, UserRole.RESPONSABLE_PEDAGOGIQUE);

      expect(result.id).toBe(FORUM_ID);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // hideForum()
  // ─────────────────────────────────────────────────────────────────────────

  describe('hideForum()', () => {
    it('le RP peut masquer un forum', async () => {
      const forum = buildSampleForum({ isHidden: false });
      forumRepo.findOne.mockResolvedValue(forum);
      forumRepo.save.mockImplementation(async (entity) => entity);

      const result = await forumsService.hideForum(FORUM_ID, RP_ID, UserRole.RESPONSABLE_PEDAGOGIQUE);

      expect(result.isHidden).toBe(true);
      expect(result.hiddenByUserId).toBe(RP_ID);
      expect(result.hiddenAt).toBeInstanceOf(Date);
      expect(forumRepo.save).toHaveBeenCalled();
    });

    it('est idempotent : masquer un forum déjà caché ne réécrit pas la trace et ne sauvegarde pas', async () => {
      const hiddenAt = new Date('2026-01-01T00:00:00Z');
      const forum = buildSampleForum({ isHidden: true, hiddenAt, hiddenByUserId: RP_ID });
      forumRepo.findOne.mockResolvedValue(forum);

      const result = await forumsService.hideForum(FORUM_ID, RP_ID, UserRole.RESPONSABLE_PEDAGOGIQUE);

      expect(result.hiddenAt).toBe(hiddenAt);
      expect(forumRepo.save).not.toHaveBeenCalled();
    });

    it("lève ForbiddenException si l'appelant n'est pas RP", async () => {
      await expect(
        forumsService.hideForum(FORUM_ID, AP_ID, UserRole.ANIMATEUR_PEDAGOGIQUE),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lève NotFoundException si le forum est introuvable', async () => {
      forumRepo.findOne.mockResolvedValue(null);

      await expect(
        forumsService.hideForum(FORUM_ID, RP_ID, UserRole.RESPONSABLE_PEDAGOGIQUE),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // updateForum()
  // ─────────────────────────────────────────────────────────────────────────

  describe('updateForum()', () => {
    it('le RP peut éditer les métadonnées (createur ou non)', async () => {
      const forum = buildSampleForum({ createdById: 'un-autre-rp' });
      forumRepo.findOne.mockResolvedValue(forum);
      forumRepo.save.mockImplementation(async (entity) => entity);

      const result = await forumsService.updateForum(
        FORUM_ID,
        { title: 'Nouveau titre', tags: 'algèbre,géométrie' },
        UserRole.RESPONSABLE_PEDAGOGIQUE,
      );

      expect(result.title).toBe('Nouveau titre');
      expect(result.tags).toBe('algèbre,géométrie');
      expect(forumRepo.save).toHaveBeenCalled();
    });

    it('seuls les champs fournis sont modifiés, les autres restent intacts', async () => {
      const forum = buildSampleForum({ description: 'ancienne description' });
      forumRepo.findOne.mockResolvedValue(forum);
      forumRepo.save.mockImplementation(async (entity) => entity);

      const result = await forumsService.updateForum(FORUM_ID, { title: 'Titre seul' }, UserRole.RESPONSABLE_PEDAGOGIQUE);

      expect(result.title).toBe('Titre seul');
      expect(result.description).toBe('ancienne description');
    });

    it('un allowedRoles vide fourni est normalisé en null (ouvert à tous)', async () => {
      const forum = buildSampleForum({ allowedRoles: [ForumRestrictableRole.FORMATEUR] });
      forumRepo.findOne.mockResolvedValue(forum);
      forumRepo.save.mockImplementation(async (entity) => entity);

      const result = await forumsService.updateForum(FORUM_ID, { allowedRoles: [] }, UserRole.RESPONSABLE_PEDAGOGIQUE);

      expect(result.allowedRoles).toBeNull();
    });

    it('un forum caché reste éditable', async () => {
      const forum = buildSampleForum({ isHidden: true, hiddenAt: new Date(), hiddenByUserId: RP_ID });
      forumRepo.findOne.mockResolvedValue(forum);
      forumRepo.save.mockImplementation(async (entity) => entity);

      const result = await forumsService.updateForum(FORUM_ID, { title: 'Toujours caché mais édité' }, UserRole.RESPONSABLE_PEDAGOGIQUE);

      expect(result.title).toBe('Toujours caché mais édité');
      expect(result.isHidden).toBe(true);
    });

    it("lève ForbiddenException si l'appelant n'est pas RP (pas même AP)", async () => {
      await expect(
        forumsService.updateForum(FORUM_ID, { title: 'x' }, UserRole.ANIMATEUR_PEDAGOGIQUE),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lève NotFoundException si le forum est introuvable', async () => {
      forumRepo.findOne.mockResolvedValue(null);

      await expect(
        forumsService.updateForum(FORUM_ID, { title: 'x' }, UserRole.RESPONSABLE_PEDAGOGIQUE),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // createTopic()
  // ─────────────────────────────────────────────────────────────────────────

  describe('createTopic()', () => {
    it("un élève peut créer un sujet dans un forum ouvert à tous (charte acceptée), pending_validation", async () => {
      const forum = buildSampleForum({ allowedRoles: null, exclusions: [] });
      forumRepo.findOne.mockResolvedValue(forum);
      const savedTopic = buildSampleTopic({ authorId: ELEVE_ID, authorRole: UserRole.ELEVE });
      topicRepo.create.mockReturnValue(savedTopic);
      topicRepo.save.mockResolvedValue(savedTopic);
      const savedComment = { id: 'cmt-001', topicId: TOPIC_ID, authorId: ELEVE_ID, content: 'Bonne question' };
      commentRepo.create.mockReturnValue(savedComment);
      commentRepo.save.mockResolvedValue(savedComment);

      const result = await forumsService.createTopic(
        FORUM_ID,
        { title: 'Une question', content: 'Bonne question' },
        ELEVE_ID,
        UserRole.ELEVE,
      );

      expect(topicRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ status: ForumTopicStatus.PENDING_VALIDATION, isDefault: false }),
      );
      expect(result.authorId).toBe(ELEVE_ID);
      expect(result.firstComment).toEqual(savedComment);
    });

    it('un RP créant un sujet le voit auto-validé (son propre validateur)', async () => {
      const forum = buildSampleForum({ allowedRoles: null, exclusions: [] });
      forumRepo.findOne.mockResolvedValue(forum);
      charterAcceptanceRepo.findOne.mockResolvedValue({ id: 'acc-rp', userId: RP_ID, acceptedAt: new Date() });
      const savedTopic = buildSampleTopic({
        authorId: RP_ID,
        authorRole: UserRole.RESPONSABLE_PEDAGOGIQUE,
        status: ForumTopicStatus.VALIDATED,
      });
      topicRepo.create.mockReturnValue(savedTopic);
      topicRepo.save.mockResolvedValue(savedTopic);
      commentRepo.create.mockReturnValue({ id: 'cmt-002' });
      commentRepo.save.mockResolvedValue({ id: 'cmt-002' });

      await forumsService.createTopic(
        FORUM_ID,
        { title: 'Annonce', content: 'Bienvenue' },
        RP_ID,
        UserRole.RESPONSABLE_PEDAGOGIQUE,
      );

      expect(topicRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ status: ForumTopicStatus.VALIDATED, validatedByUserId: RP_ID }),
      );
    });

    it('un AP créant un sujet le voit auto-validé (son propre validateur)', async () => {
      const forum = buildSampleForum({ allowedRoles: null, exclusions: [] });
      forumRepo.findOne.mockResolvedValue(forum);
      charterAcceptanceRepo.findOne.mockResolvedValue({ id: 'acc-ap', userId: AP_ID, acceptedAt: new Date() });
      topicRepo.create.mockReturnValue(buildSampleTopic({ authorId: AP_ID, status: ForumTopicStatus.VALIDATED }));
      topicRepo.save.mockResolvedValue(buildSampleTopic({ authorId: AP_ID, status: ForumTopicStatus.VALIDATED }));
      commentRepo.create.mockReturnValue({ id: 'cmt-003' });
      commentRepo.save.mockResolvedValue({ id: 'cmt-003' });

      await forumsService.createTopic(
        FORUM_ID,
        { title: 'Annonce AP', content: 'Bienvenue' },
        AP_ID,
        UserRole.ANIMATEUR_PEDAGOGIQUE,
      );

      expect(topicRepo.create).toHaveBeenCalledWith(expect.objectContaining({ status: ForumTopicStatus.VALIDATED }));
    });

    it("lève NotFoundException (masquage) si le forum n'existe pas", async () => {
      forumRepo.findOne.mockResolvedValue(null);

      await expect(
        forumsService.createTopic(FORUM_ID, { title: 'T', content: 'C' }, ELEVE_ID, UserRole.ELEVE),
      ).rejects.toThrow(NotFoundException);
    });

    it("lève NotFoundException (masquage, pas 403) si le rôle n'est pas autorisé sur ce forum restreint", async () => {
      const forum = buildSampleForum({ allowedRoles: [ForumRestrictableRole.FORMATEUR], exclusions: [] });
      forumRepo.findOne.mockResolvedValue(forum);

      await expect(
        forumsService.createTopic(FORUM_ID, { title: 'T', content: 'C' }, ELEVE_ID, UserRole.ELEVE),
      ).rejects.toThrow(NotFoundException);
    });

    it("lève ForbiddenException si l'utilisateur est exclu du forum", async () => {
      const forum = buildSampleForum({
        allowedRoles: null,
        exclusions: [
          { id: 'exc-001', forumId: FORUM_ID, excludedUserId: ELEVE_ID, excludedByUserId: RP_ID, reason: null, createdAt: new Date(), forum: null },
        ],
      });
      forumRepo.findOne.mockResolvedValue(forum);

      await expect(
        forumsService.createTopic(FORUM_ID, { title: 'T', content: 'C' }, ELEVE_ID, UserRole.ELEVE),
      ).rejects.toThrow(ForbiddenException);
    });

    it("lève ForbiddenException avec code CHARTER_NOT_ACCEPTED si la charte n'a jamais été acceptée", async () => {
      const forum = buildSampleForum({ allowedRoles: null, exclusions: [] });
      forumRepo.findOne.mockResolvedValue(forum);
      charterAcceptanceRepo.findOne.mockResolvedValue(null);

      try {
        await forumsService.createTopic(FORUM_ID, { title: 'T', content: 'C' }, ELEVE_ID, UserRole.ELEVE);
        fail('expected ForbiddenException');
      } catch (error: any) {
        expect(error).toBeInstanceOf(ForbiddenException);
        expect(error.getResponse()).toEqual(expect.objectContaining({ code: 'CHARTER_NOT_ACCEPTED' }));
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // findTopics()
  // ─────────────────────────────────────────────────────────────────────────

  describe('findTopics()', () => {
    it('le RP voit tous les sujets sans filtre de statut (bypass admin)', async () => {
      forumRepo.findOne.mockResolvedValue(buildSampleForum({ allowedRoles: null }));
      topicRepo.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[buildSampleTopic()], 1]),
      });

      const result = await forumsService.findTopics(FORUM_ID, RP_ID, UserRole.RESPONSABLE_PEDAGOGIQUE, { page: 1, limit: 20 });

      expect(result.total).toBe(1);
    });

    it("un élève ne voit que les sujets validés et les siens propres", async () => {
      forumRepo.findOne.mockResolvedValue(buildSampleForum({ allowedRoles: null }));
      const andWhere = jest.fn().mockReturnThis();
      topicRepo.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        andWhere,
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      });

      await forumsService.findTopics(FORUM_ID, ELEVE_ID, UserRole.ELEVE, { page: 1, limit: 20 });

      expect(andWhere).toHaveBeenCalled();
    });

    it("lève NotFoundException (masquage) si le forum n'existe pas", async () => {
      forumRepo.findOne.mockResolvedValue(null);

      await expect(
        forumsService.findTopics(FORUM_ID, ELEVE_ID, UserRole.ELEVE, { page: 1, limit: 20 }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // getTopic()
  // ─────────────────────────────────────────────────────────────────────────

  describe('getTopic()', () => {
    it('renvoie un sujet validé à tout appelant ayant accès au forum', async () => {
      forumRepo.findOne.mockResolvedValue(buildSampleForum({ allowedRoles: null }));
      topicRepo.findOne.mockResolvedValue(buildSampleTopic({ status: ForumTopicStatus.VALIDATED }));

      const result = await forumsService.getTopic(FORUM_ID, TOPIC_ID, ELEVE_ID, UserRole.ELEVE);

      expect(result.id).toBe(TOPIC_ID);
    });

    it("lève NotFoundException (masquage) pour un sujet pending_validation d'un tiers", async () => {
      forumRepo.findOne.mockResolvedValue(buildSampleForum({ allowedRoles: null }));
      topicRepo.findOne.mockResolvedValue(
        buildSampleTopic({ status: ForumTopicStatus.PENDING_VALIDATION, authorId: FORMATEUR_ID }),
      );

      await expect(
        forumsService.getTopic(FORUM_ID, TOPIC_ID, ELEVE_ID, UserRole.ELEVE),
      ).rejects.toThrow(NotFoundException);
    });

    it('renvoie un sujet pending_validation à son auteur', async () => {
      forumRepo.findOne.mockResolvedValue(buildSampleForum({ allowedRoles: null }));
      topicRepo.findOne.mockResolvedValue(
        buildSampleTopic({ status: ForumTopicStatus.PENDING_VALIDATION, authorId: ELEVE_ID }),
      );

      const result = await forumsService.getTopic(FORUM_ID, TOPIC_ID, ELEVE_ID, UserRole.ELEVE);

      expect(result.id).toBe(TOPIC_ID);
    });

    it('le RP voit un sujet pending_validation même sans en être l\'auteur (bypass admin)', async () => {
      forumRepo.findOne.mockResolvedValue(buildSampleForum({ allowedRoles: null }));
      topicRepo.findOne.mockResolvedValue(
        buildSampleTopic({ status: ForumTopicStatus.PENDING_VALIDATION, authorId: ELEVE_ID }),
      );

      const result = await forumsService.getTopic(FORUM_ID, TOPIC_ID, RP_ID, UserRole.RESPONSABLE_PEDAGOGIQUE);

      expect(result.id).toBe(TOPIC_ID);
    });

    it("lève NotFoundException si le sujet n'existe pas sur ce forum", async () => {
      forumRepo.findOne.mockResolvedValue(buildSampleForum({ allowedRoles: null }));
      topicRepo.findOne.mockResolvedValue(null);

      await expect(
        forumsService.getTopic(FORUM_ID, TOPIC_ID, ELEVE_ID, UserRole.ELEVE),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // decideTopic()
  // ─────────────────────────────────────────────────────────────────────────

  describe('decideTopic()', () => {
    it('le RP peut valider un sujet en attente', async () => {
      const topic = buildSampleTopic({ status: ForumTopicStatus.PENDING_VALIDATION });
      topicRepo.findOne.mockResolvedValue(topic);
      topicRepo.save.mockImplementation(async (entity) => entity);

      const result = await forumsService.decideTopic(
        FORUM_ID,
        TOPIC_ID,
        { decision: 'validated' },
        RP_ID,
        UserRole.RESPONSABLE_PEDAGOGIQUE,
      );

      expect(result.status).toBe(ForumTopicStatus.VALIDATED);
      expect(result.validatedByUserId).toBe(RP_ID);
    });

    it('le RP peut refuser un sujet avec un motif', async () => {
      const topic = buildSampleTopic({ status: ForumTopicStatus.PENDING_VALIDATION });
      topicRepo.findOne.mockResolvedValue(topic);
      topicRepo.save.mockImplementation(async (entity) => entity);

      const result = await forumsService.decideTopic(
        FORUM_ID,
        TOPIC_ID,
        { decision: 'rejected', reason: 'Hors sujet' },
        RP_ID,
        UserRole.RESPONSABLE_PEDAGOGIQUE,
      );

      expect(result.status).toBe(ForumTopicStatus.REJECTED);
      expect(result.rejectionReason).toBe('Hors sujet');
    });

    it("lève ForbiddenException si l'appelant n'est pas RP (pas même AP)", async () => {
      await expect(
        forumsService.decideTopic(FORUM_ID, TOPIC_ID, { decision: 'validated' }, AP_ID, UserRole.ANIMATEUR_PEDAGOGIQUE),
      ).rejects.toThrow(ForbiddenException);
    });

    it("lève NotFoundException si le sujet est introuvable", async () => {
      topicRepo.findOne.mockResolvedValue(null);

      await expect(
        forumsService.decideTopic(FORUM_ID, TOPIC_ID, { decision: 'validated' }, RP_ID, UserRole.RESPONSABLE_PEDAGOGIQUE),
      ).rejects.toThrow(NotFoundException);
    });

    it('lève BadRequestException sur le sujet système "Sujet général" (isDefault)', async () => {
      const topic = buildSampleTopic({ isDefault: true, status: ForumTopicStatus.VALIDATED });
      topicRepo.findOne.mockResolvedValue(topic);

      await expect(
        forumsService.decideTopic(FORUM_ID, TOPIC_ID, { decision: 'validated' }, RP_ID, UserRole.RESPONSABLE_PEDAGOGIQUE),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // addTopicComment()
  // ─────────────────────────────────────────────────────────────────────────

  describe('addTopicComment()', () => {
    it('un élève peut commenter un sujet validé (charte acceptée)', async () => {
      const forum = buildSampleForum({ allowedRoles: null, exclusions: [] });
      forumRepo.findOne.mockResolvedValue(forum);
      topicRepo.findOne.mockResolvedValue(buildSampleTopic({ status: ForumTopicStatus.VALIDATED }));
      const savedComment = { id: 'cmt-001', topicId: TOPIC_ID, authorId: ELEVE_ID, content: 'Bonne question' };
      commentRepo.create.mockReturnValue(savedComment);
      commentRepo.save.mockResolvedValue(savedComment);

      const result = await forumsService.addTopicComment(
        FORUM_ID,
        TOPIC_ID,
        { content: 'Bonne question' },
        ELEVE_ID,
        UserRole.ELEVE,
      );

      expect(result.authorId).toBe(ELEVE_ID);
    });

    it("lève NotFoundException si le sujet n'existe pas ou n'est pas visible (pending_validation d'un tiers)", async () => {
      const forum = buildSampleForum({ allowedRoles: null, exclusions: [] });
      forumRepo.findOne.mockResolvedValue(forum);
      topicRepo.findOne.mockResolvedValue(
        buildSampleTopic({ status: ForumTopicStatus.PENDING_VALIDATION, authorId: FORMATEUR_ID }),
      );

      await expect(
        forumsService.addTopicComment(FORUM_ID, TOPIC_ID, { content: 'Test' }, ELEVE_ID, UserRole.ELEVE),
      ).rejects.toThrow(NotFoundException);
    });

    it("lève ForbiddenException si l'utilisateur est exclu du forum", async () => {
      const forum = buildSampleForum({
        allowedRoles: null,
        exclusions: [
          { id: 'exc-001', forumId: FORUM_ID, excludedUserId: ELEVE_ID, excludedByUserId: RP_ID, reason: null, createdAt: new Date(), forum: null },
        ],
      });
      forumRepo.findOne.mockResolvedValue(forum);

      await expect(
        forumsService.addTopicComment(FORUM_ID, TOPIC_ID, { content: 'Test' }, ELEVE_ID, UserRole.ELEVE),
      ).rejects.toThrow(ForbiddenException);
    });

    it("lève ForbiddenException avec code CHARTER_NOT_ACCEPTED si la charte n'a jamais été acceptée", async () => {
      const forum = buildSampleForum({ allowedRoles: null, exclusions: [] });
      forumRepo.findOne.mockResolvedValue(forum);
      topicRepo.findOne.mockResolvedValue(buildSampleTopic({ status: ForumTopicStatus.VALIDATED }));
      charterAcceptanceRepo.findOne.mockResolvedValue(null);

      try {
        await forumsService.addTopicComment(FORUM_ID, TOPIC_ID, { content: 'Test' }, ELEVE_ID, UserRole.ELEVE);
        fail('expected ForbiddenException');
      } catch (error: any) {
        expect(error).toBeInstanceOf(ForbiddenException);
        expect(error.getResponse()).toEqual(expect.objectContaining({ code: 'CHARTER_NOT_ACCEPTED' }));
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // getTopicComments()
  // ─────────────────────────────────────────────────────────────────────────

  describe('getTopicComments()', () => {
    it('renvoie une page de commentaires triés du plus ancien au plus récent', async () => {
      forumRepo.findOne.mockResolvedValue(buildSampleForum({ allowedRoles: null }));
      topicRepo.findOne.mockResolvedValue(buildSampleTopic({ status: ForumTopicStatus.VALIDATED }));
      const comments = [
        { id: 'cmt-1', topicId: TOPIC_ID, authorId: ELEVE_ID, authorRole: UserRole.ELEVE, content: 'a', createdAt: new Date('2026-01-01') },
        { id: 'cmt-2', topicId: TOPIC_ID, authorId: ELEVE_ID, authorRole: UserRole.ELEVE, content: 'b', createdAt: new Date('2026-01-02') },
      ];
      commentRepo.findAndCount = jest.fn().mockResolvedValue([comments, 2]);

      const result = await forumsService.getTopicComments(FORUM_ID, TOPIC_ID, ELEVE_ID, UserRole.ELEVE, { page: 1, limit: 20 });

      expect(commentRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: { topicId: TOPIC_ID }, order: { createdAt: 'ASC' }, skip: 0, take: 20 }),
      );
      expect(result).toEqual({ data: comments, page: 1, limit: 20, total: 2, totalPages: 1 });
    });

    it("lève NotFoundException (masquage) si le sujet n'est pas visible à l'appelant", async () => {
      forumRepo.findOne.mockResolvedValue(buildSampleForum({ allowedRoles: null }));
      topicRepo.findOne.mockResolvedValue(
        buildSampleTopic({ status: ForumTopicStatus.PENDING_VALIDATION, authorId: FORMATEUR_ID }),
      );

      await expect(
        forumsService.getTopicComments(FORUM_ID, TOPIC_ID, ELEVE_ID, UserRole.ELEVE, { page: 1, limit: 20 }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // deleteTopicComment()
  // ─────────────────────────────────────────────────────────────────────────

  describe('deleteTopicComment()', () => {
    it('le RP peut supprimer un commentaire', async () => {
      const comment = { id: 'cmt-001', topicId: TOPIC_ID, authorId: ELEVE_ID, content: 'x' };
      commentRepo.findOne.mockResolvedValue(comment);
      commentRepo.remove.mockResolvedValue(comment);

      await forumsService.deleteTopicComment(FORUM_ID, TOPIC_ID, 'cmt-001', UserRole.RESPONSABLE_PEDAGOGIQUE);

      expect(commentRepo.remove).toHaveBeenCalledWith(comment);
    });

    it("lève ForbiddenException si l'appelant n'est pas RP (pas même AP)", async () => {
      await expect(
        forumsService.deleteTopicComment(FORUM_ID, TOPIC_ID, 'cmt-001', UserRole.ANIMATEUR_PEDAGOGIQUE),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lève NotFoundException si le commentaire est introuvable sur ce sujet', async () => {
      commentRepo.findOne.mockResolvedValue(null);

      await expect(
        forumsService.deleteTopicComment(FORUM_ID, TOPIC_ID, 'cmt-inconnu', UserRole.RESPONSABLE_PEDAGOGIQUE),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // excludeMember()
  // ─────────────────────────────────────────────────────────────────────────

  describe('excludeMember()', () => {
    it('le propriétaire du forum (RP) peut exclure un membre', async () => {
      forumRepo.findOne.mockResolvedValue(buildSampleForum({ createdById: RP_ID }));
      exclusionRepo.findOne.mockResolvedValue(null);
      const savedExclusion = { id: 'exc-001', forumId: FORUM_ID, excludedUserId: ELEVE_ID, excludedByUserId: RP_ID };
      exclusionRepo.create.mockReturnValue(savedExclusion);
      exclusionRepo.save.mockResolvedValue(savedExclusion);

      const result = await forumsService.excludeMember(
        FORUM_ID,
        { excludedUserId: ELEVE_ID },
        RP_ID,
        UserRole.RESPONSABLE_PEDAGOGIQUE,
      );

      expect(result.excludedUserId).toBe(ELEVE_ID);
    });

    it("lève ForbiddenException si un formateur (non propriétaire) tente d'exclure", async () => {
      forumRepo.findOne.mockResolvedValue(buildSampleForum({ createdById: RP_ID }));

      await expect(
        forumsService.excludeMember(FORUM_ID, { excludedUserId: ELEVE_ID }, FORMATEUR_ID, UserRole.FORMATEUR),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lève BadRequestException si le membre est déjà exclu', async () => {
      forumRepo.findOne.mockResolvedValue(buildSampleForum({ createdById: RP_ID }));
      exclusionRepo.findOne.mockResolvedValue({ id: 'exc-existing' });

      await expect(
        forumsService.excludeMember(FORUM_ID, { excludedUserId: ELEVE_ID }, RP_ID, UserRole.RESPONSABLE_PEDAGOGIQUE),
      ).rejects.toThrow(BadRequestException);
    });

    it('lève NotFoundException si le forum est introuvable', async () => {
      forumRepo.findOne.mockResolvedValue(null);

      await expect(
        forumsService.excludeMember(FORUM_ID, { excludedUserId: ELEVE_ID }, RP_ID, UserRole.RESPONSABLE_PEDAGOGIQUE),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Charte de bonne conduite
  // ─────────────────────────────────────────────────────────────────────────

  describe('charte de bonne conduite', () => {
    it('getCharter() crée un réglage vide si aucun n\'existe encore', async () => {
      charterSettingRepo.find.mockResolvedValue([]);
      const created = { id: 'charter-1', content: '', updatedByUserId: null, updatedAt: new Date() };
      charterSettingRepo.create.mockReturnValue(created);
      charterSettingRepo.save.mockResolvedValue(created);

      const result = await forumsService.getCharter();

      expect(result.content).toBe('');
    });

    it('updateCharter() est réservé au RP et au TI', async () => {
      await expect(
        forumsService.updateCharter({ content: 'Soyez respectueux' }, FORMATEUR_ID, UserRole.FORMATEUR),
      ).rejects.toThrow(ForbiddenException);
    });

    it('updateCharter() par le RP met à jour le contenu', async () => {
      const existing = { id: 'charter-1', content: 'ancien texte', updatedByUserId: null, updatedAt: new Date() };
      charterSettingRepo.find.mockResolvedValue([existing]);
      charterSettingRepo.save.mockImplementation(async (entity) => entity);

      const result = await forumsService.updateCharter(
        { content: 'Nouveau texte' },
        RP_ID,
        UserRole.RESPONSABLE_PEDAGOGIQUE,
      );

      expect(result.content).toBe('Nouveau texte');
    });

    it('acceptCharter() crée une acceptation si absente (201 côté contrôleur)', async () => {
      charterAcceptanceRepo.findOne.mockResolvedValue(null);
      const created = { id: 'acc-1', userId: ELEVE_ID, acceptedAt: new Date() };
      charterAcceptanceRepo.create.mockReturnValue(created);
      charterAcceptanceRepo.save.mockResolvedValue(created);

      const { alreadyAccepted, status } = await forumsService.acceptCharter(ELEVE_ID);

      expect(alreadyAccepted).toBe(false);
      expect(status.accepted).toBe(true);
    });

    it('acceptCharter() est idempotent si déjà acceptée (200 côté contrôleur)', async () => {
      const existing = { id: 'acc-1', userId: ELEVE_ID, acceptedAt: new Date('2026-01-01T00:00:00Z') };
      charterAcceptanceRepo.findOne.mockResolvedValue(existing);

      const { alreadyAccepted } = await forumsService.acceptCharter(ELEVE_ID);

      expect(alreadyAccepted).toBe(true);
      expect(charterAcceptanceRepo.create).not.toHaveBeenCalled();
    });

    it('getCharterAcceptanceStatus() renvoie accepted=false si aucune ligne', async () => {
      charterAcceptanceRepo.findOne.mockResolvedValue(null);

      const result = await forumsService.getCharterAcceptanceStatus(ELEVE_ID);

      expect(result).toEqual({ accepted: false, acceptedAt: null });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Image d'illustration
  // ─────────────────────────────────────────────────────────────────────────

  describe("image d'illustration", () => {
    it('le RP peut téléverser une image sur un forum existant', async () => {
      const forum = buildSampleForum({ imageFilename: null, imageMimeType: null });
      forumRepo.findOne.mockResolvedValue(forum);
      imageStorage.store.mockResolvedValue({ filename: 'abc.jpeg', mimeType: 'image/jpeg' });
      forumRepo.save.mockImplementation(async (entity) => entity);

      const result = await forumsService.uploadForumImage(FORUM_ID, Buffer.from('fake'), UserRole.RESPONSABLE_PEDAGOGIQUE);

      expect(result.imageFilename).toBe('abc.jpeg');
      expect(imageStorage.remove).not.toHaveBeenCalled();
    });

    it('remplace une image existante et supprime l\'ancien fichier', async () => {
      const forum = buildSampleForum({ imageFilename: 'old.png', imageMimeType: 'image/png' });
      forumRepo.findOne.mockResolvedValue(forum);
      imageStorage.store.mockResolvedValue({ filename: 'new.png', mimeType: 'image/png' });
      forumRepo.save.mockImplementation(async (entity) => entity);

      await forumsService.uploadForumImage(FORUM_ID, Buffer.from('fake'), UserRole.RESPONSABLE_PEDAGOGIQUE);

      expect(imageStorage.remove).toHaveBeenCalledWith('old.png');
    });

    it("lève ForbiddenException si l'appelant n'est pas RP", async () => {
      await expect(
        forumsService.uploadForumImage(FORUM_ID, Buffer.from('x'), UserRole.ANIMATEUR_PEDAGOGIQUE),
      ).rejects.toThrow(ForbiddenException);
    });

    it("getForumImage() masque un forum restreint à un autre rôle (404, jamais 403)", async () => {
      const forum = buildSampleForum({ allowedRoles: [ForumRestrictableRole.FORMATEUR], imageFilename: 'x.jpeg', imageMimeType: 'image/jpeg' });
      forumRepo.findOne.mockResolvedValue(forum);

      await expect(forumsService.getForumImage(FORUM_ID, UserRole.ELEVE)).rejects.toThrow(NotFoundException);
    });

    it("getForumImage() lève NotFoundException si le forum n'a pas d'image", async () => {
      const forum = buildSampleForum({ imageFilename: null, imageMimeType: null });
      forumRepo.findOne.mockResolvedValue(forum);

      await expect(forumsService.getForumImage(FORUM_ID, UserRole.ELEVE)).rejects.toThrow(NotFoundException);
    });

    it('getForumImage() renvoie le buffer et le type MIME pour un forum accessible', async () => {
      const forum = buildSampleForum({ imageFilename: 'x.jpeg', imageMimeType: 'image/jpeg' });
      forumRepo.findOne.mockResolvedValue(forum);
      imageStorage.read.mockResolvedValue(Buffer.from('image-bytes'));

      const result = await forumsService.getForumImage(FORUM_ID, UserRole.ELEVE);

      expect(result.mimeType).toBe('image/jpeg');
      expect(result.buffer.toString()).toBe('image-bytes');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // isRoleAllowedForForum() — helper
  // ─────────────────────────────────────────────────────────────────────────

  describe('isRoleAllowedForForum()', () => {
    it('tous les rôles accèdent à un forum ouvert à tous (allowedRoles null)', () => {
      expect(isRoleAllowedForForum(UserRole.ELEVE, { allowedRoles: null })).toBe(true);
      expect(isRoleAllowedForForum(UserRole.FORMATEUR, { allowedRoles: null })).toBe(true);
      expect(isRoleAllowedForForum(UserRole.PARENT_FINANCEUR, { allowedRoles: null })).toBe(true);
    });

    it('un rôle non listé est refusé sur un forum restreint', () => {
      expect(isRoleAllowedForForum(UserRole.ELEVE, { allowedRoles: [ForumRestrictableRole.FORMATEUR] })).toBe(false);
    });

    it('un rôle listé est autorisé', () => {
      expect(isRoleAllowedForForum(UserRole.FORMATEUR, { allowedRoles: [ForumRestrictableRole.FORMATEUR] })).toBe(true);
    });

    it('RP, AF, TI contournent toujours la restriction', () => {
      const restricted = { allowedRoles: [ForumRestrictableRole.FORMATEUR] };
      expect(isRoleAllowedForForum(UserRole.RESPONSABLE_PEDAGOGIQUE, restricted)).toBe(true);
      expect(isRoleAllowedForForum(UserRole.ADMINISTRATEUR_FINANCIER, restricted)).toBe(true);
      expect(isRoleAllowedForForum(UserRole.TECHNICIEN_INFORMATIQUE, restricted)).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // isForumHiddenFromRole() — helper
  // ─────────────────────────────────────────────────────────────────────────

  describe('isForumHiddenFromRole()', () => {
    it("un forum non caché n'est masqué pour personne", () => {
      expect(isForumHiddenFromRole(UserRole.ELEVE, { isHidden: false })).toBe(false);
      expect(isForumHiddenFromRole(UserRole.RESPONSABLE_PEDAGOGIQUE, { isHidden: false })).toBe(false);
    });

    it('un forum caché est masqué pour tous les rôles non-RP, y compris AF/TI', () => {
      expect(isForumHiddenFromRole(UserRole.ELEVE, { isHidden: true })).toBe(true);
      expect(isForumHiddenFromRole(UserRole.ADMINISTRATEUR_FINANCIER, { isHidden: true })).toBe(true);
      expect(isForumHiddenFromRole(UserRole.TECHNICIEN_INFORMATIQUE, { isHidden: true })).toBe(true);
    });

    it('un forum caché reste visible pour le RP', () => {
      expect(isForumHiddenFromRole(UserRole.RESPONSABLE_PEDAGOGIQUE, { isHidden: true })).toBe(false);
    });
  });
});
