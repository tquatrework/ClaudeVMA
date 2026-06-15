import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ProfilesService, Actor } from '../../../src/profiles/profiles.service';
import { AdministrativeProfile } from '../../../src/profiles/entities/administrative-profile.entity';
import { StudentPedagogicalProfile } from '../../../src/profiles/entities/student-pedagogical-profile.entity';
import { TeacherPedagogicalProfile } from '../../../src/profiles/entities/teacher-pedagogical-profile.entity';
import { InternalProfileNote } from '../../../src/profiles/entities/internal-profile-note.entity';
import { TeacherValidation } from '../../../src/profiles/entities/teacher-validation.entity';
import { ProfileVisibilityPreference } from '../../../src/profiles/entities/profile-visibility-preference.entity';
import { TeacherStudentLink } from '../../../src/relations/entities/teacher-student-link.entity';
import { FinanceOwnerStudentLink } from '../../../src/relations/entities/finance-owner-student-link.entity';
import { EventsService } from '../../../src/events/events.service';
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
  let teacherLinkRepo: any;
  let financeLinkRepo: any;
  let eventsService: any;

  beforeEach(async () => {
    adminRepo = {
      findOne: jest.fn().mockResolvedValue(null),
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
    };

    teacherValidationRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((dto) => dto),
      save: jest.fn().mockImplementation(async (entity) => ({ id: 'validation-uuid', ...entity, updatedAt: new Date() })),
    };

    visibilityPrefRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((dto) => dto),
      save: jest.fn().mockImplementation(async (entity) => ({ ...entity, updatedAt: new Date() })),
    };

    teacherLinkRepo = { findOne: jest.fn().mockResolvedValue(null) };
    financeLinkRepo = { findOne: jest.fn().mockResolvedValue(null) };
    eventsService = { publish: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfilesService,
        { provide: getRepositoryToken(AdministrativeProfile), useValue: adminRepo },
        { provide: getRepositoryToken(StudentPedagogicalProfile), useValue: studentPedaRepo },
        { provide: getRepositoryToken(TeacherPedagogicalProfile), useValue: teacherPedaRepo },
        { provide: getRepositoryToken(InternalProfileNote), useValue: noteRepo },
        { provide: getRepositoryToken(TeacherValidation), useValue: teacherValidationRepo },
        { provide: getRepositoryToken(ProfileVisibilityPreference), useValue: visibilityPrefRepo },
        { provide: getRepositoryToken(TeacherStudentLink), useValue: teacherLinkRepo },
        { provide: getRepositoryToken(FinanceOwnerStudentLink), useValue: financeLinkRepo },
        { provide: EventsService, useValue: eventsService },
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

    it('throws 403 when élève tries to view another profile', async () => {
      const actor = makeActor(UserRole.ELEVE, 'student-uuid');
      await expect(service.getProfile('other-uuid', actor)).rejects.toThrow(ForbiddenException);
    });

    it('allows formateur to view linked student profile (PROF-FB-003)', async () => {
      adminRepo.findOne.mockResolvedValue(mockAdminProfile);
      const actor = makeActor(UserRole.FORMATEUR, 'teacher-uuid');
      teacherLinkRepo.findOne.mockResolvedValue({ teacherId: 'teacher-uuid', studentId: 'student-uuid' });

      const result = await service.getProfile('student-uuid', actor);
      expect(result.userId).toBe('student-uuid');
    });

    it('throws 403 when formateur views non-linked student (PROF-FB-003)', async () => {
      const actor = makeActor(UserRole.FORMATEUR, 'teacher-uuid');
      teacherLinkRepo.findOne.mockResolvedValue(null);

      await expect(service.getProfile('student-uuid', actor)).rejects.toThrow(ForbiddenException);
    });

    it('allows parent_financeur to view linked student profile (PROF-RA-002)', async () => {
      adminRepo.findOne.mockResolvedValue(mockAdminProfile);
      const actor = makeActor(UserRole.PARENT_FINANCEUR, 'parent-uuid');
      financeLinkRepo.findOne.mockResolvedValue({ financeOwnerId: 'parent-uuid', studentId: 'student-uuid' });

      const result = await service.getProfile('student-uuid', actor);
      expect(result.userId).toBe('student-uuid');
    });

    it('throws 403 when parent_financeur views non-linked student (PROF-RA-002)', async () => {
      const actor = makeActor(UserRole.PARENT_FINANCEUR, 'parent-uuid');
      financeLinkRepo.findOne.mockResolvedValue(null);

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

  describe('createInternalNote (PROF-FB-002)', () => {
    it('RP can create an internal note', async () => {
      const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE);
      const result = await service.createInternalNote('user-uuid', { content: 'Note text' }, actor);
      expect(noteRepo.save).toHaveBeenCalled();
      expect(result).toHaveProperty('content', 'Note text');
    });

    it('throws 403 when formateur tries to create a note (PROF-FB-002)', async () => {
      const actor = makeActor(UserRole.FORMATEUR);
      await expect(
        service.createInternalNote('user-uuid', { content: 'hack' }, actor),
      ).rejects.toThrow(ForbiddenException);
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
});
