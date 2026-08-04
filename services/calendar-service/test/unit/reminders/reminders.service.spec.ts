import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RemindersService } from '../../../src/reminders/reminders.service';
import { Reminder } from '../../../src/reminders/entities/reminder.entity';
import { EventsService } from '../../../src/events/events.service';
import { UserRole } from '../../../src/common/enums/user-role.enum';
import { AuthenticatedUser } from '../../../src/common/interfaces/authenticated-user.interface';

const mockReminderRepo = {
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
};

const mockEventsService = { publish: jest.fn() };

describe('RemindersService', () => {
  let service: RemindersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RemindersService,
        { provide: getRepositoryToken(Reminder), useValue: mockReminderRepo },
        { provide: EventsService, useValue: mockEventsService },
      ],
    }).compile();

    service = module.get<RemindersService>(RemindersService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('creates a reminder and publishes ReminderCreated (CAL-BR-010)', async () => {
      const dto = {
        ownerId: 'rp-user-1',
        ownerRole: UserRole.RESPONSABLE_PEDAGOGIQUE,
        message: 'Entretien demain',
        remindAt: '2026-06-10T08:00:00Z',
      };

      const saved = {
        id: 'rem-1',
        ...dto,
        activityId: null,
        remindAt: new Date(dto.remindAt),
        isSent: false,
        createdAt: new Date(),
      };

      mockReminderRepo.create.mockReturnValue(saved);
      mockReminderRepo.save.mockResolvedValue(saved);

      const actor: AuthenticatedUser = { id: 'rp-user-1', role: UserRole.RESPONSABLE_PEDAGOGIQUE };
      const result = await service.create(dto, actor);

      expect(result.id).toBe('rem-1');
      expect(mockEventsService.publish).toHaveBeenCalledWith(
        'ReminderCreated',
        expect.objectContaining({ reminderId: 'rem-1', ownerId: 'rp-user-1' }),
        undefined,
      );
    });

    it('creates a reminder linked to an activity', async () => {
      const dto = {
        ownerId: 'teacher-1',
        ownerRole: UserRole.FORMATEUR,
        activityId: 'act-uuid-1',
        message: 'Cours dans 1h',
        remindAt: '2026-06-10T13:00:00Z',
      };

      const saved = {
        id: 'rem-2',
        ...dto,
        remindAt: new Date(dto.remindAt),
        isSent: false,
        createdAt: new Date(),
      };

      mockReminderRepo.create.mockReturnValue(saved);
      mockReminderRepo.save.mockResolvedValue(saved);

      const actor: AuthenticatedUser = { id: 'teacher-1', role: UserRole.FORMATEUR };
      const result = await service.create(dto, actor, 'corr-abc');
      expect(result.activityId).toBe('act-uuid-1');
      expect(mockEventsService.publish).toHaveBeenCalledWith(
        'ReminderCreated',
        expect.objectContaining({ activityId: 'act-uuid-1' }),
        'corr-abc',
      );
    });
  });

  describe('findByOwner', () => {
    it('returns reminders sorted by remindAt', async () => {
      const reminders = [
        { id: 'rem-1', ownerId: 'rp-1', remindAt: new Date('2026-06-10T08:00:00Z') },
        { id: 'rem-2', ownerId: 'rp-1', remindAt: new Date('2026-06-11T08:00:00Z') },
      ];
      mockReminderRepo.find.mockResolvedValue(reminders);

      const result = await service.findByOwner('rp-1');
      expect(result).toHaveLength(2);
      expect(mockReminderRepo.find).toHaveBeenCalledWith({
        where: { ownerId: 'rp-1' },
        order: { remindAt: 'ASC' },
      });
    });

    it('returns empty array when no reminders', async () => {
      mockReminderRepo.find.mockResolvedValue([]);
      const result = await service.findByOwner('no-reminders');
      expect(result).toEqual([]);
    });
  });
});
