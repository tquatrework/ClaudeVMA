import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken, getDataSourceToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { CalendarsService } from '../../../src/calendars/calendars.service';
import { Calendar } from '../../../src/calendars/entities/calendar.entity';
import {
  AvailabilitySlot,
  SlotRecurrence,
  SlotKind,
} from '../../../src/calendars/entities/availability-slot.entity';
import { PaymentScheduleEntry } from '../../../src/calendars/entities/payment-schedule-entry.entity';
import { EventsService } from '../../../src/events/events.service';
import { UserRole } from '../../../src/common/enums/user-role.enum';
import { AuthenticatedUser } from '../../../src/common/interfaces/authenticated-user.interface';

const mockCalendarRepo = {
  findOne: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
};

const mockSlotQueryBuilder = {
  innerJoin: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  getOne: jest.fn(),
};

const mockSlotRepo = {
  delete: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  createQueryBuilder: jest.fn(() => mockSlotQueryBuilder),
};

const mockPaymentRepo = {
  find: jest.fn(),
};

const mockEventsService = {
  publish: jest.fn(),
};

/**
 * The transaction manager exposes the same repositories used outside a
 * transaction, so the existing mocks can be reused inside `manager.getRepository(...)`.
 */
const mockManager = {
  getRepository: jest.fn((entity: unknown) => {
    if (entity === Calendar) return mockCalendarRepo;
    if (entity === AvailabilitySlot) return mockSlotRepo;
    throw new Error(`Unexpected entity requested from transaction manager: ${entity}`);
  }),
};

const mockDataSource = {
  transaction: jest.fn(async (callback: (manager: unknown) => unknown) => callback(mockManager)),
};

describe('CalendarsService', () => {
  let service: CalendarsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CalendarsService,
        { provide: getRepositoryToken(Calendar), useValue: mockCalendarRepo },
        { provide: getRepositoryToken(AvailabilitySlot), useValue: mockSlotRepo },
        { provide: getRepositoryToken(PaymentScheduleEntry), useValue: mockPaymentRepo },
        { provide: getDataSourceToken(), useValue: mockDataSource },
        { provide: EventsService, useValue: mockEventsService },
      ],
    }).compile();

    service = module.get<CalendarsService>(CalendarsService);
    jest.clearAllMocks();
  });

  // --- getCalendar ---

  describe('getCalendar', () => {
    it('returns calendar for its owner', async () => {
      const calendar = { id: 'cal-1', ownerId: 'user-1', availabilitySlots: [] };
      mockCalendarRepo.findOne.mockResolvedValue(calendar);
      const actor: AuthenticatedUser = { id: 'user-1', role: UserRole.ELEVE };

      const result = await service.getCalendar('user-1', actor);
      expect(result).toEqual(calendar);
    });

    it('creates calendar lazily when not found', async () => {
      mockCalendarRepo.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
      const created = { id: 'cal-new', ownerId: 'user-2', availabilitySlots: [] };
      mockCalendarRepo.create.mockReturnValue(created);
      mockCalendarRepo.save.mockResolvedValue(created);
      const actor: AuthenticatedUser = { id: 'user-2', role: UserRole.ELEVE };

      const result = await service.getCalendar('user-2', actor);
      expect(result.ownerId).toBe('user-2');
      expect(result.availabilitySlots).toEqual([]);
    });

    it('allows RP to read another user calendar (CAL-FB-001 internal role)', async () => {
      const calendar = { id: 'cal-1', ownerId: 'student-1', availabilitySlots: [] };
      mockCalendarRepo.findOne.mockResolvedValue(calendar);
      const actor: AuthenticatedUser = { id: 'rp-id', role: UserRole.RESPONSABLE_PEDAGOGIQUE };

      await expect(service.getCalendar('student-1', actor)).resolves.toBeDefined();
    });

    it('throws ForbiddenException when non-owner with plain role reads another calendar (CAL-FB-001)', async () => {
      const actor: AuthenticatedUser = { id: 'user-other', role: UserRole.ELEVE };
      await expect(service.getCalendar('user-1', actor)).rejects.toThrow(ForbiddenException);
    });

    it('returns payment entries for PARENT_FINANCEUR (CAL-BR-003)', async () => {
      const calendar = { id: 'cal-p', ownerId: 'parent-1', availabilitySlots: [] };
      mockCalendarRepo.findOne.mockResolvedValue(calendar);
      const entries = [{ id: 'pe-1', amount: 150, dueDate: new Date() }];
      mockPaymentRepo.find.mockResolvedValue(entries);
      const actor: AuthenticatedUser = { id: 'parent-1', role: UserRole.PARENT_FINANCEUR };

      const result = await service.getCalendar('parent-1', actor);
      expect(result['paymentEntries']).toEqual(entries);
    });
  });

  // --- updateAvailability ---

  describe('updateAvailability', () => {
    const dto = {
      slots: [
        { startTime: '2026-06-10T09:00:00Z', endTime: '2026-06-10T11:00:00Z', recurrence: SlotRecurrence.WEEKLY },
      ],
    };

    it('updates slots for owner and publishes AvailabilityUpdated', async () => {
      const calendar = { id: 'cal-1', ownerId: 'teacher-1' };
      mockCalendarRepo.findOne.mockResolvedValue(calendar);
      mockSlotRepo.delete.mockResolvedValue({});
      mockSlotRepo.create.mockImplementation((s) => s);
      mockSlotRepo.save.mockResolvedValue([]);
      mockCalendarRepo.findOne.mockResolvedValue({ ...calendar, availabilitySlots: [] });
      const actor: AuthenticatedUser = { id: 'teacher-1', role: UserRole.FORMATEUR };

      await service.updateAvailability('teacher-1', dto, actor);
      expect(mockDataSource.transaction).toHaveBeenCalledTimes(1);
      expect(mockEventsService.publish).toHaveBeenCalledWith(
        'AvailabilityUpdated',
        expect.objectContaining({ ownerId: 'teacher-1' }),
        undefined,
      );
    });

    it('allows RP to update availability of another user (CAL-FB-001)', async () => {
      const calendar = { id: 'cal-1', ownerId: 'student-1' };
      mockCalendarRepo.findOne.mockResolvedValue(calendar);
      mockSlotRepo.delete.mockResolvedValue({});
      mockSlotRepo.create.mockImplementation((s) => s);
      mockSlotRepo.save.mockResolvedValue([]);
      mockCalendarRepo.findOne.mockResolvedValue({ ...calendar, availabilitySlots: [] });
      const actor: AuthenticatedUser = { id: 'rp-id', role: UserRole.RESPONSABLE_PEDAGOGIQUE };

      await expect(service.updateAvailability('student-1', dto, actor)).resolves.toBeDefined();
    });

    it('throws ForbiddenException when AP tries to update another user availability (CAL-FB-001)', async () => {
      const actor: AuthenticatedUser = { id: 'ap-id', role: UserRole.ANIMATEUR_PEDAGOGIQUE };
      await expect(service.updateAvailability('student-1', dto, actor)).rejects.toThrow(ForbiddenException);
      // The transaction must never start when authorization fails upfront.
      expect(mockDataSource.transaction).not.toHaveBeenCalled();
    });

    it('creates calendar lazily when updating availability', async () => {
      mockCalendarRepo.findOne.mockResolvedValueOnce(null);
      const created = { id: 'cal-new', ownerId: 'user-3' };
      mockCalendarRepo.create.mockReturnValue(created);
      mockCalendarRepo.save.mockResolvedValue(created);
      mockSlotRepo.delete.mockResolvedValue({});
      mockSlotRepo.create.mockImplementation((s) => s);
      mockSlotRepo.save.mockResolvedValue([]);
      mockCalendarRepo.findOne.mockResolvedValue({ ...created, availabilitySlots: [] });
      const actor: AuthenticatedUser = { id: 'user-3', role: UserRole.ELEVE };

      const result = await service.updateAvailability('user-3', dto, actor);
      expect(result).toBeDefined();
    });
  });

  // --- createSlot ---

  describe('createSlot', () => {
    const dto = {
      startTime: '2026-09-10T09:00:00Z',
      endTime: '2026-09-10T11:00:00Z',
    };

    it('creates a slot for its owner and publishes AvailabilityUpdated', async () => {
      const calendar = { id: 'cal-1', ownerId: 'teacher-1' };
      mockCalendarRepo.findOne.mockResolvedValue(calendar);
      mockSlotRepo.create.mockImplementation((s) => s);
      mockSlotRepo.save.mockResolvedValue({ id: 'slot-1', ...dto });
      const actor: AuthenticatedUser = { id: 'teacher-1', role: UserRole.FORMATEUR };

      const result = await service.createSlot('teacher-1', dto, actor);

      expect(result).toEqual({ id: 'slot-1', ...dto });
      expect(mockEventsService.publish).toHaveBeenCalledWith(
        'AvailabilityUpdated',
        expect.objectContaining({ ownerId: 'teacher-1', slotId: 'slot-1', action: 'created' }),
        undefined,
      );
    });

    it('allows a student to create a slot for themselves (CAL-BR-001)', async () => {
      const calendar = { id: 'cal-2', ownerId: 'student-1' };
      mockCalendarRepo.findOne.mockResolvedValue(calendar);
      mockSlotRepo.create.mockImplementation((s) => s);
      mockSlotRepo.save.mockResolvedValue({ id: 'slot-2', ...dto });
      const actor: AuthenticatedUser = { id: 'student-1', role: UserRole.ELEVE };

      await expect(service.createSlot('student-1', dto, actor)).resolves.toBeDefined();
    });

    it('creates the calendar lazily when it does not exist yet', async () => {
      mockCalendarRepo.findOne.mockResolvedValueOnce(null);
      const createdCalendar = { id: 'cal-new', ownerId: 'user-3' };
      mockCalendarRepo.create.mockReturnValue(createdCalendar);
      mockCalendarRepo.save.mockResolvedValue(createdCalendar);
      mockSlotRepo.create.mockImplementation((s) => s);
      mockSlotRepo.save.mockResolvedValue({ id: 'slot-3', ...dto });
      const actor: AuthenticatedUser = { id: 'user-3', role: UserRole.ELEVE };

      const result = await service.createSlot('user-3', dto, actor);
      expect(result).toBeDefined();
      expect(mockCalendarRepo.save).toHaveBeenCalled();
    });

    it('throws ForbiddenException for a non-owner without write role (CAL-FB-001)', async () => {
      const actor: AuthenticatedUser = { id: 'someone-else', role: UserRole.ANIMATEUR_PEDAGOGIQUE };
      await expect(service.createSlot('student-1', dto, actor)).rejects.toThrow(ForbiddenException);
      expect(mockDataSource.transaction).not.toHaveBeenCalled();
    });

    it('rejects endTime <= startTime with BadRequestException', async () => {
      const actor: AuthenticatedUser = { id: 'teacher-1', role: UserRole.FORMATEUR };
      const invalidDto = { startTime: '2026-09-10T11:00:00Z', endTime: '2026-09-10T09:00:00Z' };
      await expect(service.createSlot('teacher-1', invalidDto, actor)).rejects.toThrow(BadRequestException);
      expect(mockDataSource.transaction).not.toHaveBeenCalled();
    });

    it('rejects a recurrenceEndDate before startTime with BadRequestException', async () => {
      const actor: AuthenticatedUser = { id: 'teacher-1', role: UserRole.FORMATEUR };
      const invalidDto = {
        ...dto,
        recurrence: SlotRecurrence.WEEKLY,
        recurrenceEndDate: '2026-09-01T00:00:00Z',
      };
      await expect(service.createSlot('teacher-1', invalidDto, actor)).rejects.toThrow(BadRequestException);
    });

    it('defaults kind to AVAILABLE when omitted', async () => {
      const calendar = { id: 'cal-1', ownerId: 'teacher-1' };
      mockCalendarRepo.findOne.mockResolvedValue(calendar);
      let savedArg: Record<string, unknown> = {};
      mockSlotRepo.create.mockImplementation((s: Record<string, unknown>) => s);
      mockSlotRepo.save.mockImplementation(async (s: Record<string, unknown>) => {
        savedArg = s;
        return { id: 'slot-1', ...s };
      });
      const actor: AuthenticatedUser = { id: 'teacher-1', role: UserRole.FORMATEUR };

      await service.createSlot('teacher-1', dto, actor);
      expect(savedArg.kind).toBe(SlotKind.AVAILABLE);
    });
  });

  // --- updateSlot ---

  describe('updateSlot', () => {
    const existingSlot = {
      id: 'slot-1',
      calendarId: 'cal-1',
      dayOfWeek: null,
      startTime: new Date('2026-09-10T09:00:00Z'),
      endTime: new Date('2026-09-10T11:00:00Z'),
      recurrence: SlotRecurrence.NONE,
      recurrenceEndDate: null,
      kind: SlotKind.AVAILABLE,
    };

    it('updates a slot owned by the actor and publishes AvailabilityUpdated', async () => {
      mockSlotQueryBuilder.getOne.mockResolvedValue(existingSlot);
      mockSlotRepo.save.mockResolvedValue({ ...existingSlot, kind: SlotKind.UNAVAILABLE });
      const actor: AuthenticatedUser = { id: 'teacher-1', role: UserRole.FORMATEUR };

      const result = await service.updateSlot(
        'teacher-1',
        'slot-1',
        { kind: SlotKind.UNAVAILABLE },
        actor,
      );

      expect(result.kind).toBe(SlotKind.UNAVAILABLE);
      expect(mockEventsService.publish).toHaveBeenCalledWith(
        'AvailabilityUpdated',
        expect.objectContaining({ ownerId: 'teacher-1', slotId: 'slot-1', action: 'updated' }),
        undefined,
      );
    });

    it('allows RP to update a slot belonging to another user (CAL-FB-001)', async () => {
      mockSlotQueryBuilder.getOne.mockResolvedValue(existingSlot);
      mockSlotRepo.save.mockResolvedValue(existingSlot);
      const actor: AuthenticatedUser = { id: 'rp-id', role: UserRole.RESPONSABLE_PEDAGOGIQUE };

      await expect(
        service.updateSlot('student-1', 'slot-1', { kind: SlotKind.AVAILABLE }, actor),
      ).resolves.toBeDefined();
    });

    it('throws ForbiddenException for a non-owner without write role', async () => {
      const actor: AuthenticatedUser = { id: 'someone-else', role: UserRole.ELEVE };
      await expect(service.updateSlot('student-1', 'slot-1', {}, actor)).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockSlotQueryBuilder.getOne).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the slot does not exist', async () => {
      mockSlotQueryBuilder.getOne.mockResolvedValue(null);
      const actor: AuthenticatedUser = { id: 'teacher-1', role: UserRole.FORMATEUR };
      await expect(
        service.updateSlot('teacher-1', 'unknown-slot', {}, actor),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when the slot belongs to a different owner (no existence leak)', async () => {
      // findSlotOrFail scopes the query by ownerId; a mismatched pair resolves to no row.
      mockSlotQueryBuilder.getOne.mockResolvedValue(null);
      const actor: AuthenticatedUser = { id: 'rp-id', role: UserRole.RESPONSABLE_PEDAGOGIQUE };
      await expect(
        service.updateSlot('other-owner', 'slot-1', {}, actor),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects a resize where the resulting endTime <= startTime', async () => {
      mockSlotQueryBuilder.getOne.mockResolvedValue(existingSlot);
      const actor: AuthenticatedUser = { id: 'teacher-1', role: UserRole.FORMATEUR };
      await expect(
        service.updateSlot('teacher-1', 'slot-1', { startTime: '2026-09-10T12:00:00Z' }, actor),
      ).rejects.toThrow(BadRequestException);
    });

    it('clears recurrenceEndDate when explicitly set to null', async () => {
      const boundedSlot = {
        ...existingSlot,
        recurrence: SlotRecurrence.WEEKLY,
        recurrenceEndDate: new Date('2026-10-01T00:00:00Z'),
      };
      mockSlotQueryBuilder.getOne.mockResolvedValue(boundedSlot);
      let savedArg: Record<string, unknown> = {};
      mockSlotRepo.save.mockImplementation(async (s: Record<string, unknown>) => {
        savedArg = s;
        return s;
      });
      const actor: AuthenticatedUser = { id: 'teacher-1', role: UserRole.FORMATEUR };

      await service.updateSlot('teacher-1', 'slot-1', { recurrenceEndDate: null }, actor);
      expect(savedArg.recurrenceEndDate).toBeNull();
    });
  });

  // --- deleteSlot ---

  describe('deleteSlot', () => {
    const existingSlot = { id: 'slot-1', calendarId: 'cal-1' };

    it('deletes a slot owned by the actor and publishes AvailabilityUpdated', async () => {
      mockSlotQueryBuilder.getOne.mockResolvedValue(existingSlot);
      mockSlotRepo.delete.mockResolvedValue({ affected: 1 });
      const actor: AuthenticatedUser = { id: 'teacher-1', role: UserRole.FORMATEUR };

      await service.deleteSlot('teacher-1', 'slot-1', actor);

      expect(mockSlotRepo.delete).toHaveBeenCalledWith({ id: 'slot-1' });
      expect(mockEventsService.publish).toHaveBeenCalledWith(
        'AvailabilityUpdated',
        expect.objectContaining({ ownerId: 'teacher-1', slotId: 'slot-1', action: 'deleted' }),
        undefined,
      );
    });

    it('allows TI to delete a slot belonging to another user (CAL-FB-001)', async () => {
      mockSlotQueryBuilder.getOne.mockResolvedValue(existingSlot);
      mockSlotRepo.delete.mockResolvedValue({ affected: 1 });
      const actor: AuthenticatedUser = { id: 'ti-id', role: UserRole.TECHNICIEN_INFORMATIQUE };

      await expect(service.deleteSlot('student-1', 'slot-1', actor)).resolves.toBeUndefined();
    });

    it('throws ForbiddenException for a non-owner without write role', async () => {
      const actor: AuthenticatedUser = { id: 'someone-else', role: UserRole.ELEVE };
      await expect(service.deleteSlot('student-1', 'slot-1', actor)).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockSlotRepo.delete).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the slot does not exist for this owner', async () => {
      mockSlotQueryBuilder.getOne.mockResolvedValue(null);
      const actor: AuthenticatedUser = { id: 'rp-id', role: UserRole.RESPONSABLE_PEDAGOGIQUE };
      await expect(service.deleteSlot('student-1', 'unknown-slot', actor)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockSlotRepo.delete).not.toHaveBeenCalled();
    });
  });
});
