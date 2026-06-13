import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { RelationsService } from './relations.service';
import { FinanceOwnerStudentLink } from './entities/finance-owner-student-link.entity';
import { TeacherStudentLink } from './entities/teacher-student-link.entity';
import { PedagogicalCoordinatorLink } from './entities/pedagogical-coordinator-link.entity';
import { EventsService } from '../events/events.service';
import { UserRole } from '../common/enums/user-role.enum';
import { Actor } from '../profiles/profiles.service';

const makeActor = (role: UserRole, id = 'actor-uuid'): Actor => ({ id, role });

describe('RelationsService', () => {
  let service: RelationsService;
  let financeRepo: any;
  let teacherRepo: any;
  let coordinatorRepo: any;
  let eventsService: any;

  beforeEach(async () => {
    financeRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockImplementation((dto) => dto),
      save: jest.fn().mockImplementation(async (entity) => ({ id: 'link-uuid', ...entity, createdAt: new Date() })),
    };

    teacherRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockImplementation((dto) => dto),
      save: jest.fn().mockImplementation(async (entity) => ({ id: 'link-uuid', ...entity, createdAt: new Date() })),
    };

    coordinatorRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockImplementation((dto) => dto),
      save: jest.fn().mockImplementation(async (entity) => ({ id: 'link-uuid', ...entity, createdAt: new Date() })),
    };

    eventsService = { publish: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RelationsService,
        { provide: getRepositoryToken(FinanceOwnerStudentLink), useValue: financeRepo },
        { provide: getRepositoryToken(TeacherStudentLink), useValue: teacherRepo },
        { provide: getRepositoryToken(PedagogicalCoordinatorLink), useValue: coordinatorRepo },
        { provide: EventsService, useValue: eventsService },
      ],
    }).compile();

    service = module.get<RelationsService>(RelationsService);
  });

  // ---------------------------------------------------------------------------
  // linkFinanceOwnerToStudent
  // ---------------------------------------------------------------------------
  describe('linkFinanceOwnerToStudent', () => {
    const dto = { financeOwnerId: 'finance-uuid', studentId: 'student-uuid' };

    it('RP can create a financeur–student link', async () => {
      const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE);
      const result = await service.linkFinanceOwnerToStudent(dto, actor);
      expect(result).toHaveProperty('financeOwnerId', 'finance-uuid');
      expect(eventsService.publish).toHaveBeenCalledWith('StudentLinkedToFinanceOwner', expect.any(Object));
    });

    it('AdministrateurFinancier can create a financeur–student link', async () => {
      const actor = makeActor(UserRole.ADMINISTRATEUR_FINANCIER);
      await expect(service.linkFinanceOwnerToStudent(dto, actor)).resolves.toBeDefined();
    });

    it('throws 403 for formateur', async () => {
      const actor = makeActor(UserRole.FORMATEUR);
      await expect(service.linkFinanceOwnerToStudent(dto, actor)).rejects.toThrow(ForbiddenException);
    });

    it('throws 403 for élève', async () => {
      const actor = makeActor(UserRole.ELEVE);
      await expect(service.linkFinanceOwnerToStudent(dto, actor)).rejects.toThrow(ForbiddenException);
    });

    it('throws 409 when link already exists', async () => {
      financeRepo.findOne.mockResolvedValue({ id: 'existing', ...dto });
      const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE);
      await expect(service.linkFinanceOwnerToStudent(dto, actor)).rejects.toThrow(ConflictException);
    });
  });

  // ---------------------------------------------------------------------------
  // getStudentsByFinanceOwner
  // ---------------------------------------------------------------------------
  describe('getStudentsByFinanceOwner', () => {
    it('RP can list students of any financeur', async () => {
      const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE);
      await expect(service.getStudentsByFinanceOwner('finance-uuid', actor)).resolves.toEqual([]);
    });

    it('financeur can list their own students', async () => {
      const actor = makeActor(UserRole.PARENT_FINANCEUR, 'finance-uuid');
      await expect(service.getStudentsByFinanceOwner('finance-uuid', actor)).resolves.toEqual([]);
    });

    it('throws 403 when financeur tries to list another financeur students', async () => {
      const actor = makeActor(UserRole.PARENT_FINANCEUR, 'other-finance-uuid');
      await expect(service.getStudentsByFinanceOwner('finance-uuid', actor)).rejects.toThrow(ForbiddenException);
    });
  });

  // ---------------------------------------------------------------------------
  // linkTeacherToStudent
  // ---------------------------------------------------------------------------
  describe('linkTeacherToStudent', () => {
    const dto = { teacherId: 'teacher-uuid', studentId: 'student-uuid' };

    it('RP can create a teacher–student link', async () => {
      const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE);
      const result = await service.linkTeacherToStudent(dto, actor);
      expect(result).toHaveProperty('teacherId', 'teacher-uuid');
      expect(eventsService.publish).toHaveBeenCalledWith('TeacherLinkedToStudent', expect.any(Object));
    });

    it('creates link with isPrincipalTeacher flag (PROF-BR-007)', async () => {
      const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE);
      const result = await service.linkTeacherToStudent({ ...dto, isPrincipalTeacher: true }, actor);
      expect(result).toHaveProperty('isPrincipalTeacher', true);
    });

    it('throws 403 for AdministrateurFinancier', async () => {
      const actor = makeActor(UserRole.ADMINISTRATEUR_FINANCIER);
      await expect(service.linkTeacherToStudent(dto, actor)).rejects.toThrow(ForbiddenException);
    });

    it('throws 403 for formateur (PROF-FB-003 context)', async () => {
      const actor = makeActor(UserRole.FORMATEUR);
      await expect(service.linkTeacherToStudent(dto, actor)).rejects.toThrow(ForbiddenException);
    });

    it('throws 409 when link already exists', async () => {
      teacherRepo.findOne.mockResolvedValue({ id: 'existing', ...dto });
      const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE);
      await expect(service.linkTeacherToStudent(dto, actor)).rejects.toThrow(ConflictException);
    });
  });

  // ---------------------------------------------------------------------------
  // getTeachersByStudent — PROF-FB-003
  // ---------------------------------------------------------------------------
  describe('getTeachersByStudent (PROF-FB-003)', () => {
    it('RP can list all teachers of a student', async () => {
      teacherRepo.find.mockResolvedValue([{ teacherId: 't1' }, { teacherId: 't2' }]);
      const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE);
      const result = await service.getTeachersByStudent('student-uuid', actor);
      expect(result).toHaveLength(2);
    });

    it('student can list their own teachers', async () => {
      teacherRepo.find.mockResolvedValue([{ teacherId: 'teacher-uuid', studentId: 'student-uuid' }]);
      const actor = makeActor(UserRole.ELEVE, 'student-uuid');
      const result = await service.getTeachersByStudent('student-uuid', actor);
      expect(result).toHaveLength(1);
    });

    it('formateur can only see their own link (PROF-FB-003)', async () => {
      teacherRepo.find.mockResolvedValue([{ teacherId: 'teacher-uuid', studentId: 'student-uuid' }]);
      const actor = makeActor(UserRole.FORMATEUR, 'teacher-uuid');
      await service.getTeachersByStudent('student-uuid', actor);
      expect(teacherRepo.find).toHaveBeenCalledWith({
        where: { teacherId: 'teacher-uuid', studentId: 'student-uuid' },
      });
    });

    it('throws 403 for parent_financeur viewing another student links', async () => {
      const actor = makeActor(UserRole.PARENT_FINANCEUR, 'parent-uuid');
      await expect(service.getTeachersByStudent('student-uuid', actor)).rejects.toThrow(ForbiddenException);
    });
  });

  // ---------------------------------------------------------------------------
  // linkPedagogicalCoordinator
  // ---------------------------------------------------------------------------
  describe('linkPedagogicalCoordinator', () => {
    const dto = {
      coordinatorId: 'rp-uuid',
      studentId: 'student-uuid',
      coordinatorRole: 'responsable_pedagogique',
    };

    it('RP can assign a coordinator', async () => {
      const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE);
      const result = await service.linkPedagogicalCoordinator(dto, actor);
      expect(result).toHaveProperty('coordinatorId', 'rp-uuid');
      expect(eventsService.publish).toHaveBeenCalledWith('CoordinatorLinkedToStudent', expect.any(Object));
    });

    it('throws 403 for formateur', async () => {
      const actor = makeActor(UserRole.FORMATEUR);
      await expect(service.linkPedagogicalCoordinator(dto, actor)).rejects.toThrow(ForbiddenException);
    });

    it('throws 409 when link already exists', async () => {
      coordinatorRepo.findOne.mockResolvedValue({ id: 'existing', ...dto });
      const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE);
      await expect(service.linkPedagogicalCoordinator(dto, actor)).rejects.toThrow(ConflictException);
    });

    it('coordinator can list their own students', async () => {
      coordinatorRepo.find.mockResolvedValue([{ coordinatorId: 'rp-uuid', studentId: 'student-uuid' }]);
      const actor = makeActor(UserRole.ANIMATEUR_PEDAGOGIQUE, 'rp-uuid');
      const result = await service.getStudentsByCoordinator('rp-uuid', actor);
      expect(result).toHaveLength(1);
    });

    it('throws 403 when coordinator tries to list another coordinator students', async () => {
      const actor = makeActor(UserRole.ANIMATEUR_PEDAGOGIQUE, 'other-uuid');
      await expect(service.getStudentsByCoordinator('rp-uuid', actor)).rejects.toThrow(ForbiddenException);
    });
  });
});
