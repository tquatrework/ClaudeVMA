import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { RelationsService } from '../../../src/relations/relations.service';
import { FinanceOwnerStudentLink } from '../../../src/relations/entities/finance-owner-student-link.entity';
import { TeacherStudentLink } from '../../../src/relations/entities/teacher-student-link.entity';
import { PedagogicalCoordinatorLink } from '../../../src/relations/entities/pedagogical-coordinator-link.entity';
import { AnimatorTeacherLink } from '../../../src/relations/entities/animator-teacher-link.entity';
import { RelationKind } from '../../../src/relations/relation-kind';
import { EventsService } from '../../../src/events/events.service';
import { UserRole } from '../../../src/common/enums/user-role.enum';
import { Actor } from '../../../src/profiles/profiles.service';
import { AdministrativeProfileLookupService } from '../../../src/profiles/administrative-profile-lookup.service';

const makeActor = (role: UserRole, id = 'actor-uuid'): Actor => ({ id, role });

describe('RelationsService', () => {
  let service: RelationsService;
  let financeRepo: any;
  let teacherRepo: any;
  let coordinatorRepo: any;
  let animatorRepo: any;
  let eventsService: any;
  let administrativeProfileLookup: any;

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

    animatorRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockImplementation((dto) => dto),
      save: jest.fn().mockImplementation(async (entity) => ({ id: 'link-uuid', ...entity, createdAt: new Date() })),
    };

    eventsService = { publish: jest.fn() };

    administrativeProfileLookup = {
      findNamesByUserIds: jest.fn().mockResolvedValue(new Map()),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RelationsService,
        { provide: getRepositoryToken(FinanceOwnerStudentLink), useValue: financeRepo },
        { provide: getRepositoryToken(TeacherStudentLink), useValue: teacherRepo },
        { provide: getRepositoryToken(PedagogicalCoordinatorLink), useValue: coordinatorRepo },
        { provide: getRepositoryToken(AnimatorTeacherLink), useValue: animatorRepo },
        { provide: EventsService, useValue: eventsService },
        { provide: AdministrativeProfileLookupService, useValue: administrativeProfileLookup },
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

    it('enriches each item with studentName resolved from AdministrativeProfileLookupService', async () => {
      financeRepo.find.mockResolvedValue([
        { id: 'link-1', financeOwnerId: 'finance-uuid', studentId: 'student-1', createdAt: new Date() },
        { id: 'link-2', financeOwnerId: 'finance-uuid', studentId: 'student-2', createdAt: new Date() },
      ]);
      administrativeProfileLookup.findNamesByUserIds.mockResolvedValue(
        new Map([['student-1', { firstName: 'Alice', lastName: 'Dupont' }]]),
      );

      const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE);
      const result = await service.getStudentsByFinanceOwner('finance-uuid', actor);

      expect(administrativeProfileLookup.findNamesByUserIds).toHaveBeenCalledWith(['student-1', 'student-2']);
      expect(result[0]).toHaveProperty('studentName', { firstName: 'Alice', lastName: 'Dupont' });
      // student-2 has no administrative profile row at all → null, request does not fail
      expect(result[1]).toHaveProperty('studentName', null);
    });
  });

  // ---------------------------------------------------------------------------
  // getFinanceOwnersByStudent
  // ---------------------------------------------------------------------------
  describe('getFinanceOwnersByStudent', () => {
    it('RP can list financeurs of any student', async () => {
      const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE);
      await expect(service.getFinanceOwnersByStudent('student-uuid', actor)).resolves.toEqual([]);
    });

    it('student can list their own financeurs', async () => {
      const actor = makeActor(UserRole.ELEVE, 'student-uuid');
      await expect(service.getFinanceOwnersByStudent('student-uuid', actor)).resolves.toEqual([]);
    });

    it('throws 403 when student tries to list another student financeurs', async () => {
      const actor = makeActor(UserRole.ELEVE, 'other-student-uuid');
      await expect(service.getFinanceOwnersByStudent('student-uuid', actor)).rejects.toThrow(ForbiddenException);
    });

    it('throws 403 for formateur', async () => {
      const actor = makeActor(UserRole.FORMATEUR, 'teacher-uuid');
      await expect(service.getFinanceOwnersByStudent('student-uuid', actor)).rejects.toThrow(ForbiddenException);
    });

    it('enriches each item with financeOwnerName resolved from AdministrativeProfileLookupService', async () => {
      financeRepo.find.mockResolvedValue([
        { id: 'link-1', financeOwnerId: 'finance-1', studentId: 'student-uuid', createdAt: new Date() },
        { id: 'link-2', financeOwnerId: 'finance-2', studentId: 'student-uuid', createdAt: new Date() },
      ]);
      administrativeProfileLookup.findNamesByUserIds.mockResolvedValue(
        new Map([['finance-1', { firstName: 'Jean', lastName: 'Martin' }]]),
      );

      const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE);
      const result = await service.getFinanceOwnersByStudent('student-uuid', actor);

      expect(administrativeProfileLookup.findNamesByUserIds).toHaveBeenCalledWith(['finance-1', 'finance-2']);
      expect(result[0]).toHaveProperty('financeOwnerName', { firstName: 'Jean', lastName: 'Martin' });
      // finance-2 has no administrative profile row at all → null, request does not fail
      expect(result[1]).toHaveProperty('financeOwnerName', null);
    });

    it('does not fail when the financeur profile exists but has no firstName/lastName', async () => {
      financeRepo.find.mockResolvedValue([
        { id: 'link-1', financeOwnerId: 'finance-1', studentId: 'student-uuid', createdAt: new Date() },
      ]);
      administrativeProfileLookup.findNamesByUserIds.mockResolvedValue(
        new Map([['finance-1', { firstName: null, lastName: null }]]),
      );

      const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE);
      const result = await service.getFinanceOwnersByStudent('student-uuid', actor);

      expect(result[0]).toHaveProperty('financeOwnerName', { firstName: null, lastName: null });
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

    it('parent_financeur linked to student can list all their teachers', async () => {
      financeRepo.findOne.mockResolvedValue({ id: 'link-uuid', financeOwnerId: 'parent-uuid', studentId: 'student-uuid' });
      teacherRepo.find.mockResolvedValue([{ teacherId: 'teacher-uuid', studentId: 'student-uuid' }]);
      const actor = makeActor(UserRole.PARENT_FINANCEUR, 'parent-uuid');
      const result = await service.getTeachersByStudent('student-uuid', actor);
      expect(result).toHaveLength(1);
      expect(financeRepo.findOne).toHaveBeenCalledWith({
        where: { financeOwnerId: 'parent-uuid', studentId: 'student-uuid' },
      });
    });

    it('throws 403 for parent_financeur not linked to the student', async () => {
      financeRepo.findOne.mockResolvedValue(null);
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

  // ---------------------------------------------------------------------------
  // Ports consumed by other features (profiles, parent-link-requests, internal)
  // ---------------------------------------------------------------------------
  describe('isTeacherLinkedToStudent', () => {
    it('returns true when a link exists', async () => {
      teacherRepo.findOne.mockResolvedValue({ teacherId: 'teacher-uuid', studentId: 'student-uuid' });
      await expect(service.isTeacherLinkedToStudent('teacher-uuid', 'student-uuid')).resolves.toBe(true);
    });

    it('returns false when no link exists', async () => {
      teacherRepo.findOne.mockResolvedValue(null);
      await expect(service.isTeacherLinkedToStudent('teacher-uuid', 'student-uuid')).resolves.toBe(false);
    });
  });

  describe('isFinanceOwnerLinkedToStudent', () => {
    it('returns true when a link exists', async () => {
      financeRepo.findOne.mockResolvedValue({ financeOwnerId: 'parent-uuid', studentId: 'student-uuid' });
      await expect(service.isFinanceOwnerLinkedToStudent('parent-uuid', 'student-uuid')).resolves.toBe(true);
    });

    it('returns false when no link exists', async () => {
      financeRepo.findOne.mockResolvedValue(null);
      await expect(service.isFinanceOwnerLinkedToStudent('parent-uuid', 'student-uuid')).resolves.toBe(false);
    });
  });

  describe('ensureFinanceOwnerStudentLink', () => {
    it('creates the link when none exists', async () => {
      const result = await service.ensureFinanceOwnerStudentLink('parent-uuid', 'student-uuid');
      expect(financeRepo.save).toHaveBeenCalled();
      expect(result).toHaveProperty('financeOwnerId', 'parent-uuid');
    });

    it('returns the existing link without creating a duplicate', async () => {
      const existing = { id: 'existing-link', financeOwnerId: 'parent-uuid', studentId: 'student-uuid' };
      financeRepo.findOne.mockResolvedValue(existing);
      const result = await service.ensureFinanceOwnerStudentLink('parent-uuid', 'student-uuid');
      expect(financeRepo.save).not.toHaveBeenCalled();
      expect(result).toBe(existing);
    });
  });

  describe('createFinanceOwnerStudentLinkForSystem', () => {
    it('creates the link when none exists', async () => {
      const result = await service.createFinanceOwnerStudentLinkForSystem('parent-uuid', 'student-uuid');
      expect(financeRepo.save).toHaveBeenCalled();
      expect(result).toHaveProperty('financeOwnerId', 'parent-uuid');
    });

    it('throws 409 when the link already exists', async () => {
      financeRepo.findOne.mockResolvedValue({ id: 'existing-link' });
      await expect(
        service.createFinanceOwnerStudentLinkForSystem('parent-uuid', 'student-uuid'),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('createTeacherStudentLinkForSystem', () => {
    it('creates the link with isPrincipalTeacher defaulting to false', async () => {
      const result = await service.createTeacherStudentLinkForSystem('teacher-uuid', 'student-uuid');
      expect(teacherRepo.save).toHaveBeenCalled();
      expect(result).toHaveProperty('isPrincipalTeacher', false);
    });

    it('creates the link with isPrincipalTeacher set to true', async () => {
      const result = await service.createTeacherStudentLinkForSystem('teacher-uuid', 'student-uuid', true);
      expect(result).toHaveProperty('isPrincipalTeacher', true);
    });

    it('throws 409 when the link already exists', async () => {
      teacherRepo.findOne.mockResolvedValue({ id: 'existing-link' });
      await expect(
        service.createTeacherStudentLinkForSystem('teacher-uuid', 'student-uuid'),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('createPedagogicalCoordinatorLinkForSystem', () => {
    it('creates the coordinator link', async () => {
      const result = await service.createPedagogicalCoordinatorLinkForSystem(
        'rp-uuid',
        'student-uuid',
        'responsable_pedagogique',
      );
      expect(coordinatorRepo.save).toHaveBeenCalled();
      expect(result).toHaveProperty('coordinatorId', 'rp-uuid');
    });

    it('throws 409 when the link already exists', async () => {
      coordinatorRepo.findOne.mockResolvedValue({ id: 'existing-link' });
      await expect(
        service.createPedagogicalCoordinatorLinkForSystem('rp-uuid', 'student-uuid', 'responsable_pedagogique'),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ---------------------------------------------------------------------------
  // linkAnimatorToTeacher — relation AP → formateur (arbitrage du 2026-08-11)
  // ---------------------------------------------------------------------------
  describe('linkAnimatorToTeacher', () => {
    const dto = { animatorId: 'ap-uuid', teacherId: 'teacher-uuid' };

    it('crée le lien quand le RP le demande', async () => {
      const result = await service.linkAnimatorToTeacher(dto, makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE));
      expect(animatorRepo.save).toHaveBeenCalled();
      expect(result).toMatchObject(dto);
      expect(eventsService.publish).toHaveBeenCalledWith(
        'AnimatorLinkedToTeacher',
        expect.objectContaining(dto),
      );
    });

    it('refuse un AP qui se donnerait ses propres animés', async () => {
      await expect(
        service.linkAnimatorToTeacher(dto, makeActor(UserRole.ANIMATEUR_PEDAGOGIQUE, 'ap-uuid')),
      ).rejects.toThrow(ForbiddenException);
    });

    it('refuse le TI et le formateur', async () => {
      await expect(
        service.linkAnimatorToTeacher(dto, makeActor(UserRole.TECHNICIEN_INFORMATIQUE)),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.linkAnimatorToTeacher(dto, makeActor(UserRole.FORMATEUR)),
      ).rejects.toThrow(ForbiddenException);
    });

    it('renvoie 409 sur un doublon', async () => {
      animatorRepo.findOne.mockResolvedValue({ id: 'existing' });
      await expect(
        service.linkAnimatorToTeacher(dto, makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE)),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('getTeachersByAnimator', () => {
    it("laisse l'AP lister ses propres animés, avec leur nom", async () => {
      animatorRepo.find.mockResolvedValue([{ animatorId: 'ap-uuid', teacherId: 'teacher-uuid' }]);
      administrativeProfileLookup.findNamesByUserIds.mockResolvedValue(
        new Map([['teacher-uuid', { firstName: 'Nadia', lastName: 'Belkacem' }]]),
      );

      const result = await service.getTeachersByAnimator(
        'ap-uuid',
        makeActor(UserRole.ANIMATEUR_PEDAGOGIQUE, 'ap-uuid'),
      );

      expect(result).toEqual([
        expect.objectContaining({
          teacherId: 'teacher-uuid',
          teacherName: { firstName: 'Nadia', lastName: 'Belkacem' },
        }),
      ]);
    });

    it("refuse un AP qui consulte la liste d'un autre AP", async () => {
      await expect(
        service.getTeachersByAnimator('other-ap-uuid', makeActor(UserRole.ANIMATEUR_PEDAGOGIQUE, 'ap-uuid')),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ---------------------------------------------------------------------------
  // resolveRelations — nature ET sens du lien
  // ---------------------------------------------------------------------------
  describe('resolveRelations', () => {
    const PARENT = 'parent-uuid';
    const STUDENT = 'student-uuid';
    const TEACHER = 'teacher-uuid';
    const AP = 'ap-uuid';

    it('ne renvoie rien pour deux personnes sans aucun lien', async () => {
      expect(await service.resolveRelations(TEACHER, STUDENT)).toEqual([]);
    });

    it('ne se relie jamais à soi-même — le titulaire est traité en amont', async () => {
      expect(await service.resolveRelations(STUDENT, STUDENT)).toEqual([]);
      expect(financeRepo.find).not.toHaveBeenCalled();
    });

    it('formateur → élève et élève → formateur : les deux sens sont nommés', async () => {
      teacherRepo.find.mockResolvedValue([
        { teacherId: TEACHER, studentId: STUDENT, isPrincipalTeacher: true },
      ]);

      expect(await service.resolveRelations(TEACHER, STUDENT)).toEqual([
        { kind: RelationKind.TEACHER_OF_STUDENT, isPrincipalTeacher: true },
      ]);
      expect(await service.resolveRelations(STUDENT, TEACHER)).toEqual([
        { kind: RelationKind.STUDENT_OF_TEACHER, isPrincipalTeacher: true },
      ]);
    });

    it('parent → élève et élève → parent', async () => {
      financeRepo.find.mockResolvedValue([{ financeOwnerId: PARENT, studentId: STUDENT }]);

      expect(await service.resolveRelations(PARENT, STUDENT)).toEqual([
        { kind: RelationKind.FINANCE_OWNER_OF_STUDENT },
      ]);
      expect(await service.resolveRelations(STUDENT, PARENT)).toEqual([
        { kind: RelationKind.STUDENT_OF_FINANCE_OWNER },
      ]);
    });

    it('AP → formateur et formateur → AP', async () => {
      animatorRepo.find.mockResolvedValue([{ animatorId: AP, teacherId: TEACHER }]);

      expect(await service.resolveRelations(AP, TEACHER)).toEqual([
        { kind: RelationKind.ANIMATOR_OF_TEACHER },
      ]);
      expect(await service.resolveRelations(TEACHER, AP)).toEqual([
        { kind: RelationKind.TEACHER_OF_ANIMATOR },
      ]);
    });

    it("parent ↔ formateur : lien INDIRECT, par l'élève commun", async () => {
      financeRepo.find.mockResolvedValue([{ financeOwnerId: PARENT, studentId: STUDENT }]);
      teacherRepo.find.mockResolvedValue([
        { teacherId: TEACHER, studentId: STUDENT, isPrincipalTeacher: false },
      ]);

      expect(await service.resolveRelations(PARENT, TEACHER)).toEqual([
        { kind: RelationKind.FINANCE_OWNER_OF_STUDENT_OF_TEACHER, throughUserIds: [STUDENT] },
      ]);
      expect(await service.resolveRelations(TEACHER, PARENT)).toEqual([
        { kind: RelationKind.TEACHER_OF_STUDENT_OF_FINANCE_OWNER, throughUserIds: [STUDENT] },
      ]);
    });

    it("aucun lien indirect quand l'élève n'est pas commun", async () => {
      financeRepo.find.mockResolvedValue([{ financeOwnerId: PARENT, studentId: 'other-student' }]);
      teacherRepo.find.mockResolvedValue([
        { teacherId: TEACHER, studentId: STUDENT, isPrincipalTeacher: false },
      ]);

      expect(await service.resolveRelations(PARENT, TEACHER)).toEqual([]);
    });

    it('coordinateur ↔ élève', async () => {
      coordinatorRepo.find.mockResolvedValue([
        { coordinatorId: AP, studentId: STUDENT, coordinatorRole: 'animateur_pedagogique' },
      ]);

      expect(await service.resolveRelations(AP, STUDENT)).toEqual([
        { kind: RelationKind.COORDINATOR_OF_STUDENT },
      ]);
      expect(await service.resolveRelations(STUDENT, AP)).toEqual([
        { kind: RelationKind.STUDENT_OF_COORDINATOR },
      ]);
    });
  });

  // ---------------------------------------------------------------------------
  // listRelatedPeople — ce que l'écran /archives consomme
  // ---------------------------------------------------------------------------
  describe('listRelatedPeople', () => {
    it('renvoie une liste vide pour un compte sans aucun lien — jamais une erreur', async () => {
      expect(await service.listRelatedPeople('lonely-uuid')).toEqual([]);
    });

    it('porte le prénom, le nom et la nature du lien, sans jamais exiger un UUID à afficher', async () => {
      teacherRepo.find.mockResolvedValue([
        { teacherId: 'teacher-uuid', studentId: 'student-uuid', isPrincipalTeacher: true },
      ]);
      financeRepo.find.mockResolvedValue([]);
      administrativeProfileLookup.findNamesByUserIds.mockResolvedValue(
        new Map([['student-uuid', { firstName: 'Théo', lastName: 'Relation' }]]),
      );

      expect(await service.listRelatedPeople('teacher-uuid')).toEqual([
        {
          userId: 'student-uuid',
          firstName: 'Théo',
          lastName: 'Relation',
          relations: [{ kind: RelationKind.TEACHER_OF_STUDENT, isPrincipalTeacher: true }],
        },
      ]);
    });

    it("laisse le nom à null quand la personne n'a pas de profil administratif", async () => {
      financeRepo.find.mockResolvedValue([
        { financeOwnerId: 'parent-uuid', studentId: 'student-uuid' },
      ]);
      administrativeProfileLookup.findNamesByUserIds.mockResolvedValue(new Map());

      expect(await service.listRelatedPeople('parent-uuid')).toEqual([
        {
          userId: 'student-uuid',
          firstName: null,
          lastName: null,
          relations: [{ kind: RelationKind.FINANCE_OWNER_OF_STUDENT }],
        },
      ]);
    });

    it('inclut les formateurs des élèves financés — lien indirect, une seule entrée par personne', async () => {
      financeRepo.find.mockResolvedValue([
        { financeOwnerId: 'parent-uuid', studentId: 'student-uuid' },
      ]);
      // 1er appel : liens du parent (aucun en tant que formateur) ;
      // 2e appel : formateurs de ses élèves.
      teacherRepo.find
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          { teacherId: 'teacher-uuid', studentId: 'student-uuid', isPrincipalTeacher: true },
        ]);
      administrativeProfileLookup.findNamesByUserIds.mockResolvedValue(
        new Map([
          ['student-uuid', { firstName: 'Théo', lastName: 'Relation' }],
          ['teacher-uuid', { firstName: 'Farid', lastName: 'Formateur' }],
        ]),
      );

      const result = await service.listRelatedPeople('parent-uuid');

      expect(result).toHaveLength(2);
      expect(result.find((person) => person.userId === 'teacher-uuid')?.relations).toEqual([
        {
          kind: RelationKind.FINANCE_OWNER_OF_STUDENT_OF_TEACHER,
          throughUserIds: ['student-uuid'],
        },
      ]);
    });

    it('trie par nom et ne résout les noms qu\'en un seul appel (pas de N+1)', async () => {
      financeRepo.find.mockResolvedValue([
        { financeOwnerId: 'parent-uuid', studentId: 'student-b' },
        { financeOwnerId: 'parent-uuid', studentId: 'student-a' },
      ]);
      administrativeProfileLookup.findNamesByUserIds.mockResolvedValue(
        new Map([
          ['student-a', { firstName: 'Alice', lastName: 'Amiot' }],
          ['student-b', { firstName: 'Bruno', lastName: 'Zerbib' }],
        ]),
      );

      const result = await service.listRelatedPeople('parent-uuid');

      expect(result.map((person) => person.lastName)).toEqual(['Amiot', 'Zerbib']);
      expect(administrativeProfileLookup.findNamesByUserIds).toHaveBeenCalledTimes(1);
    });
  });
});
