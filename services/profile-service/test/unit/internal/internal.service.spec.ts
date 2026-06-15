import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException } from '@nestjs/common';
import { InternalService } from '../../../src/internal/internal.service';
import { AdministrativeProfile } from '../../../src/profiles/entities/administrative-profile.entity';
import { StudentPedagogicalProfile } from '../../../src/profiles/entities/student-pedagogical-profile.entity';
import { TeacherPedagogicalProfile } from '../../../src/profiles/entities/teacher-pedagogical-profile.entity';
import { FinanceOwnerStudentLink } from '../../../src/relations/entities/finance-owner-student-link.entity';
import { TeacherStudentLink } from '../../../src/relations/entities/teacher-student-link.entity';
import { PedagogicalCoordinatorLink } from '../../../src/relations/entities/pedagogical-coordinator-link.entity';

describe('InternalService', () => {
  let service: InternalService;
  let adminRepo: any;
  let studentPedaRepo: any;
  let teacherPedaRepo: any;
  let financeRepo: any;
  let teacherLinkRepo: any;
  let coordinatorLinkRepo: any;

  beforeEach(async () => {
    adminRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((dto) => dto),
      save: jest.fn().mockImplementation(async (entity) => ({ id: 'admin-uuid', ...entity })),
    };

    studentPedaRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((dto) => dto),
      save: jest.fn().mockImplementation(async (entity) => ({ id: 'peda-uuid', ...entity })),
    };

    teacherPedaRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((dto) => dto),
      save: jest.fn().mockImplementation(async (entity) => ({ id: 'peda-uuid', ...entity })),
    };

    financeRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((dto) => dto),
      save: jest.fn().mockImplementation(async (entity) => ({ id: 'link-uuid', ...entity })),
    };

    teacherLinkRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((dto) => dto),
      save: jest.fn().mockImplementation(async (entity) => ({ id: 'link-uuid', ...entity })),
    };

    coordinatorLinkRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((dto) => dto),
      save: jest.fn().mockImplementation(async (entity) => ({ id: 'link-uuid', ...entity })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InternalService,
        { provide: getRepositoryToken(AdministrativeProfile), useValue: adminRepo },
        { provide: getRepositoryToken(StudentPedagogicalProfile), useValue: studentPedaRepo },
        { provide: getRepositoryToken(TeacherPedagogicalProfile), useValue: teacherPedaRepo },
        { provide: getRepositoryToken(FinanceOwnerStudentLink), useValue: financeRepo },
        { provide: getRepositoryToken(TeacherStudentLink), useValue: teacherLinkRepo },
        { provide: getRepositoryToken(PedagogicalCoordinatorLink), useValue: coordinatorLinkRepo },
      ],
    }).compile();

    service = module.get<InternalService>(InternalService);
  });

  // ---------------------------------------------------------------------------
  // createStudentProfiles
  // ---------------------------------------------------------------------------
  describe('createStudentProfiles', () => {
    it('creates both administrative and student pedagogical profiles', async () => {
      const dto = {
        userId: 'student-uuid',
        firstName: 'Alice',
        lastName: 'Martin',
        level: 'Terminale',
      };
      const result = await service.createStudentProfiles(dto);
      expect(adminRepo.save).toHaveBeenCalled();
      expect(studentPedaRepo.save).toHaveBeenCalled();
      expect(result).toHaveProperty('userId', 'student-uuid');
      expect(result).toHaveProperty('administrativeProfile');
      expect(result).toHaveProperty('pedagogicalProfile');
    });

    it('maps firstName, lastName and birthDate to administrative profile', async () => {
      const dto = {
        userId: 'student-uuid',
        firstName: 'Bob',
        lastName: 'Dupont',
        birthDate: '2005-01-15',
      };
      await service.createStudentProfiles(dto);
      expect(adminRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'student-uuid', firstName: 'Bob', lastName: 'Dupont', dateNaissance: '2005-01-15' }),
      );
    });

    it('maps level to student pedagogical profile', async () => {
      const dto = { userId: 'student-uuid', level: '3ème' };
      await service.createStudentProfiles(dto);
      expect(studentPedaRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'student-uuid', niveauScolaire: '3ème' }),
      );
    });

    it('does not duplicate administrative profile when one already exists (idempotence)', async () => {
      const existingAdmin = { userId: 'student-uuid', firstName: 'Alice' };
      adminRepo.findOne.mockResolvedValue(existingAdmin);
      const dto = { userId: 'student-uuid', firstName: 'Alice' };
      await service.createStudentProfiles(dto);
      expect(adminRepo.save).not.toHaveBeenCalled();
    });

    it('does not duplicate student pedagogical profile when one already exists (idempotence)', async () => {
      const existingPeda = { userId: 'student-uuid', niveauScolaire: 'Terminale' };
      studentPedaRepo.findOne.mockResolvedValue(existingPeda);
      const dto = { userId: 'student-uuid' };
      await service.createStudentProfiles(dto);
      expect(studentPedaRepo.save).not.toHaveBeenCalled();
    });

    it('creates profile without optional fields', async () => {
      const dto = { userId: 'student-uuid' };
      const result = await service.createStudentProfiles(dto);
      expect(result).toHaveProperty('userId', 'student-uuid');
    });
  });

  // ---------------------------------------------------------------------------
  // createTeacherProfiles
  // ---------------------------------------------------------------------------
  describe('createTeacherProfiles', () => {
    it('creates both administrative and teacher pedagogical profiles', async () => {
      const dto = {
        userId: 'teacher-uuid',
        firstName: 'Jean',
        lastName: 'Professeur',
        subjects: ['Mathématiques'],
        levels: ['Lycée'],
      };
      const result = await service.createTeacherProfiles(dto);
      expect(adminRepo.save).toHaveBeenCalled();
      expect(teacherPedaRepo.save).toHaveBeenCalled();
      expect(result).toHaveProperty('userId', 'teacher-uuid');
      expect(result).toHaveProperty('administrativeProfile');
      expect(result).toHaveProperty('pedagogicalProfile');
    });

    it('maps subjects and levels to teacher pedagogical profile', async () => {
      const dto = {
        userId: 'teacher-uuid',
        subjects: ['Physique-Chimie'],
        levels: ['Collège', 'Lycée'],
        bio: '5 ans d\'expérience',
      };
      await service.createTeacherProfiles(dto);
      expect(teacherPedaRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'teacher-uuid',
          matieresEnseignees: ['Physique-Chimie'],
          niveauxEnseignes: ['Collège', 'Lycée'],
          experiencePedagogique: '5 ans d\'expérience',
        }),
      );
    });

    it('does not duplicate administrative profile when one already exists (idempotence)', async () => {
      adminRepo.findOne.mockResolvedValue({ userId: 'teacher-uuid', firstName: 'Jean' });
      const dto = { userId: 'teacher-uuid' };
      await service.createTeacherProfiles(dto);
      expect(adminRepo.save).not.toHaveBeenCalled();
    });

    it('does not duplicate teacher pedagogical profile when one already exists (idempotence)', async () => {
      teacherPedaRepo.findOne.mockResolvedValue({ userId: 'teacher-uuid' });
      const dto = { userId: 'teacher-uuid' };
      await service.createTeacherProfiles(dto);
      expect(teacherPedaRepo.save).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // linkParent
  // ---------------------------------------------------------------------------
  describe('linkParent', () => {
    it('creates a financeur–student link and returns linked true', async () => {
      const dto = { studentId: 'student-uuid', financeOwnerId: 'parent-uuid' };
      const result = await service.linkParent(dto);
      expect(financeRepo.save).toHaveBeenCalled();
      expect(result).toEqual({ linked: true, contacts: ['parent-uuid'] });
    });

    it('throws 409 when parent is already linked to student', async () => {
      financeRepo.findOne.mockResolvedValue({ id: 'existing-link' });
      const dto = { studentId: 'student-uuid', financeOwnerId: 'parent-uuid' };
      await expect(service.linkParent(dto)).rejects.toThrow(ConflictException);
    });
  });

  // ---------------------------------------------------------------------------
  // createTeacherStudentRelation
  // ---------------------------------------------------------------------------
  describe('createTeacherStudentRelation', () => {
    it('creates a teacher–student link with isPrincipalTeacher defaulting to false', async () => {
      const dto = { teacherId: 'teacher-uuid', studentId: 'student-uuid' };
      const result = await service.createTeacherStudentRelation(dto);
      expect(teacherLinkRepo.save).toHaveBeenCalled();
      expect(result).toHaveProperty('teacherId', 'teacher-uuid');
      expect(result).toHaveProperty('studentId', 'student-uuid');
      expect(result).toHaveProperty('isPrincipalTeacher', false);
    });

    it('creates a teacher–student link with isPrincipalTeacher set to true', async () => {
      const dto = { teacherId: 'teacher-uuid', studentId: 'student-uuid', isPrincipalTeacher: true };
      teacherLinkRepo.save.mockResolvedValue({ ...dto });
      const result = await service.createTeacherStudentRelation(dto);
      expect(result).toHaveProperty('isPrincipalTeacher', true);
    });

    it('throws 409 when teacher–student link already exists', async () => {
      teacherLinkRepo.findOne.mockResolvedValue({ id: 'existing-link' });
      const dto = { teacherId: 'teacher-uuid', studentId: 'student-uuid' };
      await expect(service.createTeacherStudentRelation(dto)).rejects.toThrow(ConflictException);
    });
  });

  // ---------------------------------------------------------------------------
  // linkCoordinator
  // ---------------------------------------------------------------------------
  describe('linkCoordinator', () => {
    it('creates a coordinator–student link', async () => {
      const dto = { coordinatorId: 'rp-uuid', studentId: 'student-uuid', coordinatorRole: 'responsable_pedagogique' };
      const result = await service.linkCoordinator(dto);
      expect(coordinatorLinkRepo.save).toHaveBeenCalled();
      expect(result).toHaveProperty('coordinatorId', 'rp-uuid');
      expect(result).toHaveProperty('studentId', 'student-uuid');
      expect(result).toHaveProperty('coordinatorRole', 'responsable_pedagogique');
    });

    it('throws 409 when coordinator–student link already exists', async () => {
      coordinatorLinkRepo.findOne.mockResolvedValue({ id: 'existing-link' });
      const dto = { coordinatorId: 'rp-uuid', studentId: 'student-uuid', coordinatorRole: 'responsable_pedagogique' };
      await expect(service.linkCoordinator(dto)).rejects.toThrow(ConflictException);
    });
  });
});
