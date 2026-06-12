import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CalendarsService } from '../../../src/calendars/calendars.service';
import { Calendar } from '../../../src/calendars/entities/calendar.entity';
import { AvailabilitySlot, SlotRecurrence } from '../../../src/calendars/entities/availability-slot.entity';
import { PaymentScheduleEntry } from '../../../src/calendars/entities/payment-schedule-entry.entity';
import { EventsService } from '../../../src/events/events.service';
import { UserRole } from '../../../src/common/enums/user-role.enum';

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

describe('CalendarsService', () => {
  let service: CalendarsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CalendarsService,
        { provide: getRepositoryToken(Calendar), useValue: mockCalendarRepo },
        { provide: getRepositoryToken(AvailabilitySlot), useValue: mockSlotRepo },
        { provide: getRepositoryToken(PaymentScheduleEntry), useValue: mockPaymentRepo },
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

      const result = await service.getCalendar('user-1', 'user-1', UserRole.ELEVE);
      expect(result).toEqual(calendar);
    });

    it('creates calendar lazily when not found', async () => {
      mockCalendarRepo.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
      const created = { id: 'cal-new', ownerId: 'user-2', availabilitySlots: [] };
      mockCalendarRepo.create.mockReturnValue(created);
      mockCalendarRepo.save.mockResolvedValue(created);

      const result = await service.getCalendar('user-2', 'user-2', UserRole.ELEVE);
      expect(result.ownerId).toBe('user-2');
      expect(result.availabilitySlots).toEqual([]);
    });

    it('allows RP to read another user calendar (CAL-FB-001 internal role)', async () => {
      const calendar = { id: 'cal-1', ownerId: 'student-1', availabilitySlots: [] };
      mockCalendarRepo.findOne.mockResolvedValue(calendar);

      await expect(
        service.getCalendar('student-1', 'rp-id', UserRole.RESPONSABLE_PEDAGOGIQUE),
      ).resolves.toBeDefined();
    });

    it('throws ForbiddenException when non-owner with plain role reads another calendar (CAL-FB-001)', async () => {
      await expect(
        service.getCalendar('user-1', 'user-other', UserRole.ELEVE),
      ).rejects.toThrow(ForbiddenException);
    });

    it('returns payment entries for PARENT_FINANCEUR (CAL-BR-003)', async () => {
      const calendar = { id: 'cal-p', ownerId: 'parent-1', availabilitySlots: [] };
      mockCalendarRepo.findOne.mockResolvedValue(calendar);
      const entries = [{ id: 'pe-1', amount: 150, dueDate: new Date() }];
      mockPaymentRepo.find.mockResolvedValue(entries);

      const result = await service.getCalendar('parent-1', 'parent-1', UserRole.PARENT_FINANCEUR);
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

      await service.updateAvailability('teacher-1', dto, 'teacher-1', UserRole.FORMATEUR);
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

      await expect(
        service.updateAvailability('student-1', dto, 'rp-id', UserRole.RESPONSABLE_PEDAGOGIQUE),
      ).resolves.toBeDefined();
    });

    it('throws ForbiddenException when AP tries to update another user availability (CAL-FB-001)', async () => {
      await expect(
        service.updateAvailability('student-1', dto, 'ap-id', UserRole.ANIMATEUR_PEDAGOGIQUE),
      ).rejects.toThrow(ForbiddenException);
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

      const result = await service.updateAvailability('user-3', dto, 'user-3', UserRole.ELEVE);
      expect(result).toBeDefined();
    });
  });
});
