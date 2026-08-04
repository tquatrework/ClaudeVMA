import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken, getDataSourceToken } from '@nestjs/typeorm';
import { ForbiddenException } from '@nestjs/common';
import { CalendarsService } from '../../../src/calendars/calendars.service';
import { Calendar } from '../../../src/calendars/entities/calendar.entity';
import { AvailabilitySlot, SlotRecurrence } from '../../../src/calendars/entities/availability-slot.entity';
import { PaymentScheduleEntry } from '../../../src/calendars/entities/payment-schedule-entry.entity';
import { EventsService } from '../../../src/events/events.service';
import { UserRole } from '../../../src/common/enums/user-role.enum';
import { AuthenticatedUser } from '../../../src/common/interfaces/authenticated-user.interface';

const mockCalendarRepo = {
  findOne: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
};

const mockSlotRepo = {
  delete: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
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
});
