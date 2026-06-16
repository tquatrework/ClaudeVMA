import { Test, TestingModule } from '@nestjs/testing';
import { CalendarEventsController } from '../../../src/calendar-events/calendar-events.controller';
import { CalendarEventsService } from '../../../src/calendar-events/calendar-events.service';
import { JwtAuthGuard } from '../../../src/common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../src/common/guards/roles.guard';
import { EventType } from '../../../src/calendar-events/entities/calendar-event.entity';
import { ReminderDelay } from '../../../src/calendar-events/entities/reminder-rule.entity';
import { UserRole } from '../../../src/common/enums/user-role.enum';
import { CreateCalendarEventDto } from '../../../src/calendar-events/dto/create-calendar-event.dto';
import { CancelRequestDto } from '../../../src/calendar-events/dto/cancel-request.dto';
import { ConfigureReminderDto } from '../../../src/calendar-events/dto/configure-reminder.dto';
import { CreateVisibilityGrantDto } from '../../../src/calendar-events/dto/create-visibility-grant.dto';

const mockCalendarEventsService = {
  listEvents: jest.fn(),
  createEvent: jest.fn(),
  acceptInvitation: jest.fn(),
  declineInvitation: jest.fn(),
  requestCancellation: jest.fn(),
  configureReminder: jest.fn(),
  createVisibilityGrant: jest.fn(),
  revokeVisibilityGrant: jest.fn(),
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
    const mockRequest = { user: { id: 'user-1', role: UserRole.FORMATEUR } };
    const listEventsQuery = {};
    const expectedEventList = [{ id: 'evt-1', ownerId: 'owner-1', eventType: EventType.COURS }];

    it('calls service.listEvents with correct arguments and returns the result', async () => {
      mockCalendarEventsService.listEvents.mockResolvedValue(expectedEventList);

      const result = await controller.listEvents('owner-1', listEventsQuery, mockRequest, undefined);

      expect(mockCalendarEventsService.listEvents).toHaveBeenCalledWith(
        'owner-1',
        'user-1',
        UserRole.FORMATEUR,
        listEventsQuery,
        undefined,
      );
      expect(result).toEqual(expectedEventList);
    });

    it('propagates correlationId to the service', async () => {
      const correlationId = 'corr-list-001';
      mockCalendarEventsService.listEvents.mockResolvedValue([]);

      await controller.listEvents('owner-1', listEventsQuery, mockRequest, correlationId);

      expect(mockCalendarEventsService.listEvents).toHaveBeenCalledWith(
        'owner-1',
        'user-1',
        UserRole.FORMATEUR,
        listEventsQuery,
        correlationId,
      );
    });

    it('extracts user.id and user.role from the request object', async () => {
      const parentRequest = { user: { id: 'parent-2', role: UserRole.PARENT_FINANCEUR } };
      mockCalendarEventsService.listEvents.mockResolvedValue([]);

      await controller.listEvents('owner-2', {}, parentRequest, undefined);

      expect(mockCalendarEventsService.listEvents).toHaveBeenCalledWith(
        'owner-2',
        'parent-2',
        UserRole.PARENT_FINANCEUR,
        {},
        undefined,
      );
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // createEvent
  // ──────────────────────────────────────────────────────────────────────────

  describe('createEvent', () => {
    const mockRequest = { user: { id: 'teacher-1', role: UserRole.FORMATEUR } };
    const createEventDto: CreateCalendarEventDto = {
      title: 'Cours de maths',
      eventType: EventType.COURS,
      startTime: '2026-07-01T10:00:00Z',
      endTime: '2026-07-01T11:00:00Z',
    };
    const createdEvent = { id: 'evt-new', ownerId: 'teacher-1', ...createEventDto };

    it('calls service.createEvent with correct arguments and returns the result', async () => {
      mockCalendarEventsService.createEvent.mockResolvedValue(createdEvent);

      const result = await controller.createEvent('teacher-1', createEventDto, mockRequest, undefined);

      expect(mockCalendarEventsService.createEvent).toHaveBeenCalledWith(
        'teacher-1',
        createEventDto,
        'teacher-1',
        UserRole.FORMATEUR,
        undefined,
      );
      expect(result).toEqual(createdEvent);
    });

    it('propagates correlationId to the service', async () => {
      const correlationId = 'corr-create-001';
      mockCalendarEventsService.createEvent.mockResolvedValue(createdEvent);

      await controller.createEvent('teacher-1', createEventDto, mockRequest, correlationId);

      expect(mockCalendarEventsService.createEvent).toHaveBeenCalledWith(
        'teacher-1',
        createEventDto,
        'teacher-1',
        UserRole.FORMATEUR,
        correlationId,
      );
    });

    it('extracts user.id and user.role from the request object', async () => {
      const rpRequest = { user: { id: 'rp-1', role: UserRole.RESPONSABLE_PEDAGOGIQUE } };
      mockCalendarEventsService.createEvent.mockResolvedValue({ id: 'evt-rp' });

      await controller.createEvent('rp-1', createEventDto, rpRequest, undefined);

      expect(mockCalendarEventsService.createEvent).toHaveBeenCalledWith(
        'rp-1',
        createEventDto,
        'rp-1',
        UserRole.RESPONSABLE_PEDAGOGIQUE,
        undefined,
      );
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // acceptInvitation
  // ──────────────────────────────────────────────────────────────────────────

  describe('acceptInvitation', () => {
    const mockRequest = { user: { id: 'invitee-1', role: UserRole.ELEVE } };
    const acceptedInvitation = { id: 'inv-1', eventId: 'evt-1', inviteeId: 'invitee-1', status: 'ACCEPTED' };

    it('calls service.acceptInvitation with eventId, userId and correlationId and returns the result', async () => {
      mockCalendarEventsService.acceptInvitation.mockResolvedValue(acceptedInvitation);

      const result = await controller.acceptInvitation('evt-1', 'invitee-1', mockRequest, undefined);

      expect(mockCalendarEventsService.acceptInvitation).toHaveBeenCalledWith(
        'evt-1',
        'invitee-1',
        undefined,
      );
      expect(result).toEqual(acceptedInvitation);
    });

    it('propagates correlationId to the service', async () => {
      const correlationId = 'corr-accept-001';
      mockCalendarEventsService.acceptInvitation.mockResolvedValue(acceptedInvitation);

      await controller.acceptInvitation('evt-1', 'invitee-1', mockRequest, correlationId);

      expect(mockCalendarEventsService.acceptInvitation).toHaveBeenCalledWith(
        'evt-1',
        'invitee-1',
        correlationId,
      );
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // declineInvitation
  // ──────────────────────────────────────────────────────────────────────────

  describe('declineInvitation', () => {
    const mockRequest = { user: { id: 'invitee-2', role: UserRole.FORMATEUR } };
    const declinedInvitation = { id: 'inv-2', eventId: 'evt-2', inviteeId: 'invitee-2', status: 'DECLINED' };

    it('calls service.declineInvitation with eventId, userId and correlationId and returns the result', async () => {
      mockCalendarEventsService.declineInvitation.mockResolvedValue(declinedInvitation);

      const result = await controller.declineInvitation('evt-2', 'invitee-2', mockRequest, undefined);

      expect(mockCalendarEventsService.declineInvitation).toHaveBeenCalledWith(
        'evt-2',
        'invitee-2',
        undefined,
      );
      expect(result).toEqual(declinedInvitation);
    });

    it('propagates correlationId to the service', async () => {
      const correlationId = 'corr-decline-001';
      mockCalendarEventsService.declineInvitation.mockResolvedValue(declinedInvitation);

      await controller.declineInvitation('evt-2', 'invitee-2', mockRequest, correlationId);

      expect(mockCalendarEventsService.declineInvitation).toHaveBeenCalledWith(
        'evt-2',
        'invitee-2',
        correlationId,
      );
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // requestCancellation
  // ──────────────────────────────────────────────────────────────────────────

  describe('requestCancellation', () => {
    const mockRequest = { user: { id: 'teacher-1', role: UserRole.FORMATEUR } };
    const cancelRequestDto: CancelRequestDto = { reason: 'Indisponibilité imprévue' };
    const cancellationResult = { id: 'req-1', eventId: 'evt-3', status: 'APPROVED' };

    it('calls service.requestCancellation with correct arguments and returns the result', async () => {
      mockCalendarEventsService.requestCancellation.mockResolvedValue(cancellationResult);

      const result = await controller.requestCancellation('evt-3', cancelRequestDto, mockRequest, undefined);

      expect(mockCalendarEventsService.requestCancellation).toHaveBeenCalledWith(
        'evt-3',
        cancelRequestDto,
        'teacher-1',
        UserRole.FORMATEUR,
        undefined,
      );
      expect(result).toEqual(cancellationResult);
    });

    it('propagates correlationId to the service', async () => {
      const correlationId = 'corr-cancel-001';
      mockCalendarEventsService.requestCancellation.mockResolvedValue(cancellationResult);

      await controller.requestCancellation('evt-3', cancelRequestDto, mockRequest, correlationId);

      expect(mockCalendarEventsService.requestCancellation).toHaveBeenCalledWith(
        'evt-3',
        cancelRequestDto,
        'teacher-1',
        UserRole.FORMATEUR,
        correlationId,
      );
    });

    it('extracts user.id and user.role from the request object', async () => {
      const rpRequest = { user: { id: 'rp-1', role: UserRole.RESPONSABLE_PEDAGOGIQUE } };
      mockCalendarEventsService.requestCancellation.mockResolvedValue(cancellationResult);

      await controller.requestCancellation('evt-3', cancelRequestDto, rpRequest, undefined);

      expect(mockCalendarEventsService.requestCancellation).toHaveBeenCalledWith(
        'evt-3',
        cancelRequestDto,
        'rp-1',
        UserRole.RESPONSABLE_PEDAGOGIQUE,
        undefined,
      );
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // configureReminder
  // ──────────────────────────────────────────────────────────────────────────

  describe('configureReminder', () => {
    const mockRequest = { user: { id: 'user-3', role: UserRole.ELEVE } };
    const configureReminderDto: ConfigureReminderDto = { delay: ReminderDelay.ONE_HOUR };
    const reminderResult = { id: 'rule-1', eventId: 'evt-4', ownerId: 'user-3', delay: ReminderDelay.ONE_HOUR };

    it('calls service.configureReminder with correct arguments and returns the result', async () => {
      mockCalendarEventsService.configureReminder.mockResolvedValue(reminderResult);

      const result = await controller.configureReminder('evt-4', configureReminderDto, mockRequest, undefined);

      expect(mockCalendarEventsService.configureReminder).toHaveBeenCalledWith(
        'evt-4',
        configureReminderDto,
        'user-3',
        undefined,
      );
      expect(result).toEqual(reminderResult);
    });

    it('propagates correlationId to the service', async () => {
      const correlationId = 'corr-reminder-001';
      mockCalendarEventsService.configureReminder.mockResolvedValue(reminderResult);

      await controller.configureReminder('evt-4', configureReminderDto, mockRequest, correlationId);

      expect(mockCalendarEventsService.configureReminder).toHaveBeenCalledWith(
        'evt-4',
        configureReminderDto,
        'user-3',
        correlationId,
      );
    });

    it('extracts user.id from the request object', async () => {
      const teacherRequest = { user: { id: 'teacher-99', role: UserRole.FORMATEUR } };
      const oneDayReminderDto: ConfigureReminderDto = { delay: ReminderDelay.ONE_DAY };
      mockCalendarEventsService.configureReminder.mockResolvedValue({ delay: ReminderDelay.ONE_DAY });

      await controller.configureReminder('evt-4', oneDayReminderDto, teacherRequest, undefined);

      expect(mockCalendarEventsService.configureReminder).toHaveBeenCalledWith(
        'evt-4',
        oneDayReminderDto,
        'teacher-99',
        undefined,
      );
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // createVisibilityGrant
  // ──────────────────────────────────────────────────────────────────────────

  describe('createVisibilityGrant', () => {
    const mockRequest = { user: { id: 'rp-1', role: UserRole.RESPONSABLE_PEDAGOGIQUE } };
    const createVisibilityGrantDto: CreateVisibilityGrantDto = { granteeId: 'grantee-1' };
    const createdGrant = { id: 'grant-1', ownerId: 'owner-1', granteeId: 'grantee-1', grantedBy: 'rp-1' };

    it('calls service.createVisibilityGrant with correct arguments and returns the result', async () => {
      mockCalendarEventsService.createVisibilityGrant.mockResolvedValue(createdGrant);

      const result = await controller.createVisibilityGrant('owner-1', createVisibilityGrantDto, mockRequest, undefined);

      expect(mockCalendarEventsService.createVisibilityGrant).toHaveBeenCalledWith(
        'owner-1',
        createVisibilityGrantDto,
        'rp-1',
        UserRole.RESPONSABLE_PEDAGOGIQUE,
        undefined,
      );
      expect(result).toEqual(createdGrant);
    });

    it('propagates correlationId to the service', async () => {
      const correlationId = 'corr-grant-001';
      mockCalendarEventsService.createVisibilityGrant.mockResolvedValue(createdGrant);

      await controller.createVisibilityGrant('owner-1', createVisibilityGrantDto, mockRequest, correlationId);

      expect(mockCalendarEventsService.createVisibilityGrant).toHaveBeenCalledWith(
        'owner-1',
        createVisibilityGrantDto,
        'rp-1',
        UserRole.RESPONSABLE_PEDAGOGIQUE,
        correlationId,
      );
    });

    it('extracts user.id and user.role from the request object', async () => {
      const anotherRpRequest = { user: { id: 'rp-2', role: UserRole.RESPONSABLE_PEDAGOGIQUE } };
      mockCalendarEventsService.createVisibilityGrant.mockResolvedValue({ id: 'grant-2' });

      await controller.createVisibilityGrant('owner-2', createVisibilityGrantDto, anotherRpRequest, undefined);

      expect(mockCalendarEventsService.createVisibilityGrant).toHaveBeenCalledWith(
        'owner-2',
        createVisibilityGrantDto,
        'rp-2',
        UserRole.RESPONSABLE_PEDAGOGIQUE,
        undefined,
      );
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // revokeVisibilityGrant
  // ──────────────────────────────────────────────────────────────────────────

  describe('revokeVisibilityGrant', () => {
    const mockRequest = { user: { id: 'rp-1', role: UserRole.RESPONSABLE_PEDAGOGIQUE } };
    const revokeResult = { revoked: true };

    it('calls service.revokeVisibilityGrant with correct arguments and returns the result', async () => {
      mockCalendarEventsService.revokeVisibilityGrant.mockResolvedValue(revokeResult);

      const result = await controller.revokeVisibilityGrant('owner-1', 'grantee-1', mockRequest, undefined);

      expect(mockCalendarEventsService.revokeVisibilityGrant).toHaveBeenCalledWith(
        'owner-1',
        'grantee-1',
        UserRole.RESPONSABLE_PEDAGOGIQUE,
        undefined,
      );
      expect(result).toEqual(revokeResult);
    });

    it('propagates correlationId to the service', async () => {
      const correlationId = 'corr-revoke-001';
      mockCalendarEventsService.revokeVisibilityGrant.mockResolvedValue(revokeResult);

      await controller.revokeVisibilityGrant('owner-1', 'grantee-1', mockRequest, correlationId);

      expect(mockCalendarEventsService.revokeVisibilityGrant).toHaveBeenCalledWith(
        'owner-1',
        'grantee-1',
        UserRole.RESPONSABLE_PEDAGOGIQUE,
        correlationId,
      );
    });

    it('extracts user.role from the request object', async () => {
      const anotherRpRequest = { user: { id: 'rp-99', role: UserRole.RESPONSABLE_PEDAGOGIQUE } };
      mockCalendarEventsService.revokeVisibilityGrant.mockResolvedValue(revokeResult);

      await controller.revokeVisibilityGrant('owner-3', 'grantee-3', anotherRpRequest, undefined);

      expect(mockCalendarEventsService.revokeVisibilityGrant).toHaveBeenCalledWith(
        'owner-3',
        'grantee-3',
        UserRole.RESPONSABLE_PEDAGOGIQUE,
        undefined,
      );
    });
  });
});
