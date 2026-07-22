import { Test, TestingModule } from '@nestjs/testing';
import { CalendarEventsController } from '../../../src/calendar-events/calendar-events.controller';
import { CalendarEventsService } from '../../../src/calendar-events/calendar-events.service';
import { JwtAuthGuard } from '../../../src/common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../src/common/guards/roles.guard';
import { EventType } from '../../../src/calendar-events/entities/calendar-event.entity';
import { UserRole } from '../../../src/common/enums/user-role.enum';
import { AuthenticatedUser } from '../../../src/common/interfaces/authenticated-user.interface';
import { CreateCalendarEventDto } from '../../../src/calendar-events/dto/create-calendar-event.dto';

const mockCalendarEventsService = {
  listEvents: jest.fn(),
  createEvent: jest.fn(),
};

describe('CalendarEventsController', () => {
  let controller: CalendarEventsController;

  beforeEach(async () => {
    const testingModule: TestingModule = await Test.createTestingModule({
      controllers: [CalendarEventsController],
      providers: [
        { provide: CalendarEventsService, useValue: mockCalendarEventsService },
      ],
    })
      .overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard).useValue({ canActivate: () => true })
      .compile();

    controller = testingModule.get<CalendarEventsController>(CalendarEventsController);
    jest.clearAllMocks();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // listEvents
  // ──────────────────────────────────────────────────────────────────────────

  describe('listEvents', () => {
    const actor: AuthenticatedUser = { id: 'user-1', role: UserRole.FORMATEUR };
    const listEventsQuery = {};
    const expectedEventList = [{ id: 'evt-1', ownerId: 'owner-1', eventType: EventType.COURS }];

    it('calls service.listEvents with correct arguments and returns the result', async () => {
      mockCalendarEventsService.listEvents.mockResolvedValue(expectedEventList);

      const result = await controller.listEvents('owner-1', listEventsQuery, actor, undefined);

      expect(mockCalendarEventsService.listEvents).toHaveBeenCalledWith(
        'owner-1',
        actor,
        listEventsQuery,
        undefined,
      );
      expect(result).toEqual(expectedEventList);
    });

    it('propagates correlationId to the service', async () => {
      const correlationId = 'corr-list-001';
      mockCalendarEventsService.listEvents.mockResolvedValue([]);

      await controller.listEvents('owner-1', listEventsQuery, actor, correlationId);

      expect(mockCalendarEventsService.listEvents).toHaveBeenCalledWith(
        'owner-1',
        actor,
        listEventsQuery,
        correlationId,
      );
    });

    it('extracts actor.id and actor.role from the current user', async () => {
      const parentActor: AuthenticatedUser = { id: 'parent-2', role: UserRole.PARENT_FINANCEUR };
      mockCalendarEventsService.listEvents.mockResolvedValue([]);

      await controller.listEvents('owner-2', {}, parentActor, undefined);

      expect(mockCalendarEventsService.listEvents).toHaveBeenCalledWith(
        'owner-2',
        parentActor,
        {},
        undefined,
      );
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // createEvent
  // ──────────────────────────────────────────────────────────────────────────

  describe('createEvent', () => {
    const actor: AuthenticatedUser = { id: 'teacher-1', role: UserRole.FORMATEUR };
    const createEventDto: CreateCalendarEventDto = {
      title: 'Cours de maths',
      eventType: EventType.COURS,
      startTime: '2026-07-01T10:00:00Z',
      endTime: '2026-07-01T11:00:00Z',
    };
    const createdEvent = { id: 'evt-new', ownerId: 'teacher-1', ...createEventDto };

    it('calls service.createEvent with correct arguments and returns the result', async () => {
      mockCalendarEventsService.createEvent.mockResolvedValue(createdEvent);

      const result = await controller.createEvent('teacher-1', createEventDto, actor, undefined);

      expect(mockCalendarEventsService.createEvent).toHaveBeenCalledWith(
        'teacher-1',
        createEventDto,
        actor,
        undefined,
      );
      expect(result).toEqual(createdEvent);
    });

    it('propagates correlationId to the service', async () => {
      const correlationId = 'corr-create-001';
      mockCalendarEventsService.createEvent.mockResolvedValue(createdEvent);

      await controller.createEvent('teacher-1', createEventDto, actor, correlationId);

      expect(mockCalendarEventsService.createEvent).toHaveBeenCalledWith(
        'teacher-1',
        createEventDto,
        actor,
        correlationId,
      );
    });

    it('extracts actor.id and actor.role from the current user', async () => {
      const rpActor: AuthenticatedUser = { id: 'rp-1', role: UserRole.RESPONSABLE_PEDAGOGIQUE };
      mockCalendarEventsService.createEvent.mockResolvedValue({ id: 'evt-rp' });

      await controller.createEvent('rp-1', createEventDto, rpActor, undefined);

      expect(mockCalendarEventsService.createEvent).toHaveBeenCalledWith(
        'rp-1',
        createEventDto,
        rpActor,
        undefined,
      );
    });
  });
});
