/**
 * Tests d acceptance metier --- community-path-service
 *
 * Criteres couverts (spec XML docs/services/community-path-service.md) :
 *   - CPS-AC-001 : Seuls RP/AP creent forums et parcours; parcours AP valide par RP.
 *   - CPS-AC-002 : Un eleve ne peut avoir plus de 3 parcours ouverts (MAX_OPEN_ENROLLMENTS).
 *   - CPS-AC-003 : Un parcours acheve emet un certificat de reussite (idempotent).
 *   - CPS-AC-004 : Un forum respecte sa restriction de role et sa moderation (exclusion membre).
 *   - CPS-AC-005 : Un forum restreint a un role masque son existence aux autres roles (404, pas 403).
 *   - CPS-AC-006 : Le RP peut voir forums et parcours non publies/non valides.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ForumsService, isRoleAllowedForForum } from '../../../src/forums/forums.service';
import { PathsService, MAX_OPEN_ENROLLMENTS } from '../../../src/paths/paths.service';
import { Forum } from '../../../src/forums/entities/forum.entity';
import { ForumComment } from '../../../src/forums/entities/forum-comment.entity';
import { ForumExclusion } from '../../../src/forums/entities/forum-exclusion.entity';
import { ForumCharterSetting } from '../../../src/forums/entities/forum-charter-setting.entity';
import { ForumCharterAcceptance } from '../../../src/forums/entities/forum-charter-acceptance.entity';
import { ForumImageStorageService } from '../../../src/forums/services/forum-image-storage.service';
import { LearningPath } from '../../../src/paths/entities/learning-path.entity';
import { PathStep } from '../../../src/paths/entities/path-step.entity';
import { PathEnrollment } from '../../../src/paths/entities/path-enrollment.entity';
import { PathProgress } from '../../../src/paths/entities/path-progress.entity';
import { Certificate } from '../../../src/paths/entities/certificate.entity';
import { UserRole } from '../../../src/common/enums/user-role.enum';
import { ForumRestrictableRole } from '../../../src/common/enums/forum-restrictable-role.enum';
import { PathStatus } from '../../../src/common/enums/path-status.enum';
import { EnrollmentStatus } from '../../../src/common/enums/enrollment-status.enum';

function buildMockRepo() {
  return {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    count: jest.fn(),
    remove: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
}

function buildForumQueryBuilderMock(result: Forum[]) {
  return {
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue(result),
  } as any;
}

const RP_ID = 'rp-0000-4000-a000-aaaaaaaaaaaa';
const AP_ID = 'ap-0000-4000-b000-bbbbbbbbbbbb';
const ELEVE_ID = 'el-0000-4000-c000-cccccccccccc';
const FORMATEUR_ID = 'fo-0000-4000-d000-dddddddddddd';
const FORUM_ID = 'fr-0000-4000-0000-000000000000';
const PATH_ID = 'pa-0000-4000-0000-000000000000';
const ENROLLMENT_ID = 'en-0000-4000-0000-000000000000';

function buildSampleForum(overrides: Partial<Forum> = {}): Forum {
  return {
    id: FORUM_ID,
    title: 'Forum Algebre',
    description: 'Discussion autour de l algebre',
    level: 'seconde',
    difficulty: 'intermediaire',
    theme: 'algebre',
    competences: null,
    tags: null,
    allowedRoles: null,
    createdById: RP_ID,
    createdByRole: UserRole.RESPONSABLE_PEDAGOGIQUE,
    imageFilename: null,
    imageMimeType: null,
    isHidden: false,
    hiddenAt: null,
    hiddenByUserId: null,
    comments: [],
    exclusions: [],
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

function buildSamplePath(overrides: Partial<LearningPath> = {}): LearningPath {
  return {
    id: PATH_ID,
    title: 'Parcours Algebre Seconde',
    description: 'Parcours complet algebre niveau seconde',
    level: 'seconde',
    difficulty: 'intermediaire',
    theme: 'algebre',
    competences: null,
    tags: null,
    imageUrl: null,
    status: PathStatus.VALIDATED,
    createdById: RP_ID,
    createdByRole: UserRole.RESPONSABLE_PEDAGOGIQUE,
    steps: [],
    enrollments: [],
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

function buildSampleEnrollment(overrides: Partial<PathEnrollment> = {}): PathEnrollment {
  return {
    id: ENROLLMENT_ID,
    learningPathId: PATH_ID,
    learningPath: null,
    studentId: ELEVE_ID,
    status: EnrollmentStatus.IN_PROGRESS,
    progressPercent: 0,
    progressEntries: [],
    enrolledAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

// --- CPS-AC-001 ---

describe('CPS-AC-001 -- Creation forums/parcours reservee aux RP et AP', () => {
  let forumsService: ForumsService;
  let pathsService: PathsService;
  let forumRepo: ReturnType<typeof buildMockRepo>;
  let commentRepo: ReturnType<typeof buildMockRepo>;
  let exclusionRepo: ReturnType<typeof buildMockRepo>;
  let charterSettingRepo: ReturnType<typeof buildMockRepo>;
  let charterAcceptanceRepo: ReturnType<typeof buildMockRepo>;
  let pathRepo: ReturnType<typeof buildMockRepo>;
  let stepRepo: ReturnType<typeof buildMockRepo>;
  let enrollmentRepo: ReturnType<typeof buildMockRepo>;
  let progressRepo: ReturnType<typeof buildMockRepo>;
  let certificateRepo: ReturnType<typeof buildMockRepo>;

  beforeEach(async () => {
    forumRepo = buildMockRepo();
    commentRepo = buildMockRepo();
    exclusionRepo = buildMockRepo();
    charterSettingRepo = buildMockRepo();
    charterAcceptanceRepo = buildMockRepo();
    pathRepo = buildMockRepo();
    stepRepo = buildMockRepo();
    enrollmentRepo = buildMockRepo();
    progressRepo = buildMockRepo();
    certificateRepo = buildMockRepo();

    const forumsModule: TestingModule = await Test.createTestingModule({
      providers: [
        ForumsService,
        { provide: getRepositoryToken(Forum), useValue: forumRepo },
        { provide: getRepositoryToken(ForumComment), useValue: commentRepo },
        { provide: getRepositoryToken(ForumExclusion), useValue: exclusionRepo },
        { provide: getRepositoryToken(ForumCharterSetting), useValue: charterSettingRepo },
        { provide: getRepositoryToken(ForumCharterAcceptance), useValue: charterAcceptanceRepo },
        { provide: ForumImageStorageService, useValue: { store: jest.fn(), read: jest.fn(), remove: jest.fn() } },
      ],
    }).compile();

    const pathsModule: TestingModule = await Test.createTestingModule({
      providers: [
        PathsService,
        { provide: getRepositoryToken(LearningPath), useValue: pathRepo },
        { provide: getRepositoryToken(PathStep), useValue: stepRepo },
        { provide: getRepositoryToken(PathEnrollment), useValue: enrollmentRepo },
        { provide: getRepositoryToken(PathProgress), useValue: progressRepo },
        { provide: getRepositoryToken(Certificate), useValue: certificateRepo },
      ],
    }).compile();

    forumsService = forumsModule.get<ForumsService>(ForumsService);
    pathsService = pathsModule.get<PathsService>(PathsService);
  });

  afterEach(() => jest.clearAllMocks());

  it('le RP peut creer un forum, visible immediatement (allowedRoles null)', async () => {
    const createdForum = buildSampleForum();
    forumRepo.create.mockReturnValue(createdForum);
    forumRepo.save.mockResolvedValue(createdForum);

    const result = await forumsService.createForum(
      { title: 'Forum Algebre' },
      RP_ID,
      UserRole.RESPONSABLE_PEDAGOGIQUE,
    );

    expect(result.allowedRoles).toBeNull();
    expect(result.createdById).toBe(RP_ID);
  });

  it("l AP ne peut plus creer de forum (droit retire le 2026-09-04) --- ForbiddenException", async () => {
    await expect(
      forumsService.createForum({ title: 'Forum AP' }, AP_ID, UserRole.ANIMATEUR_PEDAGOGIQUE),
    ).rejects.toThrow(ForbiddenException);
  });

  it('un eleve ne peut pas creer de forum --- ForbiddenException', async () => {
    await expect(
      forumsService.createForum({ title: 'Forum Eleve' }, ELEVE_ID, UserRole.ELEVE),
    ).rejects.toThrow(ForbiddenException);
  });

  it('un formateur ne peut pas creer de forum --- ForbiddenException', async () => {
    await expect(
      forumsService.createForum({ title: 'Forum Formateur' }, FORMATEUR_ID, UserRole.FORMATEUR),
    ).rejects.toThrow(ForbiddenException);
  });

  it('le RP peut creer un parcours directement valide', async () => {
    const validatedPath = buildSamplePath({ status: PathStatus.VALIDATED });
    pathRepo.create.mockReturnValue(validatedPath);
    pathRepo.save.mockResolvedValue(validatedPath);
    pathRepo.findOne.mockResolvedValue(validatedPath);

    const result = await pathsService.createPath(
      { title: 'Parcours Algebre' },
      RP_ID,
      UserRole.RESPONSABLE_PEDAGOGIQUE,
    );

    expect(result.status).toBe(PathStatus.VALIDATED);
  });

  it("l AP cree un parcours en PENDING_VALIDATION (requiert validation RP)", async () => {
    const pendingPath = buildSamplePath({
      status: PathStatus.PENDING_VALIDATION,
      createdById: AP_ID,
    });
    pathRepo.create.mockReturnValue(pendingPath);
    pathRepo.save.mockResolvedValue(pendingPath);
    pathRepo.findOne.mockResolvedValue(pendingPath);

    const result = await pathsService.createPath(
      { title: 'Parcours AP' },
      AP_ID,
      UserRole.ANIMATEUR_PEDAGOGIQUE,
    );

    expect(result.status).toBe(PathStatus.PENDING_VALIDATION);
  });

  it('le RP peut valider un parcours AP en PENDING_VALIDATION --- passe a VALIDATED', async () => {
    const pendingPath = buildSamplePath({ status: PathStatus.PENDING_VALIDATION });
    pathRepo.findOne.mockResolvedValue(pendingPath);
    pathRepo.save.mockResolvedValue({ ...pendingPath, status: PathStatus.VALIDATED });

    const result = await pathsService.validatePath(
      PATH_ID,
      RP_ID,
      UserRole.RESPONSABLE_PEDAGOGIQUE,
    );

    expect(result.status).toBe(PathStatus.VALIDATED);
  });

  it("un AP ne peut pas valider un parcours --- ForbiddenException", async () => {
    await expect(
      pathsService.validatePath(PATH_ID, AP_ID, UserRole.ANIMATEUR_PEDAGOGIQUE),
    ).rejects.toThrow(ForbiddenException);
  });

  it('un eleve ne peut pas creer de parcours --- ForbiddenException', async () => {
    await expect(
      pathsService.createPath({ title: 'Parcours Eleve' }, ELEVE_ID, UserRole.ELEVE),
    ).rejects.toThrow(ForbiddenException);
  });
});

// --- CPS-AC-002 ---

describe('CPS-AC-002 -- Limite de 3 parcours ouverts simultanement', () => {
  let pathsService: PathsService;
  let pathRepo: ReturnType<typeof buildMockRepo>;
  let enrollmentRepo: ReturnType<typeof buildMockRepo>;

  beforeEach(async () => {
    pathRepo = buildMockRepo();
    const stepRepo = buildMockRepo();
    enrollmentRepo = buildMockRepo();
    const progressRepo = buildMockRepo();
    const certificateRepo = buildMockRepo();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PathsService,
        { provide: getRepositoryToken(LearningPath), useValue: pathRepo },
        { provide: getRepositoryToken(PathStep), useValue: stepRepo },
        { provide: getRepositoryToken(PathEnrollment), useValue: enrollmentRepo },
        { provide: getRepositoryToken(PathProgress), useValue: progressRepo },
        { provide: getRepositoryToken(Certificate), useValue: certificateRepo },
      ],
    }).compile();

    pathsService = module.get<PathsService>(PathsService);
  });

  afterEach(() => jest.clearAllMocks());

  it('la constante MAX_OPEN_ENROLLMENTS est bien egale a 3', () => {
    expect(MAX_OPEN_ENROLLMENTS).toBe(3);
  });

  it("un eleve peut s inscrire si il a moins de 3 parcours ouverts", async () => {
    pathRepo.findOne.mockResolvedValue(buildSamplePath({ status: PathStatus.VALIDATED }));
    enrollmentRepo.findOne.mockResolvedValue(null);
    enrollmentRepo.count.mockResolvedValue(2);
    const enrollment = buildSampleEnrollment();
    enrollmentRepo.create.mockReturnValue(enrollment);
    enrollmentRepo.save.mockResolvedValue(enrollment);

    const result = await pathsService.enrollStudent(PATH_ID, ELEVE_ID, UserRole.ELEVE);

    expect(result.studentId).toBe(ELEVE_ID);
  });

  it("leve BadRequestException si l eleve a exactement 3 parcours ouverts", async () => {
    pathRepo.findOne.mockResolvedValue(buildSamplePath({ status: PathStatus.VALIDATED }));
    enrollmentRepo.findOne.mockResolvedValue(null);
    enrollmentRepo.count.mockResolvedValue(MAX_OPEN_ENROLLMENTS);

    await expect(
      pathsService.enrollStudent(PATH_ID, ELEVE_ID, UserRole.ELEVE),
    ).rejects.toThrow(BadRequestException);
  });

  it("leve BadRequestException si l eleve est deja inscrit a ce parcours", async () => {
    pathRepo.findOne.mockResolvedValue(buildSamplePath({ status: PathStatus.VALIDATED }));
    enrollmentRepo.findOne.mockResolvedValue(buildSampleEnrollment());

    await expect(
      pathsService.enrollStudent(PATH_ID, ELEVE_ID, UserRole.ELEVE),
    ).rejects.toThrow(BadRequestException);
  });

  it("leve BadRequestException pour un parcours non valide (PENDING_VALIDATION)", async () => {
    pathRepo.findOne.mockResolvedValue(buildSamplePath({ status: PathStatus.PENDING_VALIDATION }));

    await expect(
      pathsService.enrollStudent(PATH_ID, ELEVE_ID, UserRole.ELEVE),
    ).rejects.toThrow(BadRequestException);
  });
});

// --- CPS-AC-003 ---

describe('CPS-AC-003 -- Certificat emis automatiquement a la completion du parcours', () => {
  let pathsService: PathsService;
  let pathRepo: ReturnType<typeof buildMockRepo>;
  let enrollmentRepo: ReturnType<typeof buildMockRepo>;
  let progressRepo: ReturnType<typeof buildMockRepo>;
  let certificateRepo: ReturnType<typeof buildMockRepo>;

  beforeEach(async () => {
    pathRepo = buildMockRepo();
    const stepRepo = buildMockRepo();
    enrollmentRepo = buildMockRepo();
    progressRepo = buildMockRepo();
    certificateRepo = buildMockRepo();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PathsService,
        { provide: getRepositoryToken(LearningPath), useValue: pathRepo },
        { provide: getRepositoryToken(PathStep), useValue: stepRepo },
        { provide: getRepositoryToken(PathEnrollment), useValue: enrollmentRepo },
        { provide: getRepositoryToken(PathProgress), useValue: progressRepo },
        { provide: getRepositoryToken(Certificate), useValue: certificateRepo },
      ],
    }).compile();

    pathsService = module.get<PathsService>(PathsService);
  });

  afterEach(() => jest.clearAllMocks());

  it('un certificat est emis quand les 100% du parcours sont atteints', async () => {
    const enrollment = buildSampleEnrollment({ progressEntries: [] });
    enrollmentRepo.findOne.mockResolvedValue(enrollment);
    progressRepo.findOne.mockResolvedValue(null);
    progressRepo.create.mockReturnValue({ enrollmentId: ENROLLMENT_ID, stepId: 'step-001', isCompleted: true });
    progressRepo.save.mockResolvedValue({});
    progressRepo.count.mockResolvedValue(1);
    pathRepo.findOne.mockResolvedValue(
      buildSamplePath({ steps: [{ id: 'step-001', order: 1, title: 'Etape 1' } as PathStep] }),
    );
    certificateRepo.findOne.mockResolvedValue(null);
    const savedCertificate = {
      id: 'cert-001',
      enrollmentId: ENROLLMENT_ID,
      studentId: ELEVE_ID,
      learningPathId: PATH_ID,
      learningPathTitle: 'Parcours Algebre Seconde',
      issuedAt: new Date(),
    };
    certificateRepo.create.mockReturnValue(savedCertificate);
    certificateRepo.save.mockResolvedValue(savedCertificate);
    enrollmentRepo.save.mockResolvedValue({
      ...enrollment,
      progressPercent: 100,
      status: EnrollmentStatus.COMPLETED,
    });

    await pathsService.updateEnrollmentProgress(
      ENROLLMENT_ID,
      { completedStepId: 'step-001' },
      ELEVE_ID,
    );

    expect(certificateRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        enrollmentId: ENROLLMENT_ID,
        studentId: ELEVE_ID,
        learningPathId: PATH_ID,
      }),
    );
    expect(certificateRepo.save).toHaveBeenCalled();
  });

  it('le certificat nest pas recree si un certificat existe deja (idempotence)', async () => {
    const enrollment = buildSampleEnrollment({ progressEntries: [] });
    enrollmentRepo.findOne.mockResolvedValue(enrollment);
    progressRepo.findOne.mockResolvedValue(null);
    progressRepo.create.mockReturnValue({ enrollmentId: ENROLLMENT_ID, stepId: 'step-001', isCompleted: true });
    progressRepo.save.mockResolvedValue({});
    progressRepo.count.mockResolvedValue(1);
    pathRepo.findOne.mockResolvedValue(
      buildSamplePath({ steps: [{ id: 'step-001', order: 1, title: 'Etape 1' } as PathStep] }),
    );
    certificateRepo.findOne.mockResolvedValue({ id: 'cert-existing', enrollmentId: ENROLLMENT_ID });
    enrollmentRepo.save.mockResolvedValue({
      ...enrollment,
      progressPercent: 100,
      status: EnrollmentStatus.COMPLETED,
    });

    await pathsService.updateEnrollmentProgress(
      ENROLLMENT_ID,
      { completedStepId: 'step-001' },
      ELEVE_ID,
    );

    expect(certificateRepo.create).not.toHaveBeenCalled();
  });

  it('aucun certificat n est emis si le parcours n est pas termine a 100%', async () => {
    const enrollment = buildSampleEnrollment({ progressEntries: [] });
    enrollmentRepo.findOne.mockResolvedValue(enrollment);
    progressRepo.findOne.mockResolvedValue(null);
    progressRepo.create.mockReturnValue({ enrollmentId: ENROLLMENT_ID, stepId: 'step-001', isCompleted: true });
    progressRepo.save.mockResolvedValue({});
    progressRepo.count.mockResolvedValue(1);
    pathRepo.findOne.mockResolvedValue(
      buildSamplePath({
        steps: [
          { id: 'step-001', order: 1, title: 'Etape 1' } as PathStep,
          { id: 'step-002', order: 2, title: 'Etape 2' } as PathStep,
          { id: 'step-003', order: 3, title: 'Etape 3' } as PathStep,
        ],
      }),
    );
    enrollmentRepo.save.mockResolvedValue({ ...enrollment, progressPercent: 33 });

    await pathsService.updateEnrollmentProgress(
      ENROLLMENT_ID,
      { completedStepId: 'step-001' },
      ELEVE_ID,
    );

    expect(certificateRepo.create).not.toHaveBeenCalled();
  });

  it('leve BadRequestException si le parcours est deja termine (COMPLETED)', async () => {
    enrollmentRepo.findOne.mockResolvedValue(
      buildSampleEnrollment({ status: EnrollmentStatus.COMPLETED }),
    );

    await expect(
      pathsService.updateEnrollmentProgress(ENROLLMENT_ID, {}, ELEVE_ID),
    ).rejects.toThrow(BadRequestException);
  });
});

// --- CPS-AC-004 ---

describe('CPS-AC-004 -- Forum : controle de la restriction de role et moderation des exclusions', () => {
  let forumsService: ForumsService;
  let forumRepo: ReturnType<typeof buildMockRepo>;
  let commentRepo: ReturnType<typeof buildMockRepo>;
  let exclusionRepo: ReturnType<typeof buildMockRepo>;
  let charterSettingRepo: ReturnType<typeof buildMockRepo>;
  let charterAcceptanceRepo: ReturnType<typeof buildMockRepo>;

  beforeEach(async () => {
    forumRepo = buildMockRepo();
    commentRepo = buildMockRepo();
    exclusionRepo = buildMockRepo();
    charterSettingRepo = buildMockRepo();
    charterAcceptanceRepo = buildMockRepo();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ForumsService,
        { provide: getRepositoryToken(Forum), useValue: forumRepo },
        { provide: getRepositoryToken(ForumComment), useValue: commentRepo },
        { provide: getRepositoryToken(ForumExclusion), useValue: exclusionRepo },
        { provide: getRepositoryToken(ForumCharterSetting), useValue: charterSettingRepo },
        { provide: getRepositoryToken(ForumCharterAcceptance), useValue: charterAcceptanceRepo },
        { provide: ForumImageStorageService, useValue: { store: jest.fn(), read: jest.fn(), remove: jest.fn() } },
      ],
    }).compile();

    forumsService = module.get<ForumsService>(ForumsService);
    charterAcceptanceRepo.findOne.mockResolvedValue({ id: 'acc-1', userId: ELEVE_ID, acceptedAt: new Date() });
  });

  afterEach(() => jest.clearAllMocks());

  it('un eleve peut commenter un forum ouvert a tous (allowedRoles null)', async () => {
    forumRepo.findOne.mockResolvedValue(
      buildSampleForum({ allowedRoles: null, exclusions: [] }),
    );
    const savedComment = { id: 'cmt-001', forumId: FORUM_ID, authorId: ELEVE_ID, content: 'Bonjour' };
    commentRepo.create.mockReturnValue(savedComment);
    commentRepo.save.mockResolvedValue(savedComment);

    const result = await forumsService.addComment(FORUM_ID, { content: 'Bonjour' }, ELEVE_ID, UserRole.ELEVE);

    expect(result.authorId).toBe(ELEVE_ID);
  });

  it('un eleve ne peut pas acceder a un forum restreint aux formateurs', () => {
    expect(isRoleAllowedForForum(UserRole.ELEVE, { allowedRoles: [ForumRestrictableRole.FORMATEUR] })).toBe(false);
  });

  it('un formateur ne peut pas acceder a un forum restreint aux eleves', () => {
    expect(isRoleAllowedForForum(UserRole.FORMATEUR, { allowedRoles: [ForumRestrictableRole.ELEVE] })).toBe(false);
  });

  it('un formateur peut acceder a un forum ouvert a tous', () => {
    expect(isRoleAllowedForForum(UserRole.FORMATEUR, { allowedRoles: null })).toBe(true);
  });

  it('un utilisateur exclu ne peut pas commenter le forum --- ForbiddenException', async () => {
    forumRepo.findOne.mockResolvedValue(
      buildSampleForum({
        allowedRoles: null,
        exclusions: [
          {
            id: 'exc-001',
            forumId: FORUM_ID,
            excludedUserId: ELEVE_ID,
            excludedByUserId: RP_ID,
            reason: null,
            createdAt: new Date(),
            forum: null,
          },
        ],
      }),
    );

    await expect(
      forumsService.addComment(FORUM_ID, { content: 'Test' }, ELEVE_ID, UserRole.ELEVE),
    ).rejects.toThrow(ForbiddenException);
  });

  it('le proprietaire du forum peut exclure un membre', async () => {
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

  it('un formateur (non proprietaire) ne peut pas exclure un membre --- ForbiddenException', async () => {
    forumRepo.findOne.mockResolvedValue(buildSampleForum({ createdById: RP_ID }));

    await expect(
      forumsService.excludeMember(
        FORUM_ID,
        { excludedUserId: ELEVE_ID },
        FORMATEUR_ID,
        UserRole.FORMATEUR,
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('leve BadRequestException si le membre est deja exclu (pas de double exclusion)', async () => {
    forumRepo.findOne.mockResolvedValue(buildSampleForum({ createdById: RP_ID }));
    exclusionRepo.findOne.mockResolvedValue({ id: 'exc-existing' });

    await expect(
      forumsService.excludeMember(
        FORUM_ID,
        { excludedUserId: ELEVE_ID },
        RP_ID,
        UserRole.RESPONSABLE_PEDAGOGIQUE,
      ),
    ).rejects.toThrow(BadRequestException);
  });
});

// --- CPS-AC-005 ---

describe('CPS-AC-005 -- Forum restreint a un role : masquage total pour les autres roles (404)', () => {
  let forumsService: ForumsService;
  let forumRepo: ReturnType<typeof buildMockRepo>;
  let commentRepo: ReturnType<typeof buildMockRepo>;
  let exclusionRepo: ReturnType<typeof buildMockRepo>;
  let charterSettingRepo: ReturnType<typeof buildMockRepo>;
  let charterAcceptanceRepo: ReturnType<typeof buildMockRepo>;

  beforeEach(async () => {
    forumRepo = buildMockRepo();
    commentRepo = buildMockRepo();
    exclusionRepo = buildMockRepo();
    charterSettingRepo = buildMockRepo();
    charterAcceptanceRepo = buildMockRepo();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ForumsService,
        { provide: getRepositoryToken(Forum), useValue: forumRepo },
        { provide: getRepositoryToken(ForumComment), useValue: commentRepo },
        { provide: getRepositoryToken(ForumExclusion), useValue: exclusionRepo },
        { provide: getRepositoryToken(ForumCharterSetting), useValue: charterSettingRepo },
        { provide: getRepositoryToken(ForumCharterAcceptance), useValue: charterAcceptanceRepo },
        { provide: ForumImageStorageService, useValue: { store: jest.fn(), read: jest.fn(), remove: jest.fn() } },
      ],
    }).compile();

    forumsService = module.get<ForumsService>(ForumsService);
  });

  afterEach(() => jest.clearAllMocks());

  it('le RP voit tous les forums, y compris ceux restreints a d\'autres roles (bypass admin)', async () => {
    const qb = buildForumQueryBuilderMock([buildSampleForum(), buildSampleForum({ id: 'fr-restricted', allowedRoles: [ForumRestrictableRole.FORMATEUR] })]);
    forumRepo.createQueryBuilder.mockReturnValue(qb);

    await forumsService.findAllForums(RP_ID, UserRole.RESPONSABLE_PEDAGOGIQUE);

    expect(qb.andWhere).not.toHaveBeenCalled();
  });

  it("l'administrateur financier voit tous les forums restreints par role (bypass admin), mais pas les forums caches", async () => {
    const qb = buildForumQueryBuilderMock([buildSampleForum()]);
    forumRepo.createQueryBuilder.mockReturnValue(qb);

    await forumsService.findAllForums(AP_ID, UserRole.ADMINISTRATEUR_FINANCIER);

    expect(qb.andWhere).toHaveBeenCalledTimes(1);
    expect(qb.andWhere).toHaveBeenCalledWith('forum.isHidden = false');
  });

  it('un eleve ne voit que les forums ouverts ou explicitement restreints aux eleves (clause de role appliquee)', async () => {
    const qb = buildForumQueryBuilderMock([buildSampleForum({ allowedRoles: null })]);
    forumRepo.createQueryBuilder.mockReturnValue(qb);

    await forumsService.findAllForums(ELEVE_ID, UserRole.ELEVE);

    expect(qb.andWhere).toHaveBeenCalled();
  });

  it("un eleve ne peut pas commenter un forum restreint aux formateurs --- NotFoundException (masquage, pas 403)", async () => {
    forumRepo.findOne.mockResolvedValue(buildSampleForum({ allowedRoles: [ForumRestrictableRole.FORMATEUR] }));

    await expect(
      forumsService.addComment(FORUM_ID, { content: 'Test' }, ELEVE_ID, UserRole.ELEVE),
    ).rejects.toThrow(NotFoundException);
  });
});

// --- CPS-AC-006 ---

describe('CPS-AC-006 -- Parcours AP en attente : visible seulement par RP et TI', () => {
  let pathsService: PathsService;
  let pathRepo: ReturnType<typeof buildMockRepo>;
  let enrollmentRepo: ReturnType<typeof buildMockRepo>;

  beforeEach(async () => {
    pathRepo = buildMockRepo();
    const stepRepo = buildMockRepo();
    enrollmentRepo = buildMockRepo();
    const progressRepo = buildMockRepo();
    const certificateRepo = buildMockRepo();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PathsService,
        { provide: getRepositoryToken(LearningPath), useValue: pathRepo },
        { provide: getRepositoryToken(PathStep), useValue: stepRepo },
        { provide: getRepositoryToken(PathEnrollment), useValue: enrollmentRepo },
        { provide: getRepositoryToken(PathProgress), useValue: progressRepo },
        { provide: getRepositoryToken(Certificate), useValue: certificateRepo },
      ],
    }).compile();

    pathsService = module.get<PathsService>(PathsService);
  });

  afterEach(() => jest.clearAllMocks());

  it('le RP voit tous les parcours incluant PENDING_VALIDATION (sans filtre statut)', async () => {
    pathRepo.find.mockResolvedValue([buildSamplePath()]);

    await pathsService.findAllPaths(UserRole.RESPONSABLE_PEDAGOGIQUE);

    expect(pathRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} }),
    );
  });

  it('le TI voit tous les parcours incluant les non valides', async () => {
    pathRepo.find.mockResolvedValue([buildSamplePath()]);

    await pathsService.findAllPaths(UserRole.TECHNICIEN_INFORMATIQUE);

    expect(pathRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} }),
    );
  });

  it('un eleve ne voit que les parcours VALIDATED', async () => {
    pathRepo.find.mockResolvedValue([buildSamplePath({ status: PathStatus.VALIDATED })]);

    await pathsService.findAllPaths(UserRole.ELEVE);

    expect(pathRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: PathStatus.VALIDATED } }),
    );
  });

  it("un eleve ne peut pas s inscrire a un parcours PENDING_VALIDATION", async () => {
    pathRepo.findOne.mockResolvedValue(buildSamplePath({ status: PathStatus.PENDING_VALIDATION }));

    await expect(
      pathsService.enrollStudent(PATH_ID, ELEVE_ID, UserRole.ELEVE),
    ).rejects.toThrow(BadRequestException);
  });
});
