import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { InternalService } from '../../../src/internal/internal.service';
import { ProfilesService } from '../../../src/profiles/profiles.service';
import { RelationsService } from '../../../src/relations/relations.service';

describe('InternalService', () => {
  let service: InternalService;
  let profilesService: any;
  let relationsService: any;

  beforeEach(async () => {
    profilesService = {
      bootstrapAdministrativeProfile: jest.fn().mockImplementation(async (dto) => ({
        userId: dto.userId,
        firstName: dto.firstName,
        lastName: dto.lastName,
      })),
      bootstrapStudentPedagogicalProfile: jest.fn().mockImplementation(async (dto) => ({
        userId: dto.userId,
        niveauScolaire: dto.level,
      })),
      bootstrapTeacherPedagogicalProfile: jest.fn().mockImplementation(async (dto) => ({
        userId: dto.userId,
        matieresEnseignees: dto.subjects,
        niveauxEnseignes: dto.levels,
      })),
    };

    relationsService = {
      createFinanceOwnerStudentLinkForSystem: jest.fn().mockImplementation(async (financeOwnerId, studentId) => ({
        financeOwnerId,
        studentId,
      })),
      createTeacherStudentLinkForSystem: jest
        .fn()
        .mockImplementation(async (teacherId, studentId, isPrincipalTeacher = false) => ({
          teacherId,
          studentId,
          isPrincipalTeacher,
        })),
      createPedagogicalCoordinatorLinkForSystem: jest
        .fn()
        .mockImplementation(async (coordinatorId, studentId, coordinatorRole) => ({
          coordinatorId,
          studentId,
          coordinatorRole,
        })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InternalService,
        { provide: ProfilesService, useValue: profilesService },
        { provide: RelationsService, useValue: relationsService },
      ],
    }).compile();

    service = module.get<InternalService>(InternalService);
  });

  // ---------------------------------------------------------------------------
  // createAdministrativeProfile
  // ---------------------------------------------------------------------------
  describe('createAdministrativeProfile', () => {
    it('delegates to ProfilesService.bootstrapAdministrativeProfile and shapes the response', async () => {
      const dto = { userId: 'parent-uuid', firstName: 'Marie', lastName: 'Dupont' };
      const result = await service.createAdministrativeProfile(dto);
      expect(profilesService.bootstrapAdministrativeProfile).toHaveBeenCalledWith(dto);
      expect(result).toEqual({
        userId: 'parent-uuid',
        administrativeProfile: { userId: 'parent-uuid', firstName: 'Marie', lastName: 'Dupont' },
      });
    });

    it('propagates errors raised by ProfilesService', async () => {
      profilesService.bootstrapAdministrativeProfile.mockRejectedValue(new ConflictException('boom'));
      await expect(
        service.createAdministrativeProfile({ userId: 'rp-uuid' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ---------------------------------------------------------------------------
  // createParentProfile
  // ---------------------------------------------------------------------------
  describe('createParentProfile', () => {
    it('delegates to ProfilesService.bootstrapAdministrativeProfile and shapes the response (no pedagogical profile)', async () => {
      const dto = { userId: 'parent-uuid', firstName: 'Marie', lastName: 'Dupont', phone: '0601020304' };
      const result = await service.createParentProfile(dto);
      expect(profilesService.bootstrapAdministrativeProfile).toHaveBeenCalledWith(dto);
      expect(result).toEqual({
        userId: 'parent-uuid',
        administrativeProfile: { userId: 'parent-uuid', firstName: 'Marie', lastName: 'Dupont' },
      });
    });

    it('propagates errors raised by ProfilesService', async () => {
      profilesService.bootstrapAdministrativeProfile.mockRejectedValue(new ConflictException('boom'));
      await expect(
        service.createParentProfile({ userId: 'parent-uuid' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ---------------------------------------------------------------------------
  // createStudentProfiles
  // ---------------------------------------------------------------------------
  describe('createStudentProfiles', () => {
    it('bootstraps both administrative and student pedagogical profiles', async () => {
      const dto = { userId: 'student-uuid', firstName: 'Alice', level: 'Terminale' };
      const result = await service.createStudentProfiles(dto);

      expect(profilesService.bootstrapAdministrativeProfile).toHaveBeenCalledWith(dto);
      expect(profilesService.bootstrapStudentPedagogicalProfile).toHaveBeenCalledWith(dto);
      expect(result).toEqual({
        userId: 'student-uuid',
        administrativeProfile: { userId: 'student-uuid', firstName: 'Alice', lastName: undefined },
        pedagogicalProfile: { userId: 'student-uuid', niveauScolaire: 'Terminale' },
      });
    });
  });

  // ---------------------------------------------------------------------------
  // createTeacherProfiles
  // ---------------------------------------------------------------------------
  describe('createTeacherProfiles', () => {
    it('bootstraps both administrative and teacher pedagogical profiles', async () => {
      const dto = { userId: 'teacher-uuid', subjects: ['Mathématiques'], levels: ['Lycée'] };
      const result = await service.createTeacherProfiles(dto);

      expect(profilesService.bootstrapAdministrativeProfile).toHaveBeenCalledWith(dto);
      expect(profilesService.bootstrapTeacherPedagogicalProfile).toHaveBeenCalledWith(dto);
      expect(result).toHaveProperty('userId', 'teacher-uuid');
      expect(result).toHaveProperty('pedagogicalProfile.matieresEnseignees', ['Mathématiques']);
    });
  });

  // ---------------------------------------------------------------------------
  // linkParent
  // ---------------------------------------------------------------------------
  describe('linkParent', () => {
    it('delegates to RelationsService.createFinanceOwnerStudentLinkForSystem', async () => {
      const dto = { studentId: 'student-uuid', financeOwnerId: 'parent-uuid' };
      const result = await service.linkParent(dto);
      expect(relationsService.createFinanceOwnerStudentLinkForSystem).toHaveBeenCalledWith(
        'parent-uuid',
        'student-uuid',
      );
      expect(result).toEqual({ linked: true, contacts: ['parent-uuid'] });
    });

    it('throws 409 when parent is already linked to student', async () => {
      relationsService.createFinanceOwnerStudentLinkForSystem.mockRejectedValue(
        new ConflictException('already linked'),
      );
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
      expect(relationsService.createTeacherStudentLinkForSystem).toHaveBeenCalledWith(
        'teacher-uuid',
        'student-uuid',
        false,
      );
      expect(result).toEqual({ teacherId: 'teacher-uuid', studentId: 'student-uuid', isPrincipalTeacher: false });
    });

    it('creates a teacher–student link with isPrincipalTeacher set to true', async () => {
      const dto = { teacherId: 'teacher-uuid', studentId: 'student-uuid', isPrincipalTeacher: true };
      const result = await service.createTeacherStudentRelation(dto);
      expect(result).toHaveProperty('isPrincipalTeacher', true);
    });

    it('throws 409 when teacher–student link already exists', async () => {
      relationsService.createTeacherStudentLinkForSystem.mockRejectedValue(
        new ConflictException('already linked'),
      );
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
      expect(relationsService.createPedagogicalCoordinatorLinkForSystem).toHaveBeenCalledWith(
        'rp-uuid',
        'student-uuid',
        'responsable_pedagogique',
      );
      expect(result).toEqual(dto);
    });

    it('throws 409 when coordinator–student link already exists', async () => {
      relationsService.createPedagogicalCoordinatorLinkForSystem.mockRejectedValue(
        new ConflictException('already linked'),
      );
      const dto = { coordinatorId: 'rp-uuid', studentId: 'student-uuid', coordinatorRole: 'responsable_pedagogique' };
      await expect(service.linkCoordinator(dto)).rejects.toThrow(ConflictException);
    });
  });
});
