import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { ActivitiesService } from '../../../src/activities/activities.service';
import { ScheduledActivity, ActivityType, ActivityStatus } from '../../../src/activities/entities/scheduled-activity.entity';
import { EventsService } from '../../../src/events/events.service';
import { UserRole } from '../../../src/common/enums/user-role.enum';
import { AuthenticatedUser } from '../../../src/common/interfaces/authenticated-user.interface';

const mockActivityRepo = {
  findOne: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
  createQueryBuilder: jest.fn(),
};

const mockEventsService = { publish: jest.fn() };

const validCreateDto = {
  title: 'Cours algèbre',
  type: ActivityType.COURS,
  participantIds: ['student-uuid-1'],
  startTime: '2026-06-10T14:00:00Z',
  endTime: '2026-06-10T15:00:00Z',
};

describe('ActivitiesService', () => {
  let service: ActivitiesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActivitiesService,
        { provide: getRepositoryToken(ScheduledActivity), useValue: mockActivityRepo },
        { provide: EventsService, useValue: mockEventsService },
      ],
    }).compile();

    service = module.get<ActivitiesService>(ActivitiesService);
    jest.clearAllMocks();
  });

  // --- create ---

  describe('create', () => {
    it('creates a COURS activity for a FORMATEUR and publishes ActivityScheduled', async () => {
      const saved = { id: 'act-1', ...validCreateDto, creatorId: 'teacher-1', creatorRole: UserRole.FORMATEUR, status: ActivityStatus.PROPOSED };
      mockActivityRepo.create.mockReturnValue(saved);
      mockActivityRepo.save.mockResolvedValue(saved);
      const actor: AuthenticatedUser = { id: 'teacher-1', role: UserRole.FORMATEUR };

      const result = await service.create(validCreateDto, actor);
      expect(result.id).toBe('act-1');
      expect(mockEventsService.publish).toHaveBeenCalledWith(
        'ActivityScheduled',
        expect.objectContaining({ activityId: 'act-1', type: ActivityType.COURS }),
        undefined,
      );
    });

    it('creates a REUNION_PEDAGOGIQUE for AP (CAL-BR-008)', async () => {
      const dto = { ...validCreateDto, type: ActivityType.REUNION_PEDAGOGIQUE };
      const saved = { id: 'act-2', ...dto, creatorId: 'ap-1', creatorRole: UserRole.ANIMATEUR_PEDAGOGIQUE, status: ActivityStatus.PROPOSED };
      mockActivityRepo.create.mockReturnValue(saved);
      mockActivityRepo.save.mockResolvedValue(saved);
      const actor: AuthenticatedUser = { id: 'ap-1', role: UserRole.ANIMATEUR_PEDAGOGIQUE };

      const result = await service.create(dto, actor);
      expect(result.id).toBe('act-2');
    });

    it('throws ForbiddenException when AP tries to create a COURS (CAL-FB-003)', async () => {
      const actor: AuthenticatedUser = { id: 'ap-1', role: UserRole.ANIMATEUR_PEDAGOGIQUE };
      await expect(service.create(validCreateDto, actor)).rejects.toThrow(ForbiddenException);
    });

    it('creates activity with multiple participants (CAL-BR-007)', async () => {
      const dto = { ...validCreateDto, participantIds: ['s1', 's2', 's3'] };
      const saved = { id: 'act-3', ...dto, creatorId: 'teacher-1', creatorRole: UserRole.FORMATEUR, status: ActivityStatus.PROPOSED };
      mockActivityRepo.create.mockReturnValue(saved);
      mockActivityRepo.save.mockResolvedValue(saved);
      const actor: AuthenticatedUser = { id: 'teacher-1', role: UserRole.FORMATEUR };

      const result = await service.create(dto, actor);
      expect(result.id).toBe('act-3');
    });

    it('RP can create ENTRETIEN_RP (CAL-BR-004, CAL-BR-005)', async () => {
      const dto = { ...validCreateDto, type: ActivityType.ENTRETIEN_RP };
      const saved = { id: 'act-4', ...dto, creatorId: 'rp-1', creatorRole: UserRole.RESPONSABLE_PEDAGOGIQUE, status: ActivityStatus.PROPOSED };
      mockActivityRepo.create.mockReturnValue(saved);
      mockActivityRepo.save.mockResolvedValue(saved);
      const actor: AuthenticatedUser = { id: 'rp-1', role: UserRole.RESPONSABLE_PEDAGOGIQUE };

      const result = await service.create(dto, actor);
      expect(result.id).toBe('act-4');
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
});
