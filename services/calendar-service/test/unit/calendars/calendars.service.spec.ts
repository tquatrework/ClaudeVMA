import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken, getDataSourceToken } from '@nestjs/typeorm';
import {
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { CalendarsService } from '../../../src/calendars/calendars.service';
import { Calendar } from '../../../src/calendars/entities/calendar.entity';
import {
  AvailabilitySlot,
  SlotRecurrence,
  SlotKind,
} from '../../../src/calendars/entities/availability-slot.entity';
import { PaymentScheduleEntry } from '../../../src/calendars/entities/payment-schedule-entry.entity';
import { EventsService } from '../../../src/events/events.service';
import { ActivitiesService } from '../../../src/activities/activities.service';
import {
  ProfileRelationsClient,
  ProfileRelationsUnavailableError,
} from '../../../src/common/clients/profile-relations.client';
import {
  IdentityAccessClient,
  IdentityAccessUnavailableError,
} from '../../../src/common/clients/identity-access.client';
import { RelationKind } from '../../../src/common/relations/relation-kind';
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

const mockActivitiesService = {
  findActiveInRange: jest.fn(),
};

const mockProfileRelationsClient = {
  resolveRelations: jest.fn(),
};

const mockIdentityAccessClient = {
  resolveRole: jest.fn(),
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
        { provide: ActivitiesService, useValue: mockActivitiesService },
        { provide: ProfileRelationsClient, useValue: mockProfileRelationsClient },
        { provide: IdentityAccessClient, useValue: mockIdentityAccessClient },
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

  // --- getCalendar: bug AP corrigé (2026-08-18, point 2) ---

  describe('getCalendar — AP no longer has full read access (bug fix)', () => {
    it('throws ForbiddenException when AP reads another user calendar without a link', async () => {
      const actor: AuthenticatedUser = { id: 'ap-id', role: UserRole.ANIMATEUR_PEDAGOGIQUE };
      await expect(service.getCalendar('teacher-1', actor)).rejects.toThrow(ForbiddenException);
    });
  });

  // --- getBusyFree ---

  describe('getBusyFree', () => {
    const from = new Date('2026-09-10T00:00:00Z');
    const to = new Date('2026-09-17T00:00:00Z');

    function slot(overrides: Record<string, unknown> = {}) {
      return {
        id: 'slot-1',
        startTime: new Date('2026-09-10T09:00:00Z'),
        endTime: new Date('2026-09-10T11:00:00Z'),
        recurrence: SlotRecurrence.NONE,
        recurrenceEndDate: null,
        kind: SlotKind.AVAILABLE,
        ...overrides,
      };
    }

    beforeEach(() => {
      mockActivitiesService.findActiveInRange.mockResolvedValue([]);
      // Par défaut, rôle inconnu (comportement `IdentityAccessClient` réel
      // sur un compte introuvable) — chaque test qui a besoin d'un
      // `ownerRole` précis le déclare explicitement ci-dessous.
      mockIdentityAccessClient.resolveRole.mockResolvedValue(undefined);
    });

    it('rejects to <= from with BadRequestException, before any lookup', async () => {
      const actor: AuthenticatedUser = { id: 'someone', role: UserRole.RESPONSABLE_PEDAGOGIQUE };
      await expect(service.getBusyFree('student-1', actor, to, from)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockCalendarRepo.findOne).not.toHaveBeenCalled();
    });

    it('grants the owner full access without calling profile-service', async () => {
      mockCalendarRepo.findOne.mockResolvedValue({
        ownerId: 'student-1',
        ownerRole: UserRole.ELEVE,
        availabilitySlots: [slot()],
      });
      const actor: AuthenticatedUser = { id: 'student-1', role: UserRole.ELEVE };

      const result = await service.getBusyFree('student-1', actor, from, to);

      expect(mockProfileRelationsClient.resolveRelations).not.toHaveBeenCalled();
      expect(mockIdentityAccessClient.resolveRole).not.toHaveBeenCalled();
      expect(result.ownerId).toBe('student-1');
      expect(result.availableWindows).toHaveLength(1);
    });

    it('grants RP access to a student calendar without any relation', async () => {
      mockCalendarRepo.findOne.mockResolvedValue({
        ownerId: 'student-1',
        ownerRole: UserRole.ELEVE,
        availabilitySlots: [slot()],
      });
      mockIdentityAccessClient.resolveRole.mockResolvedValue(UserRole.ELEVE);
      mockProfileRelationsClient.resolveRelations.mockResolvedValue({
        viewerId: 'rp-id',
        targetId: 'student-1',
        isSelf: false,
        isAdministrator: true,
        relations: [],
      });
      const actor: AuthenticatedUser = { id: 'rp-id', role: UserRole.RESPONSABLE_PEDAGOGIQUE };

      await expect(service.getBusyFree('student-1', actor, from, to)).resolves.toBeDefined();
    });

    it('grants RP access to a teacher calendar without any relation', async () => {
      mockCalendarRepo.findOne.mockResolvedValue({
        ownerId: 'teacher-1',
        ownerRole: UserRole.FORMATEUR,
        availabilitySlots: [],
      });
      mockIdentityAccessClient.resolveRole.mockResolvedValue(UserRole.FORMATEUR);
      mockProfileRelationsClient.resolveRelations.mockResolvedValue({
        viewerId: 'rp-id',
        targetId: 'teacher-1',
        isSelf: false,
        isAdministrator: true,
        relations: [],
      });
      const actor: AuthenticatedUser = { id: 'rp-id', role: UserRole.RESPONSABLE_PEDAGOGIQUE };

      await expect(service.getBusyFree('teacher-1', actor, from, to)).resolves.toBeDefined();
    });

    it('denies AF on a student calendar without a relation (RP-only admin scope)', async () => {
      mockCalendarRepo.findOne.mockResolvedValue({
        ownerId: 'student-1',
        ownerRole: UserRole.ELEVE,
        availabilitySlots: [],
      });
      mockIdentityAccessClient.resolveRole.mockResolvedValue(UserRole.ELEVE);
      mockProfileRelationsClient.resolveRelations.mockResolvedValue({
        viewerId: 'af-id',
        targetId: 'student-1',
        isSelf: false,
        isAdministrator: true,
        relations: [],
      });
      const actor: AuthenticatedUser = { id: 'af-id', role: UserRole.ADMINISTRATEUR_FINANCIER };

      await expect(service.getBusyFree('student-1', actor, from, to)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('denies TI on a student calendar without a relation (RP-only admin scope)', async () => {
      mockCalendarRepo.findOne.mockResolvedValue({
        ownerId: 'student-1',
        ownerRole: UserRole.ELEVE,
        availabilitySlots: [],
      });
      mockIdentityAccessClient.resolveRole.mockResolvedValue(UserRole.ELEVE);
      mockProfileRelationsClient.resolveRelations.mockResolvedValue({
        viewerId: 'ti-id',
        targetId: 'student-1',
        isSelf: false,
        isAdministrator: true,
        relations: [],
      });
      const actor: AuthenticatedUser = { id: 'ti-id', role: UserRole.TECHNICIEN_INFORMATIQUE };

      await expect(service.getBusyFree('student-1', actor, from, to)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('grants a parent financeur access to their student (FINANCE_OWNER_OF_STUDENT)', async () => {
      mockCalendarRepo.findOne.mockResolvedValue({
        ownerId: 'student-1',
        ownerRole: UserRole.ELEVE,
        availabilitySlots: [],
      });
      mockIdentityAccessClient.resolveRole.mockResolvedValue(UserRole.ELEVE);
      mockProfileRelationsClient.resolveRelations.mockResolvedValue({
        viewerId: 'parent-1',
        targetId: 'student-1',
        isSelf: false,
        isAdministrator: false,
        relations: [{ kind: RelationKind.FINANCE_OWNER_OF_STUDENT }],
      });
      const actor: AuthenticatedUser = { id: 'parent-1', role: UserRole.PARENT_FINANCEUR };

      await expect(service.getBusyFree('student-1', actor, from, to)).resolves.toBeDefined();
    });

    it('grants an active teacher access to their student (TEACHER_OF_STUDENT)', async () => {
      mockCalendarRepo.findOne.mockResolvedValue({
        ownerId: 'student-1',
        ownerRole: UserRole.ELEVE,
        availabilitySlots: [],
      });
      mockIdentityAccessClient.resolveRole.mockResolvedValue(UserRole.ELEVE);
      mockProfileRelationsClient.resolveRelations.mockResolvedValue({
        viewerId: 'teacher-1',
        targetId: 'student-1',
        isSelf: false,
        isAdministrator: false,
        relations: [{ kind: RelationKind.TEACHER_OF_STUDENT }],
      });
      const actor: AuthenticatedUser = { id: 'teacher-1', role: UserRole.FORMATEUR };

      await expect(service.getBusyFree('student-1', actor, from, to)).resolves.toBeDefined();
    });

    it('denies an unlinked teacher access to a student calendar', async () => {
      mockCalendarRepo.findOne.mockResolvedValue({
        ownerId: 'student-1',
        ownerRole: UserRole.ELEVE,
        availabilitySlots: [],
      });
      mockIdentityAccessClient.resolveRole.mockResolvedValue(UserRole.ELEVE);
      mockProfileRelationsClient.resolveRelations.mockResolvedValue({
        viewerId: 'teacher-2',
        targetId: 'student-1',
        isSelf: false,
        isAdministrator: false,
        relations: [],
      });
      const actor: AuthenticatedUser = { id: 'teacher-2', role: UserRole.FORMATEUR };

      await expect(service.getBusyFree('student-1', actor, from, to)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('grants a linked student access to their teacher (STUDENT_OF_TEACHER)', async () => {
      mockCalendarRepo.findOne.mockResolvedValue({
        ownerId: 'teacher-1',
        ownerRole: UserRole.FORMATEUR,
        availabilitySlots: [],
      });
      mockIdentityAccessClient.resolveRole.mockResolvedValue(UserRole.FORMATEUR);
      mockProfileRelationsClient.resolveRelations.mockResolvedValue({
        viewerId: 'student-1',
        targetId: 'teacher-1',
        isSelf: false,
        isAdministrator: false,
        relations: [{ kind: RelationKind.STUDENT_OF_TEACHER }],
      });
      const actor: AuthenticatedUser = { id: 'student-1', role: UserRole.ELEVE };

      await expect(service.getBusyFree('teacher-1', actor, from, to)).resolves.toBeDefined();
    });

    it('grants an indirect parent access to their student’s teacher (FINANCE_OWNER_OF_STUDENT_OF_TEACHER)', async () => {
      mockCalendarRepo.findOne.mockResolvedValue({
        ownerId: 'teacher-1',
        ownerRole: UserRole.FORMATEUR,
        availabilitySlots: [],
      });
      mockIdentityAccessClient.resolveRole.mockResolvedValue(UserRole.FORMATEUR);
      mockProfileRelationsClient.resolveRelations.mockResolvedValue({
        viewerId: 'parent-1',
        targetId: 'teacher-1',
        isSelf: false,
        isAdministrator: false,
        relations: [{ kind: RelationKind.FINANCE_OWNER_OF_STUDENT_OF_TEACHER, throughUserIds: ['student-1'] }],
      });
      const actor: AuthenticatedUser = { id: 'parent-1', role: UserRole.PARENT_FINANCEUR };

      await expect(service.getBusyFree('teacher-1', actor, from, to)).resolves.toBeDefined();
    });

    it('grants a linked AP access to a teacher they animate (ANIMATOR_OF_TEACHER)', async () => {
      mockCalendarRepo.findOne.mockResolvedValue({
        ownerId: 'teacher-1',
        ownerRole: UserRole.FORMATEUR,
        availabilitySlots: [],
      });
      mockIdentityAccessClient.resolveRole.mockResolvedValue(UserRole.FORMATEUR);
      mockProfileRelationsClient.resolveRelations.mockResolvedValue({
        viewerId: 'ap-id',
        targetId: 'teacher-1',
        isSelf: false,
        isAdministrator: false,
        relations: [{ kind: RelationKind.ANIMATOR_OF_TEACHER }],
      });
      const actor: AuthenticatedUser = { id: 'ap-id', role: UserRole.ANIMATEUR_PEDAGOGIQUE };

      await expect(service.getBusyFree('teacher-1', actor, from, to)).resolves.toBeDefined();
    });

    it('denies an unlinked AP access to a teacher calendar (bug fix: no more free pass)', async () => {
      mockCalendarRepo.findOne.mockResolvedValue({
        ownerId: 'teacher-1',
        ownerRole: UserRole.FORMATEUR,
        availabilitySlots: [],
      });
      mockIdentityAccessClient.resolveRole.mockResolvedValue(UserRole.FORMATEUR);
      mockProfileRelationsClient.resolveRelations.mockResolvedValue({
        viewerId: 'ap-id',
        targetId: 'teacher-1',
        isSelf: false,
        isAdministrator: false,
        relations: [],
      });
      const actor: AuthenticatedUser = { id: 'ap-id', role: UserRole.ANIMATEUR_PEDAGOGIQUE };

      await expect(service.getBusyFree('teacher-1', actor, from, to)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('denies access when identity-access-service does not know the owner account (unresolved role, fail closed)', async () => {
      // La ligne Calendar peut très bien exister (créneaux déjà créés) : ce
      // qui compte ici, c'est l'absence de rôle résolu côté
      // identity-access-service (compte inconnu, 404 → `undefined`) —
      // indépendant de l'existence de la ligne Calendar depuis le correctif
      // CAL-FB-004.
      mockCalendarRepo.findOne.mockResolvedValue(null);
      mockIdentityAccessClient.resolveRole.mockResolvedValue(undefined);
      mockProfileRelationsClient.resolveRelations.mockResolvedValue({
        viewerId: 'teacher-1',
        targetId: 'student-1',
        isSelf: false,
        isAdministrator: false,
        relations: [{ kind: RelationKind.TEACHER_OF_STUDENT }],
      });
      const actor: AuthenticatedUser = { id: 'teacher-1', role: UserRole.FORMATEUR };

      await expect(service.getBusyFree('student-1', actor, from, to)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('still lets the owner and RP through when the calendar row does not exist yet', async () => {
      mockCalendarRepo.findOne.mockResolvedValue(null);
      mockProfileRelationsClient.resolveRelations.mockResolvedValue({
        viewerId: 'rp-id',
        targetId: 'student-1',
        isSelf: false,
        isAdministrator: true,
        relations: [],
      });
      const actor: AuthenticatedUser = { id: 'rp-id', role: UserRole.RESPONSABLE_PEDAGOGIQUE };

      const result = await service.getBusyFree('student-1', actor, from, to);
      expect(result.availableWindows).toEqual([]);
      expect(result.unavailableBlocks).toEqual([]);
      expect(result.busyBlocks).toEqual([]);
    });

    // --- CAL-FB-004 : bug réel trouvé en HTTP contre la pile réelle
    // (2026-08-18). `ownerRole` dépendait de `Calendar.ownerRole`, renseigné
    // seulement à la création paresseuse de la ligne — un titulaire qui
    // n'avait jamais ouvert son propre calendrier voyait son rôle "inconnu"
    // et bloquait tout le monde d'autre, y compris une relation active
    // réelle. Corrigé en résolvant le rôle auprès d'identity-access-service,
    // indépendamment de l'existence de la ligne Calendar.

    it(
      'grants a linked parent even when the owner never had a Calendar row ' +
        'created (regression CAL-FB-004: ownerRole resolved via identity-access-service, not Calendar.ownerRole)',
      async () => {
        mockCalendarRepo.findOne.mockResolvedValue(null);
        mockIdentityAccessClient.resolveRole.mockResolvedValue(UserRole.ELEVE);
        mockProfileRelationsClient.resolveRelations.mockResolvedValue({
          viewerId: 'parent-1',
          targetId: 'student-1',
          isSelf: false,
          isAdministrator: false,
          relations: [{ kind: RelationKind.FINANCE_OWNER_OF_STUDENT }],
        });
        const actor: AuthenticatedUser = { id: 'parent-1', role: UserRole.PARENT_FINANCEUR };

        const result = await service.getBusyFree('student-1', actor, from, to);
        expect(result.ownerId).toBe('student-1');
        expect(mockIdentityAccessClient.resolveRole).toHaveBeenCalledWith(
          'student-1',
          undefined,
        );
      },
    );

    it('throws ServiceUnavailableException when profile-service is unreachable (fail closed)', async () => {
      mockCalendarRepo.findOne.mockResolvedValue({
        ownerId: 'student-1',
        ownerRole: UserRole.ELEVE,
        availabilitySlots: [],
      });
      mockIdentityAccessClient.resolveRole.mockResolvedValue(UserRole.ELEVE);
      mockProfileRelationsClient.resolveRelations.mockRejectedValue(
        new ProfileRelationsUnavailableError('profile-service unreachable or timed out'),
      );
      const actor: AuthenticatedUser = { id: 'teacher-1', role: UserRole.FORMATEUR };

      await expect(service.getBusyFree('student-1', actor, from, to)).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('throws ServiceUnavailableException when identity-access-service is unreachable (fail closed)', async () => {
      mockCalendarRepo.findOne.mockResolvedValue({
        ownerId: 'student-1',
        ownerRole: UserRole.ELEVE,
        availabilitySlots: [],
      });
      mockIdentityAccessClient.resolveRole.mockRejectedValue(
        new IdentityAccessUnavailableError('identity-access-service unreachable or timed out'),
      );
      const actor: AuthenticatedUser = { id: 'teacher-1', role: UserRole.FORMATEUR };

      await expect(service.getBusyFree('student-1', actor, from, to)).rejects.toThrow(
        ServiceUnavailableException,
      );
      expect(mockProfileRelationsClient.resolveRelations).not.toHaveBeenCalled();
    });

    it('separates available and unavailable slots, and never leaks id/title/participants', async () => {
      mockCalendarRepo.findOne.mockResolvedValue({
        ownerId: 'student-1',
        ownerRole: UserRole.ELEVE,
        availabilitySlots: [
          slot({ kind: SlotKind.AVAILABLE }),
          slot({
            id: 'slot-2',
            startTime: new Date('2026-09-11T09:00:00Z'),
            endTime: new Date('2026-09-11T10:00:00Z'),
            kind: SlotKind.UNAVAILABLE,
          }),
        ],
      });
      mockActivitiesService.findActiveInRange.mockResolvedValue([
        {
          id: 'activity-1',
          title: 'Cours de maths',
          type: 'cours',
          startTime: new Date('2026-09-12T09:00:00Z'),
          endTime: new Date('2026-09-12T10:00:00Z'),
          participantIds: ['student-1', 'teacher-1'],
        },
      ]);
      const actor: AuthenticatedUser = { id: 'student-1', role: UserRole.ELEVE };

      const result = await service.getBusyFree('student-1', actor, from, to);

      expect(result.availableWindows).toEqual([
        { start: '2026-09-10T09:00:00.000Z', end: '2026-09-10T11:00:00.000Z' },
      ]);
      expect(result.unavailableBlocks).toEqual([
        { start: '2026-09-11T09:00:00.000Z', end: '2026-09-11T10:00:00.000Z' },
      ]);
      expect(result.busyBlocks).toEqual([
        { start: '2026-09-12T09:00:00.000Z', end: '2026-09-12T10:00:00.000Z' },
      ]);
      const serialized = JSON.stringify(result);
      expect(serialized).not.toContain('activity-1');
      expect(serialized).not.toContain('Cours de maths');
      expect(serialized).not.toContain('teacher-1');
    });

    it('calls findActiveInRange with the owner id and the requested window', async () => {
      mockCalendarRepo.findOne.mockResolvedValue({
        ownerId: 'student-1',
        ownerRole: UserRole.ELEVE,
        availabilitySlots: [],
      });
      const actor: AuthenticatedUser = { id: 'student-1', role: UserRole.ELEVE };

      await service.getBusyFree('student-1', actor, from, to);

      expect(mockActivitiesService.findActiveInRange).toHaveBeenCalledWith(
        'student-1',
        from,
        to,
      );
    });
  });
});
