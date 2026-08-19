import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken, getDataSourceToken } from '@nestjs/typeorm';
import {
  ForbiddenException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { CalendarEventsService } from '../../../src/calendar-events/calendar-events.service';
import { CalendarEvent, EventType, CalendarEventStatus } from '../../../src/calendar-events/entities/calendar-event.entity';
import { EventInvitation, InvitationStatus } from '../../../src/calendar-events/entities/event-invitation.entity';
import { CancellationRequest, CancellationStatus } from '../../../src/calendar-events/entities/cancellation-request.entity';
import { ReminderRule, ReminderDelay } from '../../../src/calendar-events/entities/reminder-rule.entity';
import { CalendarVisibilityGrant } from '../../../src/calendar-events/entities/calendar-visibility-grant.entity';
import { EventsService } from '../../../src/events/events.service';
import { UserRole } from '../../../src/common/enums/user-role.enum';
import { AuthenticatedUser } from '../../../src/common/interfaces/authenticated-user.interface';

const mockEventRepo = {
  findOne: jest.fn(),
  find: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
  createQueryBuilder: jest.fn(),
};

const mockInvitationRepo = {
  findOne: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
};

const mockCancellationRepo = {
  findOne: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
};

const mockReminderRuleRepo = {
  findOne: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
  delete: jest.fn(),
};

const mockGrantRepo = {
  findOne: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
  remove: jest.fn(),
};

const mockEventsService = { publish: jest.fn() };

/**
 * The transaction manager exposes the same repositories used outside a
 * transaction, so the existing mocks can be reused inside `manager.getRepository(...)`.
 */
const mockManager = {
  getRepository: jest.fn((entity: unknown) => {
    if (entity === CalendarEvent) return mockEventRepo;
    if (entity === EventInvitation) return mockInvitationRepo;
    if (entity === CancellationRequest) return mockCancellationRepo;
    throw new Error(`Unexpected entity requested from transaction manager: ${entity}`);
  }),
};

const mockDataSource = {
  transaction: jest.fn(async (callback: (manager: unknown) => unknown) => callback(mockManager)),
};

describe('CalendarEventsService', () => {
  let service: CalendarEventsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CalendarEventsService,
        { provide: getRepositoryToken(CalendarEvent), useValue: mockEventRepo },
        { provide: getRepositoryToken(EventInvitation), useValue: mockInvitationRepo },
        { provide: getRepositoryToken(CancellationRequest), useValue: mockCancellationRepo },
        { provide: getRepositoryToken(ReminderRule), useValue: mockReminderRuleRepo },
        { provide: getRepositoryToken(CalendarVisibilityGrant), useValue: mockGrantRepo },
        { provide: getDataSourceToken(), useValue: mockDataSource },
        { provide: EventsService, useValue: mockEventsService },
      ],
    }).compile();

    service = module.get<CalendarEventsService>(CalendarEventsService);
    jest.clearAllMocks();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // listEvents
  // ──────────────────────────────────────────────────────────────────────────

  describe('listEvents', () => {
    function buildQueryBuilder(results: CalendarEvent[]) {
      return {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(results),
      };
    }

    it('returns events for the calendar owner', async () => {
      const calendarEvents = [{ id: 'evt-1', ownerId: 'user-1', eventType: EventType.COURS }] as CalendarEvent[];
      mockEventRepo.createQueryBuilder.mockReturnValue(buildQueryBuilder(calendarEvents));
      const actor: AuthenticatedUser = { id: 'user-1', role: UserRole.ELEVE };

      const results = await service.listEvents('user-1', actor, {});
      expect(results).toHaveLength(1);
    });

    it('allows RP to read any calendar (privileged role)', async () => {
      const calendarEvents = [{ id: 'evt-2', ownerId: 'user-2', eventType: EventType.COURS }] as CalendarEvent[];
      mockEventRepo.createQueryBuilder.mockReturnValue(buildQueryBuilder(calendarEvents));
      const actor: AuthenticatedUser = { id: 'rp-id', role: UserRole.RESPONSABLE_PEDAGOGIQUE };

      const results = await service.listEvents('user-2', actor, {});
      expect(results).toHaveLength(1);
    });

    it('allows access if a CalendarVisibilityGrant exists', async () => {
      mockGrantRepo.findOne.mockResolvedValue({ id: 'grant-1', ownerId: 'user-3', granteeId: 'other-user' });
      const calendarEvents = [{ id: 'evt-3', ownerId: 'user-3', eventType: EventType.COURS }] as CalendarEvent[];
      mockEventRepo.createQueryBuilder.mockReturnValue(buildQueryBuilder(calendarEvents));
      const actor: AuthenticatedUser = { id: 'other-user', role: UserRole.FORMATEUR };

      const results = await service.listEvents('user-3', actor, {});
      expect(results).toHaveLength(1);
    });

    it('throws ForbiddenException when no access and no grant', async () => {
      mockGrantRepo.findOne.mockResolvedValue(null);
      const actor: AuthenticatedUser = { id: 'stranger-id', role: UserRole.FORMATEUR };

      await expect(service.listEvents('owner-id', actor, {})).rejects.toThrow(ForbiddenException);
    });

    it('PARENT_FINANCEUR can access calendar events (filtered to FINANCIER by service)', async () => {
      const financialEvents = [{ id: 'evt-f', ownerId: 'parent-1', eventType: EventType.FINANCIER }] as CalendarEvent[];
      mockEventRepo.createQueryBuilder.mockReturnValue(buildQueryBuilder(financialEvents));
      const actor: AuthenticatedUser = { id: 'parent-1', role: UserRole.PARENT_FINANCEUR };

      const results = await service.listEvents('some-owner', actor, {});
      expect(results).toHaveLength(1);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // createEvent
  // ──────────────────────────────────────────────────────────────────────────

  describe('createEvent', () => {
    const validDto = {
      title: 'Cours de maths',
      eventType: EventType.COURS,
      startAt: '2026-07-01T10:00:00Z',
      endAt: '2026-07-01T11:00:00Z',
    };

    it('FORMATEUR can create a COURS event', async () => {
      const savedEvent = { id: 'evt-1', ...validDto, ownerId: 'teacher-1', creatorId: 'teacher-1', invitations: [] } as unknown as CalendarEvent;
      mockEventRepo.create.mockReturnValue(savedEvent);
      mockEventRepo.save.mockResolvedValue(savedEvent);
      mockEventRepo.findOne.mockResolvedValue(savedEvent);
      const actor: AuthenticatedUser = { id: 'teacher-1', role: UserRole.FORMATEUR };

      const result = await service.createEvent('teacher-1', validDto, actor);
      expect(result.id).toBe('evt-1');
      expect(mockDataSource.transaction).toHaveBeenCalledTimes(1);
      expect(mockEventsService.publish).toHaveBeenCalledWith(
        'CalendarEventCreated',
        expect.objectContaining({ eventId: 'evt-1', ownerId: 'teacher-1' }),
        undefined,
      );
    });

    it('ELEVE can create a RAPPEL event', async () => {
      const dto = { ...validDto, eventType: EventType.RAPPEL };
      const savedEvent = { id: 'evt-2', ...dto, ownerId: 'student-1', creatorId: 'student-1', invitations: [] } as unknown as CalendarEvent;
      mockEventRepo.create.mockReturnValue(savedEvent);
      mockEventRepo.save.mockResolvedValue(savedEvent);
      mockEventRepo.findOne.mockResolvedValue(savedEvent);
      const actor: AuthenticatedUser = { id: 'student-1', role: UserRole.ELEVE };

      const result = await service.createEvent('student-1', dto, actor);
      expect(result.id).toBe('evt-2');
    });

    it('throws ForbiddenException when ELEVE tries to create a COURS event', async () => {
      const actor: AuthenticatedUser = { id: 'student-1', role: UserRole.ELEVE };
      await expect(service.createEvent('student-1', validDto, actor)).rejects.toThrow(ForbiddenException);
      expect(mockDataSource.transaction).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when PARENT_FINANCEUR tries to create any event', async () => {
      const actor: AuthenticatedUser = { id: 'parent-1', role: UserRole.PARENT_FINANCEUR };
      await expect(service.createEvent('parent-1', validDto, actor)).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when ADMINISTRATEUR_FINANCIER tries to create any event', async () => {
      const actor: AuthenticatedUser = { id: 'af-1', role: UserRole.ADMINISTRATEUR_FINANCIER };
      await expect(service.createEvent('af-1', validDto, actor)).rejects.toThrow(ForbiddenException);
    });

    it('RP can create any event type', async () => {
      const financierDto = { ...validDto, eventType: EventType.FINANCIER };
      const savedEvent = { id: 'evt-3', ...financierDto, ownerId: 'rp-1', creatorId: 'rp-1', invitations: [] } as unknown as CalendarEvent;
      mockEventRepo.create.mockReturnValue(savedEvent);
      mockEventRepo.save.mockResolvedValue(savedEvent);
      mockEventRepo.findOne.mockResolvedValue(savedEvent);
      const actor: AuthenticatedUser = { id: 'rp-1', role: UserRole.RESPONSABLE_PEDAGOGIQUE };

      const result = await service.createEvent('rp-1', financierDto, actor);
      expect(result.id).toBe('evt-3');
    });

    it('creates invitations when inviteeIds are provided', async () => {
      const dtoWithInvitees = { ...validDto, inviteeIds: ['invitee-1', 'invitee-2'] };
      const savedEvent = { id: 'evt-4', ...dtoWithInvitees, ownerId: 'teacher-1', creatorId: 'teacher-1', invitations: [] } as unknown as CalendarEvent;
      mockEventRepo.create.mockReturnValue(savedEvent);
      mockEventRepo.save.mockResolvedValue(savedEvent);
      mockEventRepo.findOne.mockResolvedValue(savedEvent);
      mockInvitationRepo.create.mockImplementation((dto) => dto);
      mockInvitationRepo.save.mockResolvedValue([]);
      const actor: AuthenticatedUser = { id: 'teacher-1', role: UserRole.FORMATEUR };

      await service.createEvent('teacher-1', dtoWithInvitees, actor);
      expect(mockInvitationRepo.create).toHaveBeenCalledTimes(2);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // acceptInvitation
  // ──────────────────────────────────────────────────────────────────────────

  describe('acceptInvitation', () => {
    it('accepts a pending invitation and publishes InvitationAccepted', async () => {
      const pendingInvitation = { id: 'inv-1', eventId: 'evt-1', inviteeId: 'user-1', status: InvitationStatus.PENDING } as EventInvitation;
      mockInvitationRepo.findOne.mockResolvedValue(pendingInvitation);
      mockInvitationRepo.save.mockResolvedValue({ ...pendingInvitation, status: InvitationStatus.ACCEPTED });
      const actor: AuthenticatedUser = { id: 'user-1', role: UserRole.ELEVE };

      const result = await service.acceptInvitation('evt-1', 'user-1', actor);
      expect(result.status).toBe(InvitationStatus.ACCEPTED);
      expect(mockEventsService.publish).toHaveBeenCalledWith(
        'InvitationAccepted',
        expect.objectContaining({ eventId: 'evt-1', userId: 'user-1' }),
        undefined,
      );
    });

    it('throws ForbiddenException when actor is not the invitee', async () => {
      const actor: AuthenticatedUser = { id: 'someone-else', role: UserRole.ELEVE };
      await expect(service.acceptInvitation('evt-1', 'user-1', actor)).rejects.toThrow(ForbiddenException);
      expect(mockInvitationRepo.findOne).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when invitation does not exist', async () => {
      mockInvitationRepo.findOne.mockResolvedValue(null);
      const actor: AuthenticatedUser = { id: 'user-1', role: UserRole.ELEVE };

      await expect(service.acceptInvitation('evt-unknown', 'user-1', actor)).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException when invitation is already accepted', async () => {
      const acceptedInvitation = { id: 'inv-2', eventId: 'evt-1', inviteeId: 'user-1', status: InvitationStatus.ACCEPTED } as EventInvitation;
      mockInvitationRepo.findOne.mockResolvedValue(acceptedInvitation);
      const actor: AuthenticatedUser = { id: 'user-1', role: UserRole.ELEVE };

      await expect(service.acceptInvitation('evt-1', 'user-1', actor)).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException when invitation is already declined', async () => {
      const declinedInvitation = { id: 'inv-3', eventId: 'evt-1', inviteeId: 'user-1', status: InvitationStatus.DECLINED } as EventInvitation;
      mockInvitationRepo.findOne.mockResolvedValue(declinedInvitation);
      const actor: AuthenticatedUser = { id: 'user-1', role: UserRole.ELEVE };

      await expect(service.acceptInvitation('evt-1', 'user-1', actor)).rejects.toThrow(ConflictException);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // declineInvitation
  // ──────────────────────────────────────────────────────────────────────────

  describe('declineInvitation', () => {
    it('declines a pending invitation and publishes InvitationDeclined', async () => {
      const pendingInvitation = { id: 'inv-1', eventId: 'evt-1', inviteeId: 'user-1', status: InvitationStatus.PENDING } as EventInvitation;
      mockInvitationRepo.findOne.mockResolvedValue(pendingInvitation);
      mockInvitationRepo.save.mockResolvedValue({ ...pendingInvitation, status: InvitationStatus.DECLINED });
      const actor: AuthenticatedUser = { id: 'user-1', role: UserRole.ELEVE };

      const result = await service.declineInvitation('evt-1', 'user-1', actor);
      expect(result.status).toBe(InvitationStatus.DECLINED);
      expect(mockEventsService.publish).toHaveBeenCalledWith(
        'InvitationDeclined',
        expect.objectContaining({ eventId: 'evt-1', userId: 'user-1' }),
        undefined,
      );
    });

    it('throws ForbiddenException when actor is not the invitee', async () => {
      const actor: AuthenticatedUser = { id: 'someone-else', role: UserRole.ELEVE };
      await expect(service.declineInvitation('evt-1', 'user-1', actor)).rejects.toThrow(ForbiddenException);
      expect(mockInvitationRepo.findOne).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when invitation does not exist', async () => {
      mockInvitationRepo.findOne.mockResolvedValue(null);
      const actor: AuthenticatedUser = { id: 'user-1', role: UserRole.ELEVE };
      await expect(service.declineInvitation('evt-unknown', 'user-1', actor)).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException when invitation is already processed', async () => {
      const acceptedInvitation = { id: 'inv-2', eventId: 'evt-1', inviteeId: 'user-1', status: InvitationStatus.ACCEPTED } as EventInvitation;
      mockInvitationRepo.findOne.mockResolvedValue(acceptedInvitation);
      const actor: AuthenticatedUser = { id: 'user-1', role: UserRole.ELEVE };

      await expect(service.declineInvitation('evt-1', 'user-1', actor)).rejects.toThrow(ConflictException);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // requestCancellation
  // ──────────────────────────────────────────────────────────────────────────

  describe('requestCancellation', () => {
    it('auto-approves cancellation when event is more than 48h away', async () => {
      const futureDate = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72h from now
      const calendarEvent = {
        id: 'evt-1',
        creatorId: 'teacher-1',
        startTime: futureDate,
        status: CalendarEventStatus.ACTIVE,
      } as CalendarEvent;

      mockEventRepo.findOne.mockResolvedValue(calendarEvent);
      const savedRequest = {
        id: 'req-1',
        eventId: 'evt-1',
        requesterId: 'teacher-1',
        status: CancellationStatus.APPROVED,
      } as CancellationRequest;
      mockCancellationRepo.create.mockReturnValue(savedRequest);
      mockCancellationRepo.save.mockResolvedValue(savedRequest);
      mockEventRepo.save.mockResolvedValue({ ...calendarEvent, status: CalendarEventStatus.CANCELLED });
      const actor: AuthenticatedUser = { id: 'teacher-1', role: UserRole.FORMATEUR };

      const result = await service.requestCancellation('evt-1', {}, actor);
      expect(result.status).toBe(CancellationStatus.APPROVED);
      expect(mockDataSource.transaction).toHaveBeenCalledTimes(1);
      expect(mockEventRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: CalendarEventStatus.CANCELLED }),
      );
      expect(mockEventsService.publish).toHaveBeenCalledWith(
        'CancellationRequested',
        expect.objectContaining({ status: CancellationStatus.APPROVED, isWithin48Hours: false }),
        undefined,
      );
    });

    it('sets PENDING_APPROVAL when event is within 48h', async () => {
      const nearFutureDate = new Date(Date.now() + 12 * 60 * 60 * 1000); // 12h from now
      const calendarEvent = {
        id: 'evt-2',
        creatorId: 'teacher-1',
        startTime: nearFutureDate,
        status: CalendarEventStatus.ACTIVE,
      } as CalendarEvent;

      mockEventRepo.findOne.mockResolvedValue(calendarEvent);
      const savedRequest = {
        id: 'req-2',
        eventId: 'evt-2',
        requesterId: 'teacher-1',
        status: CancellationStatus.PENDING_APPROVAL,
      } as CancellationRequest;
      mockCancellationRepo.create.mockReturnValue(savedRequest);
      mockCancellationRepo.save.mockResolvedValue(savedRequest);
      const actor: AuthenticatedUser = { id: 'teacher-1', role: UserRole.FORMATEUR };

      const result = await service.requestCancellation('evt-2', {}, actor);
      expect(result.status).toBe(CancellationStatus.PENDING_APPROVAL);
      // Event should NOT be auto-cancelled
      expect(mockEventRepo.save).not.toHaveBeenCalled();
    });

    it('allows RP to cancel any event (privileged role)', async () => {
      const futureDate = new Date(Date.now() + 72 * 60 * 60 * 1000);
      const calendarEvent = {
        id: 'evt-3',
        creatorId: 'teacher-1',
        startTime: futureDate,
        status: CalendarEventStatus.ACTIVE,
      } as CalendarEvent;

      mockEventRepo.findOne.mockResolvedValue(calendarEvent);
      const savedRequest = {
        id: 'req-3',
        eventId: 'evt-3',
        requesterId: 'rp-1',
        status: CancellationStatus.APPROVED,
      } as CancellationRequest;
      mockCancellationRepo.create.mockReturnValue(savedRequest);
      mockCancellationRepo.save.mockResolvedValue(savedRequest);
      mockEventRepo.save.mockResolvedValue({ ...calendarEvent, status: CalendarEventStatus.CANCELLED });
      const actor: AuthenticatedUser = { id: 'rp-1', role: UserRole.RESPONSABLE_PEDAGOGIQUE };

      await expect(service.requestCancellation('evt-3', {}, actor)).resolves.toBeDefined();
    });

    it('throws ForbiddenException when non-creator tries to cancel (CAL-FB-001)', async () => {
      const calendarEvent = {
        id: 'evt-4',
        creatorId: 'teacher-1',
        startTime: new Date(Date.now() + 72 * 60 * 60 * 1000),
        status: CalendarEventStatus.ACTIVE,
      } as CalendarEvent;
      mockEventRepo.findOne.mockResolvedValue(calendarEvent);
      const actor: AuthenticatedUser = { id: 'other-user', role: UserRole.ELEVE };

      await expect(service.requestCancellation('evt-4', {}, actor)).rejects.toThrow(ForbiddenException);
      expect(mockDataSource.transaction).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when event does not exist', async () => {
      mockEventRepo.findOne.mockResolvedValue(null);
      const actor: AuthenticatedUser = { id: 'teacher-1', role: UserRole.FORMATEUR };
      await expect(service.requestCancellation('unknown-evt', {}, actor)).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException when event is already cancelled', async () => {
      const calendarEvent = {
        id: 'evt-5',
        creatorId: 'teacher-1',
        startTime: new Date(Date.now() + 72 * 60 * 60 * 1000),
        status: CalendarEventStatus.CANCELLED,
      } as CalendarEvent;
      mockEventRepo.findOne.mockResolvedValue(calendarEvent);
      const actor: AuthenticatedUser = { id: 'teacher-1', role: UserRole.FORMATEUR };

      await expect(service.requestCancellation('evt-5', {}, actor)).rejects.toThrow(ConflictException);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // configureReminder
  // ──────────────────────────────────────────────────────────────────────────

  describe('configureReminder', () => {
    it('creates a reminder rule for the event organizer', async () => {
      const calendarEvent = { id: 'evt-1', creatorId: 'user-1' } as CalendarEvent;
      mockEventRepo.findOne.mockResolvedValue(calendarEvent);
      mockReminderRuleRepo.delete.mockResolvedValue({});
      const savedRule = { id: 'rule-1', eventId: 'evt-1', ownerId: 'user-1', delay: ReminderDelay.ONE_HOUR } as ReminderRule;
      mockReminderRuleRepo.create.mockReturnValue(savedRule);
      mockReminderRuleRepo.save.mockResolvedValue(savedRule);
      const actor: AuthenticatedUser = { id: 'user-1', role: UserRole.FORMATEUR };

      const result = await service.configureReminder('evt-1', { delay: ReminderDelay.ONE_HOUR }, actor);
      expect(result.delay).toBe(ReminderDelay.ONE_HOUR);
    });

    it('creates a reminder rule for an accepted invitee', async () => {
      const calendarEvent = { id: 'evt-1', creatorId: 'organizer-1' } as CalendarEvent;
      mockEventRepo.findOne.mockResolvedValue(calendarEvent);
      mockInvitationRepo.findOne.mockResolvedValue({ inviteeId: 'user-1', status: InvitationStatus.ACCEPTED });
      mockReminderRuleRepo.delete.mockResolvedValue({});
      const savedRule = { id: 'rule-1', eventId: 'evt-1', ownerId: 'user-1', delay: ReminderDelay.ONE_HOUR } as ReminderRule;
      mockReminderRuleRepo.create.mockReturnValue(savedRule);
      mockReminderRuleRepo.save.mockResolvedValue(savedRule);
      const actor: AuthenticatedUser = { id: 'user-1', role: UserRole.ELEVE };

      const result = await service.configureReminder('evt-1', { delay: ReminderDelay.ONE_HOUR }, actor);
      expect(result.delay).toBe(ReminderDelay.ONE_HOUR);
    });

    it('allows a privileged internal role (RP) to configure a reminder on any event', async () => {
      const calendarEvent = { id: 'evt-1', creatorId: 'organizer-1' } as CalendarEvent;
      mockEventRepo.findOne.mockResolvedValue(calendarEvent);
      mockReminderRuleRepo.delete.mockResolvedValue({});
      const savedRule = { id: 'rule-1', eventId: 'evt-1', ownerId: 'rp-1', delay: ReminderDelay.ONE_DAY } as ReminderRule;
      mockReminderRuleRepo.create.mockReturnValue(savedRule);
      mockReminderRuleRepo.save.mockResolvedValue(savedRule);
      const actor: AuthenticatedUser = { id: 'rp-1', role: UserRole.RESPONSABLE_PEDAGOGIQUE };

      const result = await service.configureReminder('evt-1', { delay: ReminderDelay.ONE_DAY }, actor);
      expect(result.delay).toBe(ReminderDelay.ONE_DAY);
    });

    it('throws ForbiddenException when user has no access to the event', async () => {
      const calendarEvent = { id: 'evt-1', creatorId: 'organizer-1' } as CalendarEvent;
      mockEventRepo.findOne.mockResolvedValue(calendarEvent);
      mockInvitationRepo.findOne.mockResolvedValue(null);
      const actor: AuthenticatedUser = { id: 'unrelated-user', role: UserRole.ELEVE };

      await expect(
        service.configureReminder('evt-1', { delay: ReminderDelay.ONE_HOUR }, actor),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when invitee has declined the invitation', async () => {
      const calendarEvent = { id: 'evt-1', creatorId: 'organizer-1' } as CalendarEvent;
      mockEventRepo.findOne.mockResolvedValue(calendarEvent);
      mockInvitationRepo.findOne.mockResolvedValue({ inviteeId: 'user-1', status: InvitationStatus.DECLINED });
      const actor: AuthenticatedUser = { id: 'user-1', role: UserRole.ELEVE };

      await expect(
        service.configureReminder('evt-1', { delay: ReminderDelay.ONE_HOUR }, actor),
      ).rejects.toThrow(ForbiddenException);
    });

    it('deletes reminder rule when delay is "none" (organizer)', async () => {
      const calendarEvent = { id: 'evt-1', creatorId: 'user-1' } as CalendarEvent;
      mockEventRepo.findOne.mockResolvedValue(calendarEvent);
      mockReminderRuleRepo.delete.mockResolvedValue({});
      const actor: AuthenticatedUser = { id: 'user-1', role: UserRole.ELEVE };

      const result = await service.configureReminder('evt-1', { delay: ReminderDelay.NONE }, actor);
      expect(result.delay).toBe(ReminderDelay.NONE);
      expect(mockReminderRuleRepo.save).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when event does not exist', async () => {
      mockEventRepo.findOne.mockResolvedValue(null);
      const actor: AuthenticatedUser = { id: 'user-1', role: UserRole.FORMATEUR };
      await expect(
        service.configureReminder('unknown-evt', { delay: ReminderDelay.ONE_DAY }, actor),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // createVisibilityGrant
  // ──────────────────────────────────────────────────────────────────────────

  describe('createVisibilityGrant', () => {
    it('RP can create a visibility grant', async () => {
      mockGrantRepo.findOne.mockResolvedValue(null);
      const savedGrant = { id: 'grant-1', ownerId: 'user-1', granteeId: 'user-2', grantedBy: 'rp-1' } as CalendarVisibilityGrant;
      mockGrantRepo.create.mockReturnValue(savedGrant);
      mockGrantRepo.save.mockResolvedValue(savedGrant);
      const actor: AuthenticatedUser = { id: 'rp-1', role: UserRole.RESPONSABLE_PEDAGOGIQUE };

      const result = await service.createVisibilityGrant('user-1', { granteeId: 'user-2' }, actor);
      expect(result.id).toBe('grant-1');
    });

    it('returns existing grant instead of creating duplicate', async () => {
      const existingGrant = { id: 'grant-1', ownerId: 'user-1', granteeId: 'user-2', grantedBy: 'rp-1' } as CalendarVisibilityGrant;
      mockGrantRepo.findOne.mockResolvedValue(existingGrant);
      const actor: AuthenticatedUser = { id: 'rp-1', role: UserRole.RESPONSABLE_PEDAGOGIQUE };

      const result = await service.createVisibilityGrant('user-1', { granteeId: 'user-2' }, actor);
      expect(result.id).toBe('grant-1');
      expect(mockGrantRepo.save).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when non-RP tries to create a grant', async () => {
      const actor: AuthenticatedUser = { id: 'teacher-1', role: UserRole.FORMATEUR };
      await expect(
        service.createVisibilityGrant('user-1', { granteeId: 'user-2' }, actor),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // revokeVisibilityGrant
  // ──────────────────────────────────────────────────────────────────────────

  describe('revokeVisibilityGrant', () => {
    it('RP can revoke a visibility grant', async () => {
      const existingGrant = { id: 'grant-1', ownerId: 'user-1', granteeId: 'user-2' } as CalendarVisibilityGrant;
      mockGrantRepo.findOne.mockResolvedValue(existingGrant);
      mockGrantRepo.remove.mockResolvedValue(existingGrant);

      const result = await service.revokeVisibilityGrant('user-1', 'user-2', UserRole.RESPONSABLE_PEDAGOGIQUE);
      expect(result).toEqual({ revoked: true });
    });

    it('throws ForbiddenException when non-RP tries to revoke a grant', async () => {
      await expect(
        service.revokeVisibilityGrant('user-1', 'user-2', UserRole.FORMATEUR),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when grant does not exist', async () => {
      mockGrantRepo.findOne.mockResolvedValue(null);
      await expect(
        service.revokeVisibilityGrant('user-1', 'user-2', UserRole.RESPONSABLE_PEDAGOGIQUE),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
