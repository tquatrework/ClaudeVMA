import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ActivitiesService } from '../../../src/activities/activities.service';
import { ScheduledActivity, ActivityType, ActivityStatus } from '../../../src/activities/entities/scheduled-activity.entity';
import { EventsService } from '../../../src/events/events.service';
import {
  ProfileRelationsClient,
  ProfileRelationsUnavailableError,
} from '../../../src/common/clients/profile-relations.client';
import { RelationKind, RelationSnapshot } from '../../../src/common/relations/relation-kind';
import { UserRole } from '../../../src/common/enums/user-role.enum';
import { AuthenticatedUser } from '../../../src/common/interfaces/authenticated-user.interface';

const mockActivityRepo = {
  findOne: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
  delete: jest.fn(),
  createQueryBuilder: jest.fn(),
};

const mockEventsService = { publish: jest.fn() };

const mockProfileRelationsClient = { resolveRelations: jest.fn() };

const validCreateDto = {
  title: 'Cours algèbre',
  type: ActivityType.COURS,
  participantIds: ['student-uuid-1'],
  startTime: '2026-06-10T14:00:00Z',
  endTime: '2026-06-10T15:00:00Z',
};

/** Snapshot minimal contenant (ou non) la relation demandée. */
function snapshotWith(kinds: RelationKind[]): RelationSnapshot {
  return {
    viewerId: 'viewer',
    targetId: 'target',
    isSelf: false,
    isAdministrator: false,
    relations: kinds.map((kind) => ({ kind })),
  };
}

describe('ActivitiesService', () => {
  let service: ActivitiesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActivitiesService,
        { provide: getRepositoryToken(ScheduledActivity), useValue: mockActivityRepo },
        { provide: EventsService, useValue: mockEventsService },
        { provide: ProfileRelationsClient, useValue: mockProfileRelationsClient },
      ],
    }).compile();

    service = module.get<ActivitiesService>(ActivitiesService);
    jest.clearAllMocks();
  });

  // --- create ---

  describe('create', () => {
    it('creates a COURS activity for a FORMATEUR linked to the student and publishes ActivityScheduled', async () => {
      mockProfileRelationsClient.resolveRelations.mockResolvedValue(
        snapshotWith([RelationKind.TEACHER_OF_STUDENT]),
      );
      const saved = { id: 'act-1', ...validCreateDto, creatorId: 'teacher-1', creatorRole: UserRole.FORMATEUR, status: ActivityStatus.PROPOSED };
      mockActivityRepo.create.mockReturnValue(saved);
      mockActivityRepo.save.mockResolvedValue(saved);
      const actor: AuthenticatedUser = { id: 'teacher-1', role: UserRole.FORMATEUR };

      const result = await service.create(validCreateDto, actor);
      expect(result.id).toBe('act-1');
      expect(mockProfileRelationsClient.resolveRelations).toHaveBeenCalledWith(
        'teacher-1',
        'student-uuid-1',
        UserRole.FORMATEUR,
        undefined,
      );
      expect(mockEventsService.publish).toHaveBeenCalledWith(
        'ActivityScheduled',
        expect.objectContaining({ activityId: 'act-1', type: ActivityType.COURS }),
        undefined,
      );
    });

    it('creates a REUNION_PEDAGOGIQUE for an AP linked to the teacher (CAL-BR-008)', async () => {
      mockProfileRelationsClient.resolveRelations.mockResolvedValue(
        snapshotWith([RelationKind.ANIMATOR_OF_TEACHER]),
      );
      const dto = { ...validCreateDto, type: ActivityType.REUNION_PEDAGOGIQUE, participantIds: ['teacher-uuid-1'] };
      const saved = { id: 'act-2', ...dto, creatorId: 'ap-1', creatorRole: UserRole.ANIMATEUR_PEDAGOGIQUE, status: ActivityStatus.PROPOSED };
      mockActivityRepo.create.mockReturnValue(saved);
      mockActivityRepo.save.mockResolvedValue(saved);
      const actor: AuthenticatedUser = { id: 'ap-1', role: UserRole.ANIMATEUR_PEDAGOGIQUE };

      const result = await service.create(dto, actor);
      expect(result.id).toBe('act-2');
      expect(mockProfileRelationsClient.resolveRelations).toHaveBeenCalledWith(
        'ap-1',
        'teacher-uuid-1',
        UserRole.ANIMATEUR_PEDAGOGIQUE,
        undefined,
      );
    });

    it('throws ForbiddenException when AP tries to create a COURS (CAL-FB-003)', async () => {
      const actor: AuthenticatedUser = { id: 'ap-1', role: UserRole.ANIMATEUR_PEDAGOGIQUE };
      await expect(service.create(validCreateDto, actor)).rejects.toThrow(ForbiddenException);
      expect(mockProfileRelationsClient.resolveRelations).not.toHaveBeenCalled();
    });

    it('RP creates a REUNION_PEDAGOGIQUE with multiple formateurs, unaffected by the exactly-one-recipient rule (existing usage preserved)', async () => {
      const dto = {
        ...validCreateDto,
        type: ActivityType.REUNION_PEDAGOGIQUE,
        participantIds: ['teacher-1', 'teacher-2', 'teacher-3'],
      };
      const saved = { id: 'act-3', ...dto, creatorId: 'rp-1', creatorRole: UserRole.RESPONSABLE_PEDAGOGIQUE, status: ActivityStatus.PROPOSED };
      mockActivityRepo.create.mockReturnValue(saved);
      mockActivityRepo.save.mockResolvedValue(saved);
      const actor: AuthenticatedUser = { id: 'rp-1', role: UserRole.RESPONSABLE_PEDAGOGIQUE };

      const result = await service.create(dto, actor);
      expect(result.id).toBe('act-3');
      // RP: no link verification whatsoever (unconditional access elsewhere in this service).
      expect(mockProfileRelationsClient.resolveRelations).not.toHaveBeenCalled();
    });

    it('RP can create ENTRETIEN_RP (CAL-BR-004, CAL-BR-005)', async () => {
      const dto = { ...validCreateDto, type: ActivityType.ENTRETIEN_RP };
      const saved = { id: 'act-4', ...dto, creatorId: 'rp-1', creatorRole: UserRole.RESPONSABLE_PEDAGOGIQUE, status: ActivityStatus.PROPOSED };
      mockActivityRepo.create.mockReturnValue(saved);
      mockActivityRepo.save.mockResolvedValue(saved);
      const actor: AuthenticatedUser = { id: 'rp-1', role: UserRole.RESPONSABLE_PEDAGOGIQUE };

      const result = await service.create(dto, actor);
      expect(result.id).toBe('act-4');
      expect(mockProfileRelationsClient.resolveRelations).not.toHaveBeenCalled();
    });

    // --- exactly-one-recipient validation (chantier calendrier, point 3) ---

    it('throws BadRequestException when a FORMATEUR proposes a COURS to more than one participant', async () => {
      const dto = { ...validCreateDto, participantIds: ['s1', 's2'] };
      const actor: AuthenticatedUser = { id: 'teacher-1', role: UserRole.FORMATEUR };

      await expect(service.create(dto, actor)).rejects.toThrow(BadRequestException);
      expect(mockProfileRelationsClient.resolveRelations).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when an AP proposes a REUNION_PEDAGOGIQUE to more than one participant', async () => {
      const dto = { ...validCreateDto, type: ActivityType.REUNION_PEDAGOGIQUE, participantIds: ['t1', 't2'] };
      const actor: AuthenticatedUser = { id: 'ap-1', role: UserRole.ANIMATEUR_PEDAGOGIQUE };

      await expect(service.create(dto, actor)).rejects.toThrow(BadRequestException);
      expect(mockProfileRelationsClient.resolveRelations).not.toHaveBeenCalled();
    });

    // --- link verification (real security fix, chantier calendrier point 3) ---

    it('throws ForbiddenException when a FORMATEUR proposes a COURS to a student they are not linked to', async () => {
      mockProfileRelationsClient.resolveRelations.mockResolvedValue(snapshotWith([]));
      const actor: AuthenticatedUser = { id: 'teacher-1', role: UserRole.FORMATEUR };

      await expect(service.create(validCreateDto, actor)).rejects.toThrow(ForbiddenException);
      expect(mockActivityRepo.save).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when an AP proposes a REUNION_PEDAGOGIQUE to a teacher they do not animate', async () => {
      mockProfileRelationsClient.resolveRelations.mockResolvedValue(snapshotWith([]));
      const dto = { ...validCreateDto, type: ActivityType.REUNION_PEDAGOGIQUE, participantIds: ['teacher-uuid-1'] };
      const actor: AuthenticatedUser = { id: 'ap-1', role: UserRole.ANIMATEUR_PEDAGOGIQUE };

      await expect(service.create(dto, actor)).rejects.toThrow(ForbiddenException);
      expect(mockActivityRepo.save).not.toHaveBeenCalled();
    });

    it('an unrelated relation kind does not satisfy the link requirement', async () => {
      // Le lecteur EST lié au titulaire, mais pas de la bonne façon
      // (STUDENT_OF_TEACHER au lieu de TEACHER_OF_STUDENT) : ne doit pas passer.
      mockProfileRelationsClient.resolveRelations.mockResolvedValue(
        snapshotWith([RelationKind.STUDENT_OF_TEACHER]),
      );
      const actor: AuthenticatedUser = { id: 'teacher-1', role: UserRole.FORMATEUR };

      await expect(service.create(validCreateDto, actor)).rejects.toThrow(ForbiddenException);
    });

    it('throws ServiceUnavailableException when profile-service is unreachable during link verification', async () => {
      mockProfileRelationsClient.resolveRelations.mockRejectedValue(
        new ProfileRelationsUnavailableError('down'),
      );
      const actor: AuthenticatedUser = { id: 'teacher-1', role: UserRole.FORMATEUR };

      await expect(service.create(validCreateDto, actor)).rejects.toThrow(ServiceUnavailableException);
    });

    it('propagates unexpected errors from profile-service verbatim', async () => {
      mockProfileRelationsClient.resolveRelations.mockRejectedValue(new Error('boom'));
      const actor: AuthenticatedUser = { id: 'teacher-1', role: UserRole.FORMATEUR };

      await expect(service.create(validCreateDto, actor)).rejects.toThrow('boom');
    });
  });

  // --- update ---

  describe('update', () => {
    const existingActivity = {
      id: 'act-1',
      creatorId: 'teacher-1',
      creatorRole: UserRole.FORMATEUR,
      title: 'Cours algèbre',
      type: ActivityType.COURS,
      participantIds: ['student-1'],
      startTime: new Date('2026-06-10T14:00:00Z'),
      endTime: new Date('2026-06-10T15:00:00Z'),
      status: ActivityStatus.PROPOSED,
      correlationId: null,
    };

    it('creator can update their own activity and publishes ActivityUpdated', async () => {
      mockActivityRepo.findOne.mockResolvedValue(existingActivity);
      const updated = { ...existingActivity, title: 'Cours algèbre avancé' };
      mockActivityRepo.save.mockResolvedValue(updated);
      const actor: AuthenticatedUser = { id: 'teacher-1', role: UserRole.FORMATEUR };

      const result = await service.update('act-1', { title: 'Cours algèbre avancé' }, actor);
      expect(result.title).toBe('Cours algèbre avancé');
      expect(mockEventsService.publish).toHaveBeenCalledWith(
        'ActivityUpdated',
        expect.objectContaining({ activityId: 'act-1' }),
        undefined,
      );
    });

    it('RP can update any activity (CAL-FB-001 internal role)', async () => {
      mockActivityRepo.findOne.mockResolvedValue(existingActivity);
      mockActivityRepo.save.mockResolvedValue({ ...existingActivity, status: ActivityStatus.CONFIRMED });
      const actor: AuthenticatedUser = { id: 'rp-id', role: UserRole.RESPONSABLE_PEDAGOGIQUE };

      await expect(
        service.update('act-1', { status: ActivityStatus.CONFIRMED }, actor),
      ).resolves.toBeDefined();
    });

    it('throws ForbiddenException when non-creator tries to update (CAL-FB-001)', async () => {
      mockActivityRepo.findOne.mockResolvedValue(existingActivity);
      const actor: AuthenticatedUser = { id: 'other-user', role: UserRole.ELEVE };

      await expect(service.update('act-1', { title: 'Hack' }, actor)).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException for unknown activity', async () => {
      mockActivityRepo.findOne.mockResolvedValue(null);
      const actor: AuthenticatedUser = { id: 'teacher-1', role: UserRole.FORMATEUR };

      await expect(service.update('unknown-id', { title: 'x' }, actor)).rejects.toThrow(NotFoundException);
    });
  });

  // --- remove ---

  describe('remove', () => {
    const existingActivity = {
      id: 'act-1',
      creatorId: 'teacher-1',
      creatorRole: UserRole.FORMATEUR,
      title: 'Cours algèbre',
      type: ActivityType.COURS,
      participantIds: ['student-1'],
      startTime: new Date('2026-06-10T14:00:00Z'),
      endTime: new Date('2026-06-10T15:00:00Z'),
      status: ActivityStatus.PROPOSED,
      correlationId: null,
    };

    it('creator can delete their own activity and publishes ActivityDeleted', async () => {
      mockActivityRepo.findOne.mockResolvedValue(existingActivity);
      mockActivityRepo.delete.mockResolvedValue({ affected: 1 });
      const actor: AuthenticatedUser = { id: 'teacher-1', role: UserRole.FORMATEUR };

      await service.remove('act-1', actor, 'corr-3');

      expect(mockActivityRepo.delete).toHaveBeenCalledWith({ id: 'act-1' });
      expect(mockEventsService.publish).toHaveBeenCalledWith(
        'ActivityDeleted',
        { activityId: 'act-1', deletedBy: 'teacher-1' },
        'corr-3',
      );
    });

    it('RP can delete any activity (CAL-FB-001 internal role)', async () => {
      mockActivityRepo.findOne.mockResolvedValue(existingActivity);
      mockActivityRepo.delete.mockResolvedValue({ affected: 1 });
      const actor: AuthenticatedUser = { id: 'rp-id', role: UserRole.RESPONSABLE_PEDAGOGIQUE };

      await expect(service.remove('act-1', actor)).resolves.toBeUndefined();
      expect(mockActivityRepo.delete).toHaveBeenCalledWith({ id: 'act-1' });
    });

    it('throws ForbiddenException when non-creator, non-RP/TI tries to delete (CAL-FB-001)', async () => {
      mockActivityRepo.findOne.mockResolvedValue(existingActivity);
      const actor: AuthenticatedUser = { id: 'other-user', role: UserRole.ELEVE };

      await expect(service.remove('act-1', actor)).rejects.toThrow(ForbiddenException);
      expect(mockActivityRepo.delete).not.toHaveBeenCalled();
    });

    it('throws NotFoundException for unknown activity', async () => {
      mockActivityRepo.findOne.mockResolvedValue(null);
      const actor: AuthenticatedUser = { id: 'teacher-1', role: UserRole.FORMATEUR };

      await expect(service.remove('unknown-id', actor)).rejects.toThrow(NotFoundException);
      expect(mockActivityRepo.delete).not.toHaveBeenCalled();
    });
  });

  // --- findOne ---

  describe('findOne', () => {
    it('returns activity by id', async () => {
      const activity = { id: 'act-1', title: 'Cours', creatorId: 'teacher-1', participantIds: ['student-1'] };
      mockActivityRepo.findOne.mockResolvedValue(activity);
      const actor: AuthenticatedUser = { id: 'teacher-1', role: UserRole.FORMATEUR };
      expect(await service.findOne('act-1', actor)).toEqual(activity);
    });

    it('throws NotFoundException for unknown id', async () => {
      mockActivityRepo.findOne.mockResolvedValue(null);
      const actor: AuthenticatedUser = { id: 'teacher-1', role: UserRole.FORMATEUR };
      await expect(service.findOne('bad-id', actor)).rejects.toThrow(NotFoundException);
    });
  });

  // --- accept / decline (calendrier de disponibilites, point 3) ---

  describe('accept', () => {
    const proposedActivity = {
      id: 'act-1',
      creatorId: 'teacher-1',
      creatorRole: UserRole.FORMATEUR,
      title: 'Cours algèbre',
      type: ActivityType.COURS,
      participantIds: ['student-1'],
      startTime: new Date('2026-06-10T14:00:00Z'),
      endTime: new Date('2026-06-10T15:00:00Z'),
      status: ActivityStatus.PROPOSED,
      correlationId: null,
    };

    it('the targeted recipient can accept a PROPOSED activity — transitions to CONFIRMED and publishes ActivityConfirmed', async () => {
      mockActivityRepo.findOne.mockResolvedValue({ ...proposedActivity });
      mockActivityRepo.save.mockImplementation(async (a) => a);
      const actor: AuthenticatedUser = { id: 'student-1', role: UserRole.ELEVE };

      const result = await service.accept('act-1', actor, 'corr-1');

      expect(result.status).toBe(ActivityStatus.CONFIRMED);
      expect(mockEventsService.publish).toHaveBeenCalledWith(
        'ActivityConfirmed',
        { activityId: 'act-1', confirmedBy: 'student-1' },
        'corr-1',
      );
    });

    it('throws ConflictException (409) when the activity is not PROPOSED anymore', async () => {
      mockActivityRepo.findOne.mockResolvedValue({ ...proposedActivity, status: ActivityStatus.CONFIRMED });
      const actor: AuthenticatedUser = { id: 'student-1', role: UserRole.ELEVE };

      await expect(service.accept('act-1', actor)).rejects.toThrow(ConflictException);
      expect(mockActivityRepo.save).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when the caller is not the targeted recipient', async () => {
      mockActivityRepo.findOne.mockResolvedValue({ ...proposedActivity });
      const actor: AuthenticatedUser = { id: 'someone-else', role: UserRole.ELEVE };

      await expect(service.accept('act-1', actor)).rejects.toThrow(ForbiddenException);
      expect(mockActivityRepo.save).not.toHaveBeenCalled();
    });

    it("throws ForbiddenException when the activity's own creator tries to accept it", async () => {
      mockActivityRepo.findOne.mockResolvedValue({ ...proposedActivity });
      const actor: AuthenticatedUser = { id: 'teacher-1', role: UserRole.FORMATEUR }; // creator, not a participant

      await expect(service.accept('act-1', actor)).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException for an unknown activity', async () => {
      mockActivityRepo.findOne.mockResolvedValue(null);
      const actor: AuthenticatedUser = { id: 'student-1', role: UserRole.ELEVE };

      await expect(service.accept('unknown-id', actor)).rejects.toThrow(NotFoundException);
    });
  });

  describe('decline', () => {
    const proposedActivity = {
      id: 'act-1',
      creatorId: 'ap-1',
      creatorRole: UserRole.ANIMATEUR_PEDAGOGIQUE,
      title: 'Réunion pédagogique',
      type: ActivityType.REUNION_PEDAGOGIQUE,
      participantIds: ['teacher-1'],
      startTime: new Date('2026-06-10T14:00:00Z'),
      endTime: new Date('2026-06-10T15:00:00Z'),
      status: ActivityStatus.PROPOSED,
      correlationId: null,
    };

    it('the targeted recipient can decline a PROPOSED activity — transitions to CANCELLED and publishes ActivityDeclined', async () => {
      mockActivityRepo.findOne.mockResolvedValue({ ...proposedActivity });
      mockActivityRepo.save.mockImplementation(async (a) => a);
      const actor: AuthenticatedUser = { id: 'teacher-1', role: UserRole.FORMATEUR };

      const result = await service.decline('act-1', actor, 'corr-2');

      expect(result.status).toBe(ActivityStatus.CANCELLED);
      expect(mockEventsService.publish).toHaveBeenCalledWith(
        'ActivityDeclined',
        { activityId: 'act-1', declinedBy: 'teacher-1' },
        'corr-2',
      );
    });

    it('throws ConflictException (409) when the activity is not PROPOSED anymore', async () => {
      mockActivityRepo.findOne.mockResolvedValue({ ...proposedActivity, status: ActivityStatus.CANCELLED });
      const actor: AuthenticatedUser = { id: 'teacher-1', role: UserRole.FORMATEUR };

      await expect(service.decline('act-1', actor)).rejects.toThrow(ConflictException);
      expect(mockActivityRepo.save).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when the caller is not the targeted recipient', async () => {
      mockActivityRepo.findOne.mockResolvedValue({ ...proposedActivity });
      const actor: AuthenticatedUser = { id: 'other-teacher', role: UserRole.FORMATEUR };

      await expect(service.decline('act-1', actor)).rejects.toThrow(ForbiddenException);
      expect(mockActivityRepo.save).not.toHaveBeenCalled();
    });

    it('throws NotFoundException for an unknown activity', async () => {
      mockActivityRepo.findOne.mockResolvedValue(null);
      const actor: AuthenticatedUser = { id: 'teacher-1', role: UserRole.FORMATEUR };

      await expect(service.decline('unknown-id', actor)).rejects.toThrow(NotFoundException);
    });
  });

  // --- findActiveInRange (calendrier de disponibilites, point 2 - busy/free) ---

  describe('findActiveInRange', () => {
    const from = new Date('2026-09-10T00:00:00Z');
    const to = new Date('2026-09-17T00:00:00Z');

    function makeQueryBuilder(result: unknown[]) {
      const queryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(result),
      };
      mockActivityRepo.createQueryBuilder.mockReturnValue(queryBuilder);
      return queryBuilder;
    }

    it('filters by creator-or-participant, PROPOSED/CONFIRMED status, and the requested window', async () => {
      const activities = [{ id: 'act-1', startTime: from, endTime: to }];
      const queryBuilder = makeQueryBuilder(activities);

      const result = await service.findActiveInRange('student-1', from, to);

      expect(result).toEqual(activities);
      expect(queryBuilder.where).toHaveBeenCalledWith(
        expect.stringContaining('creator_id'),
        expect.objectContaining({ userId: 'student-1', uid: '%student-1%' }),
      );
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('status IN'),
        expect.objectContaining({
          statuses: [ActivityStatus.PROPOSED, ActivityStatus.CONFIRMED],
        }),
      );
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('start_time'),
        { to },
      );
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('end_time'),
        { from },
      );
    });

    it('returns an empty array when nothing matches', async () => {
      makeQueryBuilder([]);
      const result = await service.findActiveInRange('student-1', from, to);
      expect(result).toEqual([]);
    });
  });
});
