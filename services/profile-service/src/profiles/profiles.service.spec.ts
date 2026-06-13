import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException } from '@nestjs/common';
import { ProfilesService, Actor } from './profiles.service';
import { AdministrativeProfile } from './entities/administrative-profile.entity';
import { StudentPedagogicalProfile } from './entities/student-pedagogical-profile.entity';
import { TeacherPedagogicalProfile } from './entities/teacher-pedagogical-profile.entity';
import { InternalProfileNote } from './entities/internal-profile-note.entity';
import { TeacherStudentLink } from '../relations/entities/teacher-student-link.entity';
import { FinanceOwnerStudentLink } from '../relations/entities/finance-owner-student-link.entity';
import { EventsService } from '../events/events.service';
import { UserRole } from '../common/enums/user-role.enum';

const makeActor = (role: UserRole, id = 'actor-uuid'): Actor => ({ id, role });

describe('ProfilesService', () => {
  let service: ProfilesService;
  let adminRepo: any;
  let studentPedaRepo: any;
  let teacherPedaRepo: any;
  let noteRepo: any;
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
    it('returns profile data for RP regardless of target', async () => {
      const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE);
      const result = await service.getProfile('student-uuid', actor);
      expect(result).toHaveProperty('userId', 'student-uuid');
    });

    it('returns own profile for élève', async () => {
      const actor = makeActor(UserRole.ELEVE, 'student-uuid');
      const result = await service.getProfile('student-uuid', actor);
      expect(result.userId).toBe('student-uuid');
    });

    it('throws 403 when élève tries to view another profile', async () => {
      const actor = makeActor(UserRole.ELEVE, 'student-uuid');
      await expect(service.getProfile('other-uuid', actor)).rejects.toThrow(ForbiddenException);
    });

    it('allows formateur to view linked student profile (PROF-FB-003)', async () => {
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
});
