/**
 * Unit tests — PathsService
 *
 * Couvre :
 *   - createPath()              → seuls RP/AP; RP => validé, AP => pending
 *   - findAllPaths()            → RP/TI voient tout; autres voient uniquement validés
 *   - validatePath()            → seul RP peut valider; état pending requis
 *   - enrollStudent()           → max 3 parcours ouverts; doublon interdit
 *   - updateEnrollmentProgress() → propriétaire seulement; certificat à 100%
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PathsService, MAX_OPEN_ENROLLMENTS } from '../../../src/paths/paths.service';
import { LearningPath } from '../../../src/paths/entities/learning-path.entity';
import { PathStep } from '../../../src/paths/entities/path-step.entity';
import { PathEnrollment } from '../../../src/paths/entities/path-enrollment.entity';
import { PathProgress } from '../../../src/paths/entities/path-progress.entity';
import { Certificate } from '../../../src/paths/entities/certificate.entity';
import { PathStatus } from '../../../src/common/enums/path-status.enum';
import { EnrollmentStatus } from '../../../src/common/enums/enrollment-status.enum';

const RP_ID        = 'rp-0000-4000-a000-aaaaaaaaaaaa';
const AP_ID        = 'ap-0000-4000-b000-bbbbbbbbbbbb';
const ELEVE_ID     = 'el-0000-4000-c000-cccccccccccc';
const FORMATEUR_ID = 'fo-0000-4000-d000-dddddddddddd';
const PATH_ID      = 'pa-0000-4000-0000-000000000000';
const ENROLLMENT_ID = 'en-0000-4000-0000-000000000000';

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

function buildSamplePath(overrides: Partial<LearningPath> = {}): LearningPath {
  return {
    id: PATH_ID,
    title: 'Parcours Algèbre Seconde',
    description: 'Parcours complet algèbre niveau seconde',
    level: 'seconde',
    difficulty: 'intermédiaire',
    theme: 'algèbre',
    competences: null,
    tags: null,
    imageUrl: null,
    status: PathStatus.VALIDATED,
    createdById: RP_ID,
    createdByRole: 'responsable_pedagogique',
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

describe('PathsService', () => {
  let pathsService: PathsService;
  let pathRepo: ReturnType<typeof buildMockRepo>;
  let stepRepo: ReturnType<typeof buildMockRepo>;
  let enrollmentRepo: ReturnType<typeof buildMockRepo>;
  let progressRepo: ReturnType<typeof buildMockRepo>;
  let certificateRepo: ReturnType<typeof buildMockRepo>;

  beforeEach(async () => {
    pathRepo = buildMockRepo();
    stepRepo = buildMockRepo();
    enrollmentRepo = buildMockRepo();
    progressRepo = buildMockRepo();
    certificateRepo = buildMockRepo();

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        PathsService,
        { provide: getRepositoryToken(LearningPath), useValue: pathRepo },
        { provide: getRepositoryToken(PathStep), useValue: stepRepo },
        { provide: getRepositoryToken(PathEnrollment), useValue: enrollmentRepo },
        { provide: getRepositoryToken(PathProgress), useValue: progressRepo },
        { provide: getRepositoryToken(Certificate), useValue: certificateRepo },
      ],
    }).compile();

    pathsService = moduleRef.get<PathsService>(PathsService);
  });

  afterEach(() => jest.clearAllMocks());

  // ─────────────────────────────────────────────────────────────────────────
  // createPath()
  // ─────────────────────────────────────────────────────────────────────────

  describe('createPath()', () => {
    const validDto = { title: 'Parcours Algèbre', description: 'Description' };

    it('le RP crée un parcours directement validé', async () => {
      const savedPath = buildSamplePath({ status: PathStatus.VALIDATED });
      pathRepo.create.mockReturnValue(savedPath);
      pathRepo.save.mockResolvedValue(savedPath);
      pathRepo.findOne.mockResolvedValue(savedPath);

      const result = await pathsService.createPath(validDto, RP_ID, 'responsable_pedagogique');

      expect(pathRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ status: PathStatus.VALIDATED, createdById: RP_ID }),
      );
    });

    it('l\'AP crée un parcours en attente de validation', async () => {
      const savedPath = buildSamplePath({
        status: PathStatus.PENDING_VALIDATION,
        createdById: AP_ID,
        createdByRole: 'animateur_pedagogique',
      });
      pathRepo.create.mockReturnValue(savedPath);
      pathRepo.save.mockResolvedValue(savedPath);
      pathRepo.findOne.mockResolvedValue(savedPath);

      const result = await pathsService.createPath(validDto, AP_ID, 'animateur_pedagogique');

      expect(pathRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ status: PathStatus.PENDING_VALIDATION, createdById: AP_ID }),
      );
    });

    it('lève ForbiddenException si un élève tente de créer un parcours', async () => {
      await expect(
        pathsService.createPath(validDto, ELEVE_ID, 'eleve'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lève ForbiddenException si un formateur tente de créer un parcours', async () => {
      await expect(
        pathsService.createPath(validDto, FORMATEUR_ID, 'formateur'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('crée les étapes si fournies', async () => {
      const savedPath = buildSamplePath();
      pathRepo.create.mockReturnValue(savedPath);
      pathRepo.save.mockResolvedValue(savedPath);
      pathRepo.findOne.mockResolvedValue(savedPath);
      stepRepo.create.mockImplementation((dto) => dto);
      stepRepo.save.mockResolvedValue([]);

      await pathsService.createPath(
        { ...validDto, steps: [{ order: 1, title: 'Étape 1' }] },
        RP_ID,
        'responsable_pedagogique',
      );

      expect(stepRepo.create).toHaveBeenCalled();
      expect(stepRepo.save).toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // findAllPaths()
  // ─────────────────────────────────────────────────────────────────────────

  describe('findAllPaths()', () => {
    it('le RP voit tous les parcours sans filtre de statut', async () => {
      pathRepo.find.mockResolvedValue([buildSamplePath()]);

      await pathsService.findAllPaths('responsable_pedagogique');

      expect(pathRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      );
    });

    it('le TI voit tous les parcours sans filtre de statut', async () => {
      pathRepo.find.mockResolvedValue([]);

      await pathsService.findAllPaths('technicien_informatique');

      expect(pathRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      );
    });

    it('un élève ne voit que les parcours validés', async () => {
      pathRepo.find.mockResolvedValue([buildSamplePath({ status: PathStatus.VALIDATED })]);

      await pathsService.findAllPaths('eleve');

      expect(pathRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: PathStatus.VALIDATED } }),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // validatePath()
  // ─────────────────────────────────────────────────────────────────────────

  describe('validatePath()', () => {
    it('le RP peut valider un parcours en attente', async () => {
      const pendingPath = buildSamplePath({ status: PathStatus.PENDING_VALIDATION });
      pathRepo.findOne.mockResolvedValue(pendingPath);
      pathRepo.save.mockResolvedValue({ ...pendingPath, status: PathStatus.VALIDATED });

      const result = await pathsService.validatePath(PATH_ID, RP_ID, 'responsable_pedagogique');

      expect(pathRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: PathStatus.VALIDATED }),
      );
    });

    it('lève ForbiddenException si un AP tente de valider un parcours', async () => {
      await expect(
        pathsService.validatePath(PATH_ID, AP_ID, 'animateur_pedagogique'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lève BadRequestException si le parcours n\'est pas en attente', async () => {
      pathRepo.findOne.mockResolvedValue(buildSamplePath({ status: PathStatus.VALIDATED }));

      await expect(
        pathsService.validatePath(PATH_ID, RP_ID, 'responsable_pedagogique'),
      ).rejects.toThrow(BadRequestException);
    });

    it('lève NotFoundException si le parcours est introuvable', async () => {
      pathRepo.findOne.mockResolvedValue(null);

      await expect(
        pathsService.validatePath(PATH_ID, RP_ID, 'responsable_pedagogique'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // enrollStudent()
  // ─────────────────────────────────────────────────────────────────────────

  describe('enrollStudent()', () => {
    it('un élève peut s\'inscrire à un parcours validé', async () => {
      pathRepo.findOne.mockResolvedValue(buildSamplePath({ status: PathStatus.VALIDATED }));
      enrollmentRepo.findOne.mockResolvedValue(null);
      enrollmentRepo.count.mockResolvedValue(0);
      const savedEnrollment = buildSampleEnrollment();
      enrollmentRepo.create.mockReturnValue(savedEnrollment);
      enrollmentRepo.save.mockResolvedValue(savedEnrollment);

      const result = await pathsService.enrollStudent(PATH_ID, ELEVE_ID, 'eleve');

      expect(result.studentId).toBe(ELEVE_ID);
    });

    it(`lève BadRequestException si l'élève a déjà ${MAX_OPEN_ENROLLMENTS} parcours ouverts`, async () => {
      pathRepo.findOne.mockResolvedValue(buildSamplePath({ status: PathStatus.VALIDATED }));
      enrollmentRepo.findOne.mockResolvedValue(null);
      enrollmentRepo.count.mockResolvedValue(MAX_OPEN_ENROLLMENTS);

      await expect(
        pathsService.enrollStudent(PATH_ID, ELEVE_ID, 'eleve'),
      ).rejects.toThrow(BadRequestException);
    });

    it('lève BadRequestException si l\'élève est déjà inscrit à ce parcours', async () => {
      pathRepo.findOne.mockResolvedValue(buildSamplePath({ status: PathStatus.VALIDATED }));
      enrollmentRepo.findOne.mockResolvedValue(buildSampleEnrollment());

      await expect(
        pathsService.enrollStudent(PATH_ID, ELEVE_ID, 'eleve'),
      ).rejects.toThrow(BadRequestException);
    });

    it('lève BadRequestException si le parcours n\'est pas validé', async () => {
      pathRepo.findOne.mockResolvedValue(buildSamplePath({ status: PathStatus.PENDING_VALIDATION }));

      await expect(
        pathsService.enrollStudent(PATH_ID, ELEVE_ID, 'eleve'),
      ).rejects.toThrow(BadRequestException);
    });

    it('lève NotFoundException si le parcours est introuvable', async () => {
      pathRepo.findOne.mockResolvedValue(null);

      await expect(
        pathsService.enrollStudent(PATH_ID, ELEVE_ID, 'eleve'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // updateEnrollmentProgress()
  // ─────────────────────────────────────────────────────────────────────────

  describe('updateEnrollmentProgress()', () => {
    it('l\'élève peut mettre à jour sa progression', async () => {
      const enrollment = buildSampleEnrollment({ progressEntries: [] });
      enrollmentRepo.findOne.mockResolvedValue(enrollment);
      progressRepo.findOne.mockResolvedValue(null);
      progressRepo.create.mockReturnValue({ enrollmentId: ENROLLMENT_ID, stepId: 'step-001', isCompleted: true });
      progressRepo.save.mockResolvedValue({});
      progressRepo.count.mockResolvedValue(1);
      pathRepo.findOne.mockResolvedValue(buildSamplePath({ steps: [{ id: 'step-001', order: 1, title: 'Étape 1' } as PathStep] }));
      enrollmentRepo.save.mockResolvedValue({ ...enrollment, progressPercent: 100, status: EnrollmentStatus.IN_PROGRESS });

      const result = await pathsService.updateEnrollmentProgress(
        ENROLLMENT_ID,
        { completedStepId: 'step-001' },
        ELEVE_ID,
      );

      expect(progressRepo.create).toHaveBeenCalled();
    });

    it('émet un certificat quand la progression atteint 100%', async () => {
      const enrollment = buildSampleEnrollment({ progressEntries: [] });
      enrollmentRepo.findOne.mockResolvedValue(enrollment);
      progressRepo.findOne.mockResolvedValue(null);
      progressRepo.create.mockReturnValue({ enrollmentId: ENROLLMENT_ID, stepId: 'step-001', isCompleted: true });
      progressRepo.save.mockResolvedValue({});
      progressRepo.count.mockResolvedValue(1);
      pathRepo.findOne.mockResolvedValue(buildSamplePath({ steps: [{ id: 'step-001', order: 1, title: 'Étape 1' } as PathStep] }));
      certificateRepo.findOne.mockResolvedValue(null);
      const savedCertificate = { id: 'cert-001', enrollmentId: ENROLLMENT_ID, studentId: ELEVE_ID, learningPathId: PATH_ID, learningPathTitle: 'Parcours Algèbre Seconde', issuedAt: new Date() };
      certificateRepo.create.mockReturnValue(savedCertificate);
      certificateRepo.save.mockResolvedValue(savedCertificate);
      enrollmentRepo.save.mockResolvedValue({ ...enrollment, progressPercent: 100, status: EnrollmentStatus.COMPLETED });

      await pathsService.updateEnrollmentProgress(
        ENROLLMENT_ID,
        { completedStepId: 'step-001' },
        ELEVE_ID,
      );

      expect(certificateRepo.create).toHaveBeenCalled();
      expect(certificateRepo.save).toHaveBeenCalled();
    });

    it('lève ForbiddenException si un autre utilisateur tente de mettre à jour la progression', async () => {
      const otherStudentId = 'other-student-id';
      enrollmentRepo.findOne.mockResolvedValue(buildSampleEnrollment({ studentId: ELEVE_ID }));

      await expect(
        pathsService.updateEnrollmentProgress(ENROLLMENT_ID, {}, otherStudentId),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lève BadRequestException si le parcours est déjà terminé', async () => {
      enrollmentRepo.findOne.mockResolvedValue(
        buildSampleEnrollment({ status: EnrollmentStatus.COMPLETED }),
      );

      await expect(
        pathsService.updateEnrollmentProgress(ENROLLMENT_ID, {}, ELEVE_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('lève NotFoundException si l\'inscription est introuvable', async () => {
      enrollmentRepo.findOne.mockResolvedValue(null);

      await expect(
        pathsService.updateEnrollmentProgress(ENROLLMENT_ID, {}, ELEVE_ID),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
