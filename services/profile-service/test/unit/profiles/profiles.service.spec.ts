import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ProfilesService, Actor } from '../../../src/profiles/profiles.service';
import { AdministrativeProfile } from '../../../src/profiles/entities/administrative-profile.entity';
import { StudentPedagogicalProfile } from '../../../src/profiles/entities/student-pedagogical-profile.entity';
import { TeacherPedagogicalProfile } from '../../../src/profiles/entities/teacher-pedagogical-profile.entity';
import { InternalProfileNote } from '../../../src/profiles/entities/internal-profile-note.entity';
import { TeacherValidation } from '../../../src/profiles/entities/teacher-validation.entity';
import { ProfileVisibilityPreference } from '../../../src/profiles/entities/profile-visibility-preference.entity';
import { RelationsService } from '../../../src/relations/relations.service';
import { EventsService } from '../../../src/events/events.service';
import {
  IdentityAccessClient,
  IdentityAccessNotFoundError,
  IdentityAccessUnavailableError,
} from '../../../src/common/clients/identity-access.client';
import { UserRole } from '../../../src/common/enums/user-role.enum';

const makeActor = (role: UserRole, id = 'actor-uuid'): Actor => ({ id, role });

describe('ProfilesService', () => {
  let service: ProfilesService;
  let adminRepo: any;
  let studentPedaRepo: any;
  let teacherPedaRepo: any;
  let noteRepo: any;
  let teacherValidationRepo: any;
  let visibilityPrefRepo: any;
  let relationsService: any;
  let eventsService: any;
  let identityAccessClient: any;
  let dataSource: any;

  beforeEach(async () => {
    identityAccessClient = {
      findAccountByUserId: jest.fn().mockResolvedValue({
        userId: 'student-uuid',
        loginIdentifier: 'alice.martin',
        role: 'eleve',
      }),
      findAccountByLoginIdentifier: jest.fn(),
    };

    adminRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockImplementation((dto) => dto),
      save: jest.fn().mockImplementation(async (entity) => ({ ...entity, updatedAt: new Date() })),
    };

    studentPedaRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((dto) => dto),
      save: jest.fn().mockImplementation(async (entity) => ({ ...entity, updatedAt: new Date() })),
    };

    teacherPedaRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((dto) => dto),
      save: jest.fn().mockImplementation(async (entity) => ({ ...entity, updatedAt: new Date() })),
    };

    noteRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockImplementation((dto) => dto),
      save: jest.fn().mockImplementation(async (entity) => ({ id: 'note-uuid', ...entity, createdAt: new Date() })),
      remove: jest.fn().mockResolvedValue(undefined),
    };

    teacherValidationRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockImplementation((dto) => dto),
      save: jest.fn().mockImplementation(async (entity) => ({ id: 'validation-uuid', ...entity, updatedAt: new Date() })),
    };

    visibilityPrefRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((dto) => dto),
      save: jest.fn().mockImplementation(async (entity) => ({ ...entity, updatedAt: new Date() })),
    };

    relationsService = {
      isTeacherLinkedToStudent: jest.fn().mockResolvedValue(false),
      isFinanceOwnerLinkedToStudent: jest.fn().mockResolvedValue(false),
    };
    eventsService = { publish: jest.fn() };

    // Fake DataSource.transaction: runs the callback with a manager whose
    // getRepository() resolves to the same repo mocks used outside the
    // transaction, so assertions on adminRepo/studentPedaRepo/teacherPedaRepo
    // keep working transparently whether or not a given code path goes
    // through a transaction.
    dataSource = {
      transaction: jest.fn().mockImplementation(async (runInTransaction: (manager: unknown) => Promise<unknown>) => {
        const manager = {
          getRepository: (entity: unknown) => {
            if (entity === AdministrativeProfile) return adminRepo;
            if (entity === StudentPedagogicalProfile) return studentPedaRepo;
            if (entity === TeacherPedagogicalProfile) return teacherPedaRepo;
            throw new Error('No repository mock configured for this entity in the fake transaction manager');
          },
        };
        return runInTransaction(manager);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfilesService,
        { provide: getRepositoryToken(AdministrativeProfile), useValue: adminRepo },
        { provide: getRepositoryToken(StudentPedagogicalProfile), useValue: studentPedaRepo },
        { provide: getRepositoryToken(TeacherPedagogicalProfile), useValue: teacherPedaRepo },
        { provide: getRepositoryToken(InternalProfileNote), useValue: noteRepo },
        { provide: getRepositoryToken(TeacherValidation), useValue: teacherValidationRepo },
        { provide: getRepositoryToken(ProfileVisibilityPreference), useValue: visibilityPrefRepo },
        { provide: RelationsService, useValue: relationsService },
        { provide: EventsService, useValue: eventsService },
        { provide: IdentityAccessClient, useValue: identityAccessClient },
        { provide: getDataSourceToken(), useValue: dataSource },
      ],
    }).compile();

    service = module.get<ProfilesService>(ProfilesService);
  });

  // ---------------------------------------------------------------------------
  // getProfile
  // ---------------------------------------------------------------------------
  describe('getProfile', () => {
    const mockAdminProfile = { userId: 'student-uuid', firstName: 'Alice', lastName: 'Martin' };

    it('returns profile data for RP regardless of target', async () => {
      adminRepo.findOne.mockResolvedValue(mockAdminProfile);
      const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE);
      const result = await service.getProfile('student-uuid', actor);
      expect(result).toHaveProperty('userId', 'student-uuid');
    });

    it('returns own profile for élève', async () => {
      adminRepo.findOne.mockResolvedValue(mockAdminProfile);
      const actor = makeActor(UserRole.ELEVE, 'student-uuid');
      const result = await service.getProfile('student-uuid', actor);
      expect(result.userId).toBe('student-uuid');
    });

    it('includes loginIdentifier from identity-access-service', async () => {
      adminRepo.findOne.mockResolvedValue(mockAdminProfile);
      identityAccessClient.findAccountByUserId.mockResolvedValue({
        userId: 'student-uuid',
        loginIdentifier: 'alice.martin',
        role: 'eleve',
      });
      const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE);
      const result = await service.getProfile('student-uuid', actor);
      expect(result).toHaveProperty('loginIdentifier', 'alice.martin');
    });

    it('returns loginIdentifier null when identity-access-service returns 404', async () => {
      adminRepo.findOne.mockResolvedValue(mockAdminProfile);
      identityAccessClient.findAccountByUserId.mockRejectedValue(
        new IdentityAccessNotFoundError('not found'),
      );
      const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE);
      const result = await service.getProfile('student-uuid', actor);
      expect(result).toHaveProperty('loginIdentifier', null);
    });

    it('returns loginIdentifier null on network error (graceful degradation)', async () => {
      adminRepo.findOne.mockResolvedValue(mockAdminProfile);
      identityAccessClient.findAccountByUserId.mockRejectedValue(
        new IdentityAccessUnavailableError('ECONNREFUSED'),
      );
      const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE);
      const result = await service.getProfile('student-uuid', actor);
      expect(result).toHaveProperty('loginIdentifier', null);
    });

    // Regression test: a real infrastructure/config failure between
    // profile-service and identity-access-service (e.g. mismatched
    // INTERNAL_SECRET causing a 401/403, wrong URL, DNS failure, timeout —
    // all surfaced as IdentityAccessUnavailableError) must remain visible in
    // logs even though the caller still degrades gracefully to
    // loginIdentifier: null. It must not look like a routine 404 "account
    // not found" (IdentityAccessNotFoundError), which is not logged as an
    // error.
    it('logs an error when loginIdentifier resolution fails due to a config/infra error (distinct from a plain 404)', async () => {
      adminRepo.findOne.mockResolvedValue(mockAdminProfile);
      const errorSpy = jest.spyOn((service as any).logger, 'error').mockImplementation(() => undefined);
      identityAccessClient.findAccountByUserId.mockRejectedValue(
        new IdentityAccessUnavailableError('identity-access-service returned HTTP 401'),
      );

      const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE);
      const result = await service.getProfile('student-uuid', actor);

      expect(result).toHaveProperty('loginIdentifier', null);
      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy.mock.calls[0][0]).toEqual(expect.stringContaining('student-uuid'));
    });

    it('does not log an error when loginIdentifier resolution fails with a plain 404 (expected case)', async () => {
      adminRepo.findOne.mockResolvedValue(mockAdminProfile);
      const errorSpy = jest.spyOn((service as any).logger, 'error').mockImplementation(() => undefined);
      identityAccessClient.findAccountByUserId.mockRejectedValue(
        new IdentityAccessNotFoundError('not found'),
      );

      const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE);
      const result = await service.getProfile('student-uuid', actor);

      expect(result).toHaveProperty('loginIdentifier', null);
      expect(errorSpy).not.toHaveBeenCalled();
    });

    it('throws 403 when élève tries to view another profile', async () => {
      const actor = makeActor(UserRole.ELEVE, 'student-uuid');
      await expect(service.getProfile('other-uuid', actor)).rejects.toThrow(ForbiddenException);
    });

    it('allows formateur to view linked student profile (PROF-FB-003)', async () => {
      adminRepo.findOne.mockResolvedValue(mockAdminProfile);
      const actor = makeActor(UserRole.FORMATEUR, 'teacher-uuid');
      relationsService.isTeacherLinkedToStudent.mockResolvedValue(true);

      const result = await service.getProfile('student-uuid', actor);
      expect(result.userId).toBe('student-uuid');
      expect(relationsService.isTeacherLinkedToStudent).toHaveBeenCalledWith('teacher-uuid', 'student-uuid');
    });

    it('throws 403 when formateur views non-linked student (PROF-FB-003)', async () => {
      const actor = makeActor(UserRole.FORMATEUR, 'teacher-uuid');
      relationsService.isTeacherLinkedToStudent.mockResolvedValue(false);

      await expect(service.getProfile('student-uuid', actor)).rejects.toThrow(ForbiddenException);
    });

    it('allows parent_financeur to view linked student profile (PROF-RA-002)', async () => {
      adminRepo.findOne.mockResolvedValue(mockAdminProfile);
      const actor = makeActor(UserRole.PARENT_FINANCEUR, 'parent-uuid');
      relationsService.isFinanceOwnerLinkedToStudent.mockResolvedValue(true);

      const result = await service.getProfile('student-uuid', actor);
      expect(result.userId).toBe('student-uuid');
      expect(relationsService.isFinanceOwnerLinkedToStudent).toHaveBeenCalledWith('parent-uuid', 'student-uuid');
    });

    it('throws 403 when parent_financeur views non-linked student (PROF-RA-002)', async () => {
      const actor = makeActor(UserRole.PARENT_FINANCEUR, 'parent-uuid');
      relationsService.isFinanceOwnerLinkedToStudent.mockResolvedValue(false);

      await expect(service.getProfile('student-uuid', actor)).rejects.toThrow(ForbiddenException);
    });

    it('creates a minimal administrative profile when no profile exists for userId', async () => {
      const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE);
      // All repos return null by default — simulates a brand-new user with no profile yet
      const minimalAdminProfile = { userId: 'new-user-uuid' };
      adminRepo.create.mockReturnValue(minimalAdminProfile);
      adminRepo.save.mockResolvedValue(minimalAdminProfile);

      const result = await service.getProfile('new-user-uuid', actor);

      expect(adminRepo.create).toHaveBeenCalledWith({ userId: 'new-user-uuid' });
      expect(adminRepo.save).toHaveBeenCalled();
      expect(result).toHaveProperty('userId', 'new-user-uuid');
      expect(result).toHaveProperty('administrative', minimalAdminProfile);
      // RP consulting an unknown user does not trigger student peda lazy-creation
      expect(studentPedaRepo.save).not.toHaveBeenCalled();
    });

    it('creates both administrative and student pedagogical profiles for an élève viewing their own account', async () => {
      const eleveId = '87482274-1ef2-412a-827b-75fc48c28370';
      const actor = makeActor(UserRole.ELEVE, eleveId);
      const minimalAdminProfile = { userId: eleveId };
      const minimalStudentPeda = { userId: eleveId };
      adminRepo.create.mockReturnValue(minimalAdminProfile);
      adminRepo.save.mockResolvedValue(minimalAdminProfile);
      studentPedaRepo.create.mockReturnValue(minimalStudentPeda);
      studentPedaRepo.save.mockResolvedValue(minimalStudentPeda);

      const result = await service.getProfile(eleveId, actor);

      // Administrative profile must be persisted
      expect(adminRepo.create).toHaveBeenCalledWith({ userId: eleveId });
      expect(adminRepo.save).toHaveBeenCalled();
      expect(result).toHaveProperty('administrative', minimalAdminProfile);

      // Student pedagogical profile must also be persisted (this was the bug)
      expect(studentPedaRepo.create).toHaveBeenCalledWith({ userId: eleveId });
      expect(studentPedaRepo.save).toHaveBeenCalled();
      expect(result).toHaveProperty('pedagogical', minimalStudentPeda);

      expect(result.userId).toBe(eleveId);

      // Both writes are atomic: a single DataSource.transaction call wraps them
      // (services-convention: multi-write operations use DataSource.transaction).
      expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    });

    it('does not open a transaction when no lazy-init write is needed', async () => {
      const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE);
      adminRepo.findOne.mockResolvedValue({ userId: 'student-uuid' });
      studentPedaRepo.findOne.mockResolvedValue({ userId: 'student-uuid', niveauScolaire: 'Terminale' });

      await service.getProfile('student-uuid', actor);

      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('does not create student peda profile for élève when one already exists', async () => {
      const eleveId = '87482274-1ef2-412a-827b-75fc48c28370';
      const actor = makeActor(UserRole.ELEVE, eleveId);
      const existingAdmin = { userId: eleveId, firstName: 'Alice' };
      const existingPeda = { userId: eleveId, niveauScolaire: 'Terminale' };
      adminRepo.findOne.mockResolvedValue(existingAdmin);
      studentPedaRepo.findOne.mockResolvedValue(existingPeda);

      const result = await service.getProfile(eleveId, actor);

      expect(adminRepo.save).not.toHaveBeenCalled();
      expect(studentPedaRepo.save).not.toHaveBeenCalled();
      expect(result).toHaveProperty('pedagogical', existingPeda);
    });

    it('does not create a duplicate administrative profile when one already exists', async () => {
      const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE);
      const existingAdminProfile = { userId: 'student-uuid', firstName: 'Alice' };
      adminRepo.findOne.mockResolvedValue(existingAdminProfile);

      await service.getProfile('student-uuid', actor);

      // adminRepo.save should not be called since the profile already exists
      expect(adminRepo.save).not.toHaveBeenCalled();
    });

    it('does not create student peda profile when RP consults an élève without peda profile', async () => {
      const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE);
      // admin exists, no peda — RP is not the owner so no lazy-creation of peda
      adminRepo.findOne.mockResolvedValue({ userId: 'student-uuid' });

      const result = await service.getProfile('student-uuid', actor);

      expect(studentPedaRepo.save).not.toHaveBeenCalled();
      expect(result).toHaveProperty('pedagogical', null);
    });

    it('creates both administrative and teacher pedagogical profiles for a formateur viewing their own account', async () => {
      const teacherId = 'bba9e321-4f12-4c8a-b6d3-000000000001';
      const actor = makeActor(UserRole.FORMATEUR, teacherId);
      const minimalAdminProfile = { userId: teacherId };
      const minimalTeacherPeda = { userId: teacherId, isAnimateurPedagogique: false };
      adminRepo.create.mockReturnValue(minimalAdminProfile);
      adminRepo.save.mockResolvedValue(minimalAdminProfile);
      teacherPedaRepo.create.mockReturnValue(minimalTeacherPeda);
      teacherPedaRepo.save.mockResolvedValue(minimalTeacherPeda);

      const result = await service.getProfile(teacherId, actor);

      // Administrative profile must be persisted
      expect(adminRepo.create).toHaveBeenCalledWith({ userId: teacherId });
      expect(adminRepo.save).toHaveBeenCalled();
      expect(result).toHaveProperty('administrative', minimalAdminProfile);

      // Teacher pedagogical profile must also be persisted
      expect(teacherPedaRepo.create).toHaveBeenCalledWith({ userId: teacherId });
      expect(teacherPedaRepo.save).toHaveBeenCalled();
      expect(result).toHaveProperty('pedagogical', minimalTeacherPeda);

      expect(result.userId).toBe(teacherId);
    });

    it('does not create teacher peda profile for formateur when one already exists', async () => {
      const teacherId = 'bba9e321-4f12-4c8a-b6d3-000000000001';
      const actor = makeActor(UserRole.FORMATEUR, teacherId);
      const existingAdmin = { userId: teacherId, firstName: 'Jean' };
      const existingTeacherPeda = { userId: teacherId, niveauxEnseignes: ['Lycée'] };
      adminRepo.findOne.mockResolvedValue(existingAdmin);
      teacherPedaRepo.findOne.mockResolvedValue(existingTeacherPeda);

      const result = await service.getProfile(teacherId, actor);

      expect(adminRepo.save).not.toHaveBeenCalled();
      expect(teacherPedaRepo.save).not.toHaveBeenCalled();
      expect(result).toHaveProperty('pedagogical', existingTeacherPeda);
    });

    it('does not create teacher peda profile when RP consults a formateur without peda profile', async () => {
      const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE);
      // admin exists, no peda — RP is not the owner so no lazy-creation of teacher peda
      adminRepo.findOne.mockResolvedValue({ userId: 'teacher-uuid' });

      const result = await service.getProfile('teacher-uuid', actor);

      expect(teacherPedaRepo.save).not.toHaveBeenCalled();
      expect(result).toHaveProperty('pedagogical', null);
    });

    it('does not create student peda for formateur viewing own profile (only teacher peda)', async () => {
      const teacherId = 'bba9e321-4f12-4c8a-b6d3-000000000001';
      const actor = makeActor(UserRole.FORMATEUR, teacherId);
      const minimalTeacherPeda = { userId: teacherId };
      teacherPedaRepo.create.mockReturnValue(minimalTeacherPeda);
      teacherPedaRepo.save.mockResolvedValue(minimalTeacherPeda);

      await service.getProfile(teacherId, actor);

      expect(studentPedaRepo.save).not.toHaveBeenCalled();
      expect(teacherPedaRepo.save).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // updateAdministrativeProfile
  // ---------------------------------------------------------------------------
  describe('updateAdministrativeProfile', () => {
    it('creates admin profile when it does not exist', async () => {
      const actor = makeActor(UserRole.ELEVE, 'user-uuid');
      const dto = { firstName: 'Alice', lastName: 'Martin' };
      const result = await service.updateAdministrativeProfile('user-uuid', dto, actor);
      expect(adminRepo.save).toHaveBeenCalled();
      expect(eventsService.publish).toHaveBeenCalledWith('ProfileUpdated', expect.objectContaining({ userId: 'user-uuid' }));
    });

    it('updates existing admin profile', async () => {
      const existing = { userId: 'user-uuid', firstName: 'Old', lastName: 'Name' };
      adminRepo.findOne.mockResolvedValue(existing);
      const actor = makeActor(UserRole.ELEVE, 'user-uuid');
      await service.updateAdministrativeProfile('user-uuid', { firstName: 'New' }, actor);
      expect(adminRepo.save).toHaveBeenCalledWith(expect.objectContaining({ firstName: 'New' }));
    });

    it('allows RP to update any user profile', async () => {
      const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE);
      await expect(
        service.updateAdministrativeProfile('other-user-uuid', { firstName: 'Test' }, actor),
      ).resolves.toBeDefined();
    });

    it('throws 403 when a regular user tries to update another user profile', async () => {
      const actor = makeActor(UserRole.ELEVE, 'user-uuid');
      await expect(
        service.updateAdministrativeProfile('other-uuid', { firstName: 'Hack' }, actor),
      ).rejects.toThrow(ForbiddenException);
    });

    it('accepts departement and passions fields', async () => {
      const actor = makeActor(UserRole.ELEVE, 'user-uuid');
      const dto = { departement: '75 - Paris', passions: ['Musique', 'Randonnée'] };
      await service.updateAdministrativeProfile('user-uuid', dto, actor);
      expect(adminRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ departement: '75 - Paris', passions: ['Musique', 'Randonnée'] }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // updatePedagogicalProfile
  // ---------------------------------------------------------------------------
  describe('updatePedagogicalProfile', () => {
    it('creates student pedagogical profile when payload has niveauScolaire', async () => {
      const actor = makeActor(UserRole.ELEVE, 'user-uuid');
      const dto = { niveauScolaire: 'Terminale', matieres: ['Mathématiques'] };
      await service.updatePedagogicalProfile('user-uuid', dto, actor);
      expect(studentPedaRepo.save).toHaveBeenCalled();
      expect(eventsService.publish).toHaveBeenCalledWith(
        'ProfileUpdated',
        expect.objectContaining({ userId: 'user-uuid', section: 'pedagogical-student' }),
      );
    });

    it('updates existing student pedagogical profile', async () => {
      const existingProfile = { userId: 'user-uuid', niveauScolaire: '3ème', matieres: [] };
      studentPedaRepo.findOne.mockResolvedValue(existingProfile);
      const actor = makeActor(UserRole.ELEVE, 'user-uuid');
      const dto = { niveauScolaire: 'Seconde', objectifsPedagogiques: 'Préparer le bac' };
      await service.updatePedagogicalProfile('user-uuid', dto, actor);
      expect(studentPedaRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ niveauScolaire: 'Seconde', objectifsPedagogiques: 'Préparer le bac' }),
      );
    });

    it('creates teacher pedagogical profile when payload has niveauxEnseignes', async () => {
      const actor = makeActor(UserRole.FORMATEUR, 'teacher-uuid');
      const dto = { niveauxEnseignes: ['Lycée'], matieresEnseignees: ['Mathématiques'] };
      await service.updatePedagogicalProfile('teacher-uuid', dto, actor);
      expect(teacherPedaRepo.save).toHaveBeenCalled();
      expect(eventsService.publish).toHaveBeenCalledWith(
        'ProfileUpdated',
        expect.objectContaining({ userId: 'teacher-uuid', section: 'pedagogical-teacher' }),
      );
    });

    it('updates existing teacher pedagogical profile', async () => {
      const existingProfile = { userId: 'teacher-uuid', niveauxEnseignes: ['Collège'], matieresEnseignees: [] };
      teacherPedaRepo.findOne.mockResolvedValue(existingProfile);
      const actor = makeActor(UserRole.FORMATEUR, 'teacher-uuid');
      const dto = { matieresEnseignees: ['Physique-Chimie'], experiencePedagogique: '3 ans' };
      await service.updatePedagogicalProfile('teacher-uuid', dto, actor);
      expect(teacherPedaRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ matieresEnseignees: ['Physique-Chimie'], experiencePedagogique: '3 ans' }),
      );
    });

    it('allows RP to update pedagogical profile of any user', async () => {
      const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE);
      const dto = { niveauScolaire: '3ème' };
      await expect(
        service.updatePedagogicalProfile('student-uuid', dto, actor),
      ).resolves.toBeDefined();
    });

    it('allows TI to update pedagogical profile of any user', async () => {
      const actor = makeActor(UserRole.TECHNICIEN_INFORMATIQUE);
      const dto = { niveauScolaire: 'Seconde' };
      await expect(
        service.updatePedagogicalProfile('student-uuid', dto, actor),
      ).resolves.toBeDefined();
    });

    it('throws 403 when élève tries to update another user pedagogical profile', async () => {
      const actor = makeActor(UserRole.ELEVE, 'student-uuid');
      const dto = { niveauScolaire: 'Terminale' };
      await expect(
        service.updatePedagogicalProfile('other-uuid', dto, actor),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws 403 when formateur tries to update student pedagogical profile', async () => {
      const actor = makeActor(UserRole.FORMATEUR, 'teacher-uuid');
      const dto = { niveauScolaire: 'Terminale' };
      await expect(
        service.updatePedagogicalProfile('student-uuid', dto, actor),
      ).rejects.toThrow(ForbiddenException);
    });

    it('accepts besoinsSpecifiques field on student profile', async () => {
      const actor = makeActor(UserRole.ELEVE, 'user-uuid');
      const dto = { besoinsSpecifiques: 'Dyslexie légère' };
      await service.updatePedagogicalProfile('user-uuid', dto, actor);
      expect(studentPedaRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ besoinsSpecifiques: 'Dyslexie légère' }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Internal notes — PROF-FB-002
  // ---------------------------------------------------------------------------
  describe('getInternalNotes (PROF-FB-002)', () => {
    it('returns notes for RP', async () => {
      noteRepo.find.mockResolvedValue([{ id: 'note-1', content: 'ok' }]);
      const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE);
      const result = await service.getInternalNotes('user-uuid', actor);
      expect(result).toHaveLength(1);
    });

    it('returns notes for AnimateurPedagogique', async () => {
      noteRepo.find.mockResolvedValue([{ id: 'note-2', content: 'ap note' }]);
      const actor = makeActor(UserRole.ANIMATEUR_PEDAGOGIQUE);
      const result = await service.getInternalNotes('user-uuid', actor);
      expect(result).toHaveLength(1);
    });

    it('returns notes for TechnicienInformatique', async () => {
      noteRepo.find.mockResolvedValue([]);
      const actor = makeActor(UserRole.TECHNICIEN_INFORMATIQUE);
      await expect(service.getInternalNotes('user-uuid', actor)).resolves.toEqual([]);
    });

    it('returns notes for AdministrateurFinancier', async () => {
      noteRepo.find.mockResolvedValue([]);
      const actor = makeActor(UserRole.ADMINISTRATEUR_FINANCIER);
      await expect(service.getInternalNotes('user-uuid', actor)).resolves.toEqual([]);
    });

    it('throws 403 for élève (PROF-FB-002)', async () => {
      const actor = makeActor(UserRole.ELEVE);
      await expect(service.getInternalNotes('user-uuid', actor)).rejects.toThrow(ForbiddenException);
    });

    it('throws 403 for parent_financeur (PROF-FB-002)', async () => {
      const actor = makeActor(UserRole.PARENT_FINANCEUR);
      await expect(service.getInternalNotes('user-uuid', actor)).rejects.toThrow(ForbiddenException);
    });

    it('throws 403 for formateur (PROF-FB-002)', async () => {
      const actor = makeActor(UserRole.FORMATEUR);
      await expect(service.getInternalNotes('user-uuid', actor)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getInternalNote (single — PROF-FB-002)', () => {
    const existingNote = {
      id: 'note-uuid',
      targetUserId: 'user-uuid',
      authorId: 'rp-uuid',
      content: 'Detail note',
    };

    it('RP can retrieve a single note', async () => {
      noteRepo.findOne.mockResolvedValue(existingNote);
      const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE);
      const result = await service.getInternalNote('user-uuid', 'note-uuid', actor);
      expect(result).toHaveProperty('id', 'note-uuid');
    });

    it('AP can retrieve a single note', async () => {
      noteRepo.findOne.mockResolvedValue(existingNote);
      const actor = makeActor(UserRole.ANIMATEUR_PEDAGOGIQUE);
      const result = await service.getInternalNote('user-uuid', 'note-uuid', actor);
      expect(result).toHaveProperty('id', 'note-uuid');
    });

    it('TI can retrieve a single note', async () => {
      noteRepo.findOne.mockResolvedValue(existingNote);
      const actor = makeActor(UserRole.TECHNICIEN_INFORMATIQUE);
      const result = await service.getInternalNote('user-uuid', 'note-uuid', actor);
      expect(result).toHaveProperty('id', 'note-uuid');
    });

    it('AF can retrieve a single note', async () => {
      noteRepo.findOne.mockResolvedValue(existingNote);
      const actor = makeActor(UserRole.ADMINISTRATEUR_FINANCIER);
      const result = await service.getInternalNote('user-uuid', 'note-uuid', actor);
      expect(result).toHaveProperty('id', 'note-uuid');
    });

    it('throws 404 when note does not exist', async () => {
      noteRepo.findOne.mockResolvedValue(null);
      const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE);
      await expect(
        service.getInternalNote('user-uuid', 'unknown-uuid', actor),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws 403 for élève (PROF-FB-002)', async () => {
      const actor = makeActor(UserRole.ELEVE);
      await expect(
        service.getInternalNote('user-uuid', 'note-uuid', actor),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws 403 for parent_financeur (PROF-FB-002)', async () => {
      const actor = makeActor(UserRole.PARENT_FINANCEUR);
      await expect(
        service.getInternalNote('user-uuid', 'note-uuid', actor),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws 403 for formateur (PROF-FB-002)', async () => {
      const actor = makeActor(UserRole.FORMATEUR);
      await expect(
        service.getInternalNote('user-uuid', 'note-uuid', actor),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('createInternalNote (PROF-FB-002)', () => {
    it('RP can create an internal note', async () => {
      const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE);
      const result = await service.createInternalNote('user-uuid', { content: 'Note text' }, actor);
      expect(noteRepo.save).toHaveBeenCalled();
      expect(result).toHaveProperty('content', 'Note text');
    });

    it('AP can create an internal note', async () => {
      const actor = makeActor(UserRole.ANIMATEUR_PEDAGOGIQUE);
      const result = await service.createInternalNote('user-uuid', { content: 'AP note' }, actor);
      expect(noteRepo.save).toHaveBeenCalled();
      expect(result).toHaveProperty('content', 'AP note');
    });

    it('throws 403 when AdministrateurFinancier tries to create a note (PROF-FB-002)', async () => {
      const actor = makeActor(UserRole.ADMINISTRATEUR_FINANCIER);
      await expect(
        service.createInternalNote('user-uuid', { content: 'af note' }, actor),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws 403 when TI tries to create a note (PROF-FB-002)', async () => {
      const actor = makeActor(UserRole.TECHNICIEN_INFORMATIQUE);
      await expect(
        service.createInternalNote('user-uuid', { content: 'ti note' }, actor),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws 403 when formateur tries to create a note (PROF-FB-002)', async () => {
      const actor = makeActor(UserRole.FORMATEUR);
      await expect(
        service.createInternalNote('user-uuid', { content: 'hack' }, actor),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('updateInternalNote (PROF-FB-002)', () => {
    const rpAuthoredNote = {
      id: 'note-uuid',
      targetUserId: 'user-uuid',
      authorId: 'rp-uuid',
      authorRole: UserRole.RESPONSABLE_PEDAGOGIQUE,
      content: 'Original content',
    };
    const apAuthoredNote = {
      id: 'note-uuid-2',
      targetUserId: 'user-uuid',
      authorId: 'ap-uuid',
      authorRole: UserRole.ANIMATEUR_PEDAGOGIQUE,
      content: 'AP original content',
    };

    it('RP author can update their own note', async () => {
      noteRepo.findOne.mockResolvedValue(rpAuthoredNote);
      const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE, 'rp-uuid');
      const result = await service.updateInternalNote('user-uuid', 'note-uuid', { content: 'Updated' }, actor);
      expect(noteRepo.save).toHaveBeenCalledWith(expect.objectContaining({ content: 'Updated' }));
    });

    it('any RP can update a note even if not the author', async () => {
      noteRepo.findOne.mockResolvedValue(apAuthoredNote);
      const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE, 'other-rp-uuid');
      const result = await service.updateInternalNote('user-uuid', 'note-uuid-2', { content: 'RP override' }, actor);
      expect(noteRepo.save).toHaveBeenCalledWith(expect.objectContaining({ content: 'RP override' }));
    });

    it('AP author can update their own note', async () => {
      noteRepo.findOne.mockResolvedValue(apAuthoredNote);
      const actor = makeActor(UserRole.ANIMATEUR_PEDAGOGIQUE, 'ap-uuid');
      await service.updateInternalNote('user-uuid', 'note-uuid-2', { content: 'AP updated' }, actor);
      expect(noteRepo.save).toHaveBeenCalledWith(expect.objectContaining({ content: 'AP updated' }));
    });

    it('throws 403 when AP tries to update another author note', async () => {
      noteRepo.findOne.mockResolvedValue(rpAuthoredNote);
      const actor = makeActor(UserRole.ANIMATEUR_PEDAGOGIQUE, 'different-ap-uuid');
      await expect(
        service.updateInternalNote('user-uuid', 'note-uuid', { content: 'hack' }, actor),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws 403 when TI tries to update a note', async () => {
      const actor = makeActor(UserRole.TECHNICIEN_INFORMATIQUE, 'ti-uuid');
      await expect(
        service.updateInternalNote('user-uuid', 'note-uuid', { content: 'hack' }, actor),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws 403 when AF tries to update a note', async () => {
      const actor = makeActor(UserRole.ADMINISTRATEUR_FINANCIER, 'af-uuid');
      await expect(
        service.updateInternalNote('user-uuid', 'note-uuid', { content: 'hack' }, actor),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws 404 when note does not exist', async () => {
      noteRepo.findOne.mockResolvedValue(null);
      const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE, 'rp-uuid');
      await expect(
        service.updateInternalNote('user-uuid', 'unknown-uuid', { content: 'x' }, actor),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteInternalNote (PROF-FB-002)', () => {
    const existingNote = {
      id: 'note-uuid',
      targetUserId: 'user-uuid',
      authorId: 'rp-uuid',
      content: 'To be deleted',
    };

    it('RP can delete a note', async () => {
      noteRepo.findOne.mockResolvedValue(existingNote);
      noteRepo.remove = jest.fn().mockResolvedValue(undefined);
      const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE);
      await expect(
        service.deleteInternalNote('user-uuid', 'note-uuid', actor),
      ).resolves.toBeUndefined();
      expect(noteRepo.remove).toHaveBeenCalledWith(existingNote);
    });

    it('throws 403 when AP tries to delete a note (RP only)', async () => {
      const actor = makeActor(UserRole.ANIMATEUR_PEDAGOGIQUE);
      await expect(
        service.deleteInternalNote('user-uuid', 'note-uuid', actor),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws 403 when TI tries to delete a note', async () => {
      const actor = makeActor(UserRole.TECHNICIEN_INFORMATIQUE);
      await expect(
        service.deleteInternalNote('user-uuid', 'note-uuid', actor),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws 403 when AF tries to delete a note', async () => {
      const actor = makeActor(UserRole.ADMINISTRATEUR_FINANCIER);
      await expect(
        service.deleteInternalNote('user-uuid', 'note-uuid', actor),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws 403 when formateur tries to delete a note', async () => {
      const actor = makeActor(UserRole.FORMATEUR);
      await expect(
        service.deleteInternalNote('user-uuid', 'note-uuid', actor),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws 404 when note does not exist', async () => {
      noteRepo.findOne.mockResolvedValue(null);
      const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE);
      await expect(
        service.deleteInternalNote('user-uuid', 'unknown-uuid', actor),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  // promoteToAnimateurPedagogique — PROF-BR-008
  // ---------------------------------------------------------------------------
  describe('promoteToAnimateurPedagogique', () => {
    it('RP can promote a teacher to AP', async () => {
      const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE);
      const result = await service.promoteToAnimateurPedagogique('teacher-uuid', actor);
      expect(result).toHaveProperty('isAnimateurPedagogique', true);
      expect(eventsService.publish).toHaveBeenCalledWith(
        'TeacherPromotedToPedagogicalAnimator',
        expect.objectContaining({ teacherId: 'teacher-uuid' }),
      );
    });

    it('sets flag on existing profile', async () => {
      teacherPedaRepo.findOne.mockResolvedValue({ userId: 'teacher-uuid', isAnimateurPedagogique: false });
      const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE);
      await service.promoteToAnimateurPedagogique('teacher-uuid', actor);
      expect(teacherPedaRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ isAnimateurPedagogique: true }),
      );
    });

    it('throws 403 when non-RP tries to promote', async () => {
      const actor = makeActor(UserRole.FORMATEUR);
      await expect(
        service.promoteToAnimateurPedagogique('teacher-uuid', actor),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ---------------------------------------------------------------------------
  // updateTeacherValidation
  // ---------------------------------------------------------------------------
  describe('updateTeacherValidation', () => {
    it('RP can validate a teacher and publishes TeacherValidated event', async () => {
      const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE);
      const dto = { status: 'validated' as const };
      const result = await service.updateTeacherValidation('teacher-uuid', dto, actor);
      expect(teacherValidationRepo.save).toHaveBeenCalled();
      expect(eventsService.publish).toHaveBeenCalledWith(
        'TeacherValidated',
        expect.objectContaining({ teacherId: 'teacher-uuid' }),
      );
    });

    it('TI can update validation status', async () => {
      const actor = makeActor(UserRole.TECHNICIEN_INFORMATIQUE);
      const dto = { status: 'rejected' as const, comment: 'Documents manquants' };
      await expect(
        service.updateTeacherValidation('teacher-uuid', dto, actor),
      ).resolves.toBeDefined();
    });

    it('does not publish TeacherValidated event when status is rejected', async () => {
      const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE);
      const dto = { status: 'rejected' as const };
      await service.updateTeacherValidation('teacher-uuid', dto, actor);
      expect(eventsService.publish).not.toHaveBeenCalled();
    });

    it('updates existing validation record', async () => {
      const existingValidation = {
        id: 'existing-uuid',
        teacherId: 'teacher-uuid',
        status: 'pending',
        validatedBy: null,
        comment: null,
      };
      teacherValidationRepo.findOne.mockResolvedValue(existingValidation);
      const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE);
      const dto = { status: 'validated' as const };
      await service.updateTeacherValidation('teacher-uuid', dto, actor);
      expect(teacherValidationRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'validated', validatedBy: actor.id }),
      );
    });

    it('throws 403 for formateur', async () => {
      const actor = makeActor(UserRole.FORMATEUR);
      await expect(
        service.updateTeacherValidation('teacher-uuid', { status: 'validated' }, actor),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws 403 for AdministrateurFinancier', async () => {
      const actor = makeActor(UserRole.ADMINISTRATEUR_FINANCIER);
      await expect(
        service.updateTeacherValidation('teacher-uuid', { status: 'validated' }, actor),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ---------------------------------------------------------------------------
  // listTeachersPendingValidation
  // ---------------------------------------------------------------------------
  describe('listTeachersPendingValidation', () => {
    it('RP can list pending teachers, enriched with a single batched admin-profile query (no N+1)', async () => {
      teacherValidationRepo.find.mockResolvedValue([
        { id: 'v1', teacherId: 'teacher-1', status: 'pending', createdAt: new Date('2026-01-01') },
        { id: 'v2', teacherId: 'teacher-2', status: 'pending', createdAt: new Date('2026-01-02') },
      ]);
      adminRepo.find.mockResolvedValue([
        { userId: 'teacher-1', firstName: 'Alice', lastName: 'Martin' },
        { userId: 'teacher-2', firstName: 'Bob', lastName: 'Dupont' },
      ]);

      const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE);
      const result = await service.listTeachersPendingValidation(actor);

      expect(adminRepo.find).toHaveBeenCalledTimes(1);
      expect(adminRepo.findOne).not.toHaveBeenCalled();
      expect(result).toEqual([
        { id: 'v1', teacherId: 'teacher-1', firstName: 'Alice', lastName: 'Martin', createdAt: new Date('2026-01-01') },
        { id: 'v2', teacherId: 'teacher-2', firstName: 'Bob', lastName: 'Dupont', createdAt: new Date('2026-01-02') },
      ]);
    });

    it('returns null firstName/lastName when no administrative profile exists for a pending teacher', async () => {
      teacherValidationRepo.find.mockResolvedValue([
        { id: 'v1', teacherId: 'teacher-1', status: 'pending', createdAt: new Date('2026-01-01') },
      ]);
      adminRepo.find.mockResolvedValue([]);

      const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE);
      const result = await service.listTeachersPendingValidation(actor);

      expect(result).toEqual([
        { id: 'v1', teacherId: 'teacher-1', firstName: null, lastName: null, createdAt: new Date('2026-01-01') },
      ]);
    });

    it('does not query administrative profiles when there is no pending validation', async () => {
      teacherValidationRepo.find.mockResolvedValue([]);
      const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE);
      const result = await service.listTeachersPendingValidation(actor);
      expect(adminRepo.find).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    it('throws 403 for a non-RP actor', async () => {
      const actor = makeActor(UserRole.TECHNICIEN_INFORMATIQUE);
      await expect(service.listTeachersPendingValidation(actor)).rejects.toThrow(ForbiddenException);
    });
  });

  // ---------------------------------------------------------------------------
  // getTeacherValidation
  // ---------------------------------------------------------------------------
  describe('getTeacherValidation', () => {
    it('returns validation record for RP', async () => {
      teacherValidationRepo.findOne.mockResolvedValue({
        id: 'v-uuid',
        teacherId: 'teacher-uuid',
        status: 'validated',
      });
      const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE);
      const result = await service.getTeacherValidation('teacher-uuid', actor);
      expect(result).toHaveProperty('status', 'validated');
    });

    it('returns default pending when no record exists', async () => {
      const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE);
      const result = await service.getTeacherValidation('teacher-uuid', actor);
      expect(result).toEqual({ teacherId: 'teacher-uuid', status: 'pending' });
    });

    it('teacher can view their own validation status', async () => {
      teacherValidationRepo.findOne.mockResolvedValue({ teacherId: 'teacher-uuid', status: 'pending' });
      const actor = makeActor(UserRole.FORMATEUR, 'teacher-uuid');
      const result = await service.getTeacherValidation('teacher-uuid', actor);
      expect(result).toHaveProperty('teacherId', 'teacher-uuid');
    });

    it('throws 403 when formateur tries to view another teacher validation', async () => {
      const actor = makeActor(UserRole.FORMATEUR, 'other-teacher-uuid');
      await expect(
        service.getTeacherValidation('teacher-uuid', actor),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ---------------------------------------------------------------------------
  // getPedagogicalStatistics
  // ---------------------------------------------------------------------------
  describe('getPedagogicalStatistics', () => {
    it('returns student statistics for RP', async () => {
      studentPedaRepo.findOne.mockResolvedValue({
        userId: 'student-uuid',
        niveauScolaire: 'Terminale',
        matieres: ['Mathématiques'],
      });
      const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE);
      const result = await service.getPedagogicalStatistics('student-uuid', actor);
      expect(result).toHaveProperty('profileType', 'student');
      expect(result.statistics).toHaveProperty('niveauScolaire', 'Terminale');
    });

    it('returns teacher statistics for RP', async () => {
      teacherPedaRepo.findOne.mockResolvedValue({
        userId: 'teacher-uuid',
        niveauxEnseignes: ['Lycée'],
        matieresEnseignees: ['Mathématiques'],
        isAnimateurPedagogique: false,
      });
      const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE);
      const result = await service.getPedagogicalStatistics('teacher-uuid', actor);
      expect(result).toHaveProperty('profileType', 'teacher');
      expect(result.statistics).toHaveProperty('isAnimateurPedagogique', false);
    });

    it('throws 404 when no pedagogical profile exists', async () => {
      const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE);
      await expect(
        service.getPedagogicalStatistics('unknown-uuid', actor),
      ).rejects.toThrow(NotFoundException);
    });

    it('élève can view own statistics', async () => {
      studentPedaRepo.findOne.mockResolvedValue({ userId: 'student-uuid', niveauScolaire: '3ème' });
      const actor = makeActor(UserRole.ELEVE, 'student-uuid');
      const result = await service.getPedagogicalStatistics('student-uuid', actor);
      expect(result.userId).toBe('student-uuid');
    });

    it('throws 403 when élève tries to view another user statistics', async () => {
      const actor = makeActor(UserRole.ELEVE, 'student-uuid');
      await expect(
        service.getPedagogicalStatistics('other-uuid', actor),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ---------------------------------------------------------------------------
  // Visibility preferences — PROF-FN-004
  // ---------------------------------------------------------------------------
  describe('getVisibilityPreferences (PROF-FN-004)', () => {
    it('returns existing preferences for the élève', async () => {
      visibilityPrefRepo.findOne.mockResolvedValue({
        userId: 'student-uuid',
        hideDifficultiesFromContacts: true,
        restrictCommentsToPrincipalTeacher: false,
      });
      const actor = makeActor(UserRole.ELEVE, 'student-uuid');
      const result = await service.getVisibilityPreferences('student-uuid', actor);
      expect(result).toHaveProperty('hideDifficultiesFromContacts', true);
    });

    it('returns defaults when no preference record exists', async () => {
      const actor = makeActor(UserRole.ELEVE, 'student-uuid');
      const result = await service.getVisibilityPreferences('student-uuid', actor);
      expect(result).toMatchObject({
        userId: 'student-uuid',
        hideDifficultiesFromContacts: false,
        restrictCommentsToPrincipalTeacher: false,
      });
    });

    it('RP can view any élève preferences', async () => {
      const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE);
      await expect(
        service.getVisibilityPreferences('student-uuid', actor),
      ).resolves.toBeDefined();
    });

    it('throws 403 when formateur tries to view élève preferences', async () => {
      const actor = makeActor(UserRole.FORMATEUR, 'teacher-uuid');
      await expect(
        service.getVisibilityPreferences('student-uuid', actor),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('updateVisibilityPreferences (PROF-FN-004)', () => {
    it('élève can update own visibility preferences', async () => {
      const actor = makeActor(UserRole.ELEVE, 'student-uuid');
      const dto = { hideDifficultiesFromContacts: true };
      await service.updateVisibilityPreferences('student-uuid', dto, actor);
      expect(visibilityPrefRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ hideDifficultiesFromContacts: true }),
      );
    });

    it('updates existing preference record', async () => {
      visibilityPrefRepo.findOne.mockResolvedValue({
        userId: 'student-uuid',
        hideDifficultiesFromContacts: false,
      });
      const actor = makeActor(UserRole.ELEVE, 'student-uuid');
      await service.updateVisibilityPreferences('student-uuid', { hideDifficultiesFromContacts: true }, actor);
      expect(visibilityPrefRepo.save).toHaveBeenCalled();
    });

    it('throws 403 when formateur tries to update élève preferences', async () => {
      const actor = makeActor(UserRole.FORMATEUR, 'teacher-uuid');
      await expect(
        service.updateVisibilityPreferences('student-uuid', { hideDifficultiesFromContacts: true }, actor),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ---------------------------------------------------------------------------
  // System bootstrap ports — consumed by InternalService / ParentLinkRequestsService
  // ---------------------------------------------------------------------------
  describe('bootstrapAdministrativeProfile', () => {
    it('creates a minimal administrative profile for a new user', async () => {
      const dto = { userId: 'new-uuid', firstName: 'Marie', lastName: 'Dupont', phone: '+33600000001' };
      const result = await service.bootstrapAdministrativeProfile(dto);
      expect(adminRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'new-uuid', firstName: 'Marie', lastName: 'Dupont', telephone: '+33600000001' }),
      );
      expect(adminRepo.save).toHaveBeenCalled();
      expect(result).toHaveProperty('userId', 'new-uuid');
    });

    it('is idempotent: does not duplicate and does not call save when nothing changes', async () => {
      const existing = { userId: 'existing-uuid', firstName: 'Marie' };
      adminRepo.findOne.mockResolvedValue(existing);
      const result = await service.bootstrapAdministrativeProfile({ userId: 'existing-uuid' });
      expect(adminRepo.save).not.toHaveBeenCalled();
      expect(result).toBe(existing);
    });

    it('upserts: updates an already-existing empty profile (lazy-init row) with the incoming name', async () => {
      const existing = { userId: 'existing-uuid', firstName: undefined, lastName: undefined };
      adminRepo.findOne.mockResolvedValue(existing);
      adminRepo.save.mockImplementation(async (entity) => entity);
      const result = await service.bootstrapAdministrativeProfile({
        userId: 'existing-uuid',
        firstName: 'Marie',
        lastName: 'Dupont',
      });
      expect(adminRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'existing-uuid', firstName: 'Marie', lastName: 'Dupont' }),
      );
      expect(result).toHaveProperty('firstName', 'Marie');
      expect(result).toHaveProperty('lastName', 'Dupont');
    });

    it('upserts: overwrites an already-populated profile with the incoming name (replayed bootstrap call)', async () => {
      const existing = { userId: 'existing-uuid', firstName: 'OldFirst', lastName: 'OldLast' };
      adminRepo.findOne.mockResolvedValue(existing);
      adminRepo.save.mockImplementation(async (entity) => entity);
      const result = await service.bootstrapAdministrativeProfile({
        userId: 'existing-uuid',
        firstName: 'NewFirst',
        lastName: 'NewLast',
      });
      expect(adminRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'existing-uuid', firstName: 'NewFirst', lastName: 'NewLast' }),
      );
      expect(result).toHaveProperty('firstName', 'NewFirst');
      expect(result).toHaveProperty('lastName', 'NewLast');
    });

    it('upserts: updates phone (telephone) on an already-existing profile, alongside the name', async () => {
      const existing = {
        userId: 'existing-uuid',
        firstName: 'Marie',
        lastName: 'Dupont',
        telephone: '+33600000001',
      };
      adminRepo.findOne.mockResolvedValue(existing);
      adminRepo.save.mockImplementation(async (entity) => entity);
      const result = await service.bootstrapAdministrativeProfile({
        userId: 'existing-uuid',
        firstName: 'Marie',
        lastName: 'Dupont',
        phone: '+33600000002',
      });
      expect(adminRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'existing-uuid', telephone: '+33600000002' }),
      );
      expect(result).toHaveProperty('telephone', '+33600000002');
    });

    it('does not call save when the incoming phone matches the existing one (no spurious writes)', async () => {
      const existing = {
        userId: 'existing-uuid',
        firstName: 'Marie',
        lastName: 'Dupont',
        telephone: '+33600000001',
      };
      adminRepo.findOne.mockResolvedValue(existing);
      const result = await service.bootstrapAdministrativeProfile({
        userId: 'existing-uuid',
        firstName: 'Marie',
        lastName: 'Dupont',
        phone: '+33600000001',
      });
      expect(adminRepo.save).not.toHaveBeenCalled();
      expect(result).toBe(existing);
    });
  });

  describe('bootstrapStudentPedagogicalProfile', () => {
    it('creates a student pedagogical profile mapping level to niveauScolaire', async () => {
      const result = await service.bootstrapStudentPedagogicalProfile({ userId: 'student-uuid', level: 'Terminale' });
      expect(studentPedaRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'student-uuid', niveauScolaire: 'Terminale' }),
      );
      expect(result).toHaveProperty('userId', 'student-uuid');
    });

    it('is idempotent: does not duplicate when profile already exists', async () => {
      const existing = { userId: 'student-uuid', niveauScolaire: 'Terminale' };
      studentPedaRepo.findOne.mockResolvedValue(existing);
      const result = await service.bootstrapStudentPedagogicalProfile({ userId: 'student-uuid' });
      expect(studentPedaRepo.save).not.toHaveBeenCalled();
      expect(result).toBe(existing);
    });
  });

  describe('bootstrapTeacherPedagogicalProfile', () => {
    it('creates a teacher pedagogical profile mapping subjects/levels/bio', async () => {
      const dto = { userId: 'teacher-uuid', subjects: ['Mathématiques'], levels: ['Lycée'], bio: '5 ans' };
      const result = await service.bootstrapTeacherPedagogicalProfile(dto);
      expect(teacherPedaRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'teacher-uuid',
          matieresEnseignees: ['Mathématiques'],
          niveauxEnseignes: ['Lycée'],
          experiencePedagogique: '5 ans',
        }),
      );
      expect(result).toHaveProperty('userId', 'teacher-uuid');
    });

    it('is idempotent: does not duplicate when profile already exists', async () => {
      const existing = { userId: 'teacher-uuid' };
      teacherPedaRepo.findOne.mockResolvedValue(existing);
      const result = await service.bootstrapTeacherPedagogicalProfile({ userId: 'teacher-uuid' });
      expect(teacherPedaRepo.save).not.toHaveBeenCalled();
      expect(result).toBe(existing);
    });
  });

  describe('studentPedagogicalProfileExists', () => {
    it('returns true when a student pedagogical profile exists', async () => {
      studentPedaRepo.findOne.mockResolvedValue({ userId: 'student-uuid' });
      await expect(service.studentPedagogicalProfileExists('student-uuid')).resolves.toBe(true);
    });

    it('returns false when no student pedagogical profile exists', async () => {
      studentPedaRepo.findOne.mockResolvedValue(null);
      await expect(service.studentPedagogicalProfileExists('unknown-uuid')).resolves.toBe(false);
    });
  });
});
