import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CalendarEvent, EventType, CalendarEventStatus } from './entities/calendar-event.entity';
import { EventInvitation, InvitationStatus } from './entities/event-invitation.entity';
import { CancellationRequest, CancellationStatus } from './entities/cancellation-request.entity';
import { ReminderRule, ReminderDelay } from './entities/reminder-rule.entity';
import { CalendarVisibilityGrant } from './entities/calendar-visibility-grant.entity';
import { CreateCalendarEventDto } from './dto/create-calendar-event.dto';
import { ListEventsQueryDto } from './dto/list-events-query.dto';
import { CancelRequestDto } from './dto/cancel-request.dto';
import { ConfigureReminderDto } from './dto/configure-reminder.dto';
import { CreateVisibilityGrantDto } from './dto/create-visibility-grant.dto';
import { EventsService } from '../events/events.service';
import { UserRole } from '../common/enums/user-role.enum';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';

/** Milliseconds in 48 hours */
const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;

/** Which EventType values each role is allowed to create */
const CREATION_ALLOWED_TYPES: Record<string, EventType[]> = {
  [UserRole.ELEVE]: [EventType.RAPPEL],
  [UserRole.FORMATEUR]: [EventType.COURS, EventType.MASTERCLASS, EventType.PEDAGOGIQUE, EventType.RAPPEL],
  [UserRole.ANIMATEUR_PEDAGOGIQUE]: [EventType.PEDAGOGIQUE, EventType.RAPPEL],
  [UserRole.RESPONSABLE_PEDAGOGIQUE]: [
    EventType.COURS,
    EventType.MASTERCLASS,
    EventType.PEDAGOGIQUE,
    EventType.FINANCIER,
    EventType.RAPPEL,
    EventType.INVITATION,
  ],
  [UserRole.PARENT_FINANCEUR]: [],
  [UserRole.ADMINISTRATEUR_FINANCIER]: [],
  [UserRole.TECHNICIEN_INFORMATIQUE]: [],
};

/**
 * Owns the CalendarEvent aggregate and all its lifecycle-dependent
 * sub-entities: EventInvitation, CancellationRequest, ReminderRule and
 * CalendarVisibilityGrant. These five repositories are injected here
 * (services-convention: "à partir de... plus de quatre repositories,
 * réévaluer et documenter la cohésion du service").
 *
 * Cohesion justification: none of these entities has an existence or a
 * lifecycle independent from the CalendarEvent they reference
 * (`onDelete: CASCADE`, `cascade: true` on the CalendarEvent side) — they
 * are not separate business capabilities, but sub-resources of a single
 * "calendar event" aggregate exposed through dedicated controllers
 * (event-invitations, event-cancellations, event-reminders,
 * calendar-visibility-grants). Splitting the service would duplicate the
 * aggregate's invariants across multiple services without a corresponding
 * gain in isolation, since every sub-entity requires the parent
 * CalendarEvent to exist and be looked up first.
 */
@Injectable()
export class CalendarEventsService {
  constructor(
    @InjectRepository(CalendarEvent)
    private readonly eventRepo: Repository<CalendarEvent>,
    @InjectRepository(EventInvitation)
    private readonly invitationRepo: Repository<EventInvitation>,
    @InjectRepository(CancellationRequest)
    private readonly cancellationRepo: Repository<CancellationRequest>,
    @InjectRepository(ReminderRule)
    private readonly reminderRuleRepo: Repository<ReminderRule>,
    @InjectRepository(CalendarVisibilityGrant)
    private readonly grantRepo: Repository<CalendarVisibilityGrant>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly eventsService: EventsService,
  ) {}

  /**
   * List events for a calendar owner, filtered by the requester's role
   * and optional type/personId query parameters.
   *
   * Access rules:
   * - PARENT_FINANCEUR: sees only FINANCIER events
   * - ADMINISTRATEUR_FINANCIER: sees only FINANCIER events
   * - RP, AP, TI: may view any user's events
   * - Others: see only their own events (ownerId === requesterId) or events where they are invitees
   * - A CalendarVisibilityGrant also enables access
   */
  async listEvents(
    ownerId: string,
    actor: AuthenticatedUser,
    query: ListEventsQueryDto,
    correlationId?: string,
  ): Promise<CalendarEvent[]> {
    await this.assertCanReadEvents(ownerId, actor);

    const queryBuilder = this.eventRepo
      .createQueryBuilder('event')
      .leftJoinAndSelect('event.invitations', 'invitation')
      .where('event.owner_id = :ownerId', { ownerId });

    // Role-based type filtering
    if (
      actor.role === UserRole.PARENT_FINANCEUR ||
      actor.role === UserRole.ADMINISTRATEUR_FINANCIER
    ) {
      queryBuilder.andWhere('event.event_type = :type', { type: EventType.FINANCIER });
    } else if (query.type) {
      queryBuilder.andWhere('event.event_type = :type', { type: query.type });
    }

    if (query.personId) {
      queryBuilder.andWhere(
        '(event.creator_id = :personId OR invitation.invitee_id = :personId)',
        { personId: query.personId },
      );
    }

    queryBuilder.orderBy('event.start_time', 'ASC');

    return queryBuilder.getMany();
  }

  /**
   * Create a CalendarEvent for ownerId's calendar, along with its optional
   * invitations, atomically (single transaction / single EntityManager).
   * Validates the requester's role against CREATION_ALLOWED_TYPES.
   * Publishes CalendarEventCreated domain event after commit.
   */
  async createEvent(
    ownerId: string,
    dto: CreateCalendarEventDto,
    actor: AuthenticatedUser,
    correlationId?: string,
  ): Promise<CalendarEvent> {
    const allowedTypes = CREATION_ALLOWED_TYPES[actor.role] ?? [];
    if (!allowedTypes.includes(dto.eventType)) {
      throw new ForbiddenException(
        `Role ${actor.role} is not allowed to create events of type ${dto.eventType}`,
      );
    }

    const createdEvent = await this.dataSource.transaction(async (manager) => {
      const eventRepo = manager.getRepository(CalendarEvent);
      const invitationRepo = manager.getRepository(EventInvitation);

      const savedEvent = await eventRepo.save(
        eventRepo.create({
          ownerId,
          title: dto.title ?? null,
          eventType: dto.eventType,
          creatorId: actor.id,
          creatorRole: actor.role,
          startAt: new Date(dto.startAt),
          endAt: new Date(dto.endAt),
          description: dto.description ?? null,
          targetRef: dto.targetRef ?? null,
        }),
      );

      if (dto.inviteeIds && dto.inviteeIds.length > 0) {
        const invitations = dto.inviteeIds.map((inviteeId) =>
          invitationRepo.create({
            eventId: savedEvent.id,
            inviteeId,
            status: InvitationStatus.PENDING,
          }),
        );
        await invitationRepo.save(invitations);
      }

      return eventRepo.findOne({
        where: { id: savedEvent.id },
        relations: ['invitations'],
      });
    });

    // Published after commit — the transaction above has already resolved.
    this.eventsService.publish(
      'CalendarEventCreated',
      {
        eventId: createdEvent.id,
        ownerId,
        eventType: createdEvent.eventType,
        creatorId: actor.id,
        startTime: createdEvent.startAt,
        inviteeIds: dto.inviteeIds ?? [],
      },
      correlationId,
    );

    return createdEvent;
  }

  /**
   * Accept an invitation for an event.
   * Only the invitee themselves may accept their own invitation.
   * Publishes InvitationAccepted domain event.
   */
  async acceptInvitation(
    eventId: string,
    userId: string,
    actor: AuthenticatedUser,
    correlationId?: string,
  ): Promise<EventInvitation> {
    this.assertActorIsInvitee(userId, actor);
    const invitation = await this.findInvitationOrFail(eventId, userId);

    if (invitation.status !== InvitationStatus.PENDING) {
      throw new ConflictException(
        `Invitation is already ${invitation.status} — cannot accept`,
      );
    }

    invitation.status = InvitationStatus.ACCEPTED;
    const updatedInvitation = await this.invitationRepo.save(invitation);

    this.eventsService.publish(
      'InvitationAccepted',
      { eventId, userId },
      correlationId,
    );

    return updatedInvitation;
  }

  /**
   * Decline an invitation for an event.
   * Only the invitee themselves may decline their own invitation.
   * The invitation record is marked declined (effectively removing the event from the invitee's view).
   * Publishes InvitationDeclined domain event.
   */
  async declineInvitation(
    eventId: string,
    userId: string,
    actor: AuthenticatedUser,
    correlationId?: string,
  ): Promise<EventInvitation> {
    this.assertActorIsInvitee(userId, actor);
    const invitation = await this.findInvitationOrFail(eventId, userId);

    if (invitation.status !== InvitationStatus.PENDING) {
      throw new ConflictException(
        `Invitation is already ${invitation.status} — cannot decline`,
      );
    }

    invitation.status = InvitationStatus.DECLINED;
    const updatedInvitation = await this.invitationRepo.save(invitation);

    this.eventsService.publish(
      'InvitationDeclined',
      { eventId, userId },
      correlationId,
    );

    return updatedInvitation;
  }

  /**
   * Request or apply cancellation of an event, atomically (single
   * transaction / single EntityManager for the CancellationRequest write
   * and the conditional CalendarEvent status update).
   * Business rule: if the event starts within 48h, status is PENDING_APPROVAL.
   * Otherwise status is APPROVED and the event is immediately cancelled.
   * Publishes CancellationRequested domain event after commit.
   */
  async requestCancellation(
    eventId: string,
    dto: CancelRequestDto,
    actor: AuthenticatedUser,
    correlationId?: string,
  ): Promise<CancellationRequest> {
    const calendarEvent = await this.findEventOrFail(eventId);

    this.assertCanCancelEvent(calendarEvent, actor);

    if (calendarEvent.status === CalendarEventStatus.CANCELLED) {
      throw new ConflictException('Event is already cancelled');
    }

    const timeUntilEvent = calendarEvent.startAt.getTime() - Date.now();
    const isWithin48Hours = timeUntilEvent < FORTY_EIGHT_HOURS_MS;

    const cancellationStatus = isWithin48Hours
      ? CancellationStatus.PENDING_APPROVAL
      : CancellationStatus.APPROVED;

    const cancellationRequest = await this.dataSource.transaction(async (manager) => {
      const cancellationRepo = manager.getRepository(CancellationRequest);
      const eventRepo = manager.getRepository(CalendarEvent);

      const savedRequest = await cancellationRepo.save(
        cancellationRepo.create({
          eventId,
          requesterId: actor.id,
          status: cancellationStatus,
          reason: dto.reason ?? null,
        }),
      );

      // If approved automatically, mark the event as cancelled
      if (cancellationStatus === CancellationStatus.APPROVED) {
        await eventRepo.save({
          ...calendarEvent,
          status: CalendarEventStatus.CANCELLED,
        });
      }

      return savedRequest;
    });

    // Published after commit — the transaction above has already resolved.
    this.eventsService.publish(
      'CancellationRequested',
      {
        eventId,
        requesterId: actor.id,
        status: cancellationStatus,
        isWithin48Hours,
      },
      correlationId,
    );

    return cancellationRequest;
  }

  /**
   * Configure a ReminderRule for an event for the requesting user.
   * Replaces any existing rule the user may have for this event.
   * The requesting user must be the event organizer or an invitee.
   */
  async configureReminder(
    eventId: string,
    dto: ConfigureReminderDto,
    actor: AuthenticatedUser,
    correlationId?: string,
  ): Promise<ReminderRule> {
    const calendarEvent = await this.findEventOrFail(eventId);
    await this.assertUserCanAccessEvent(calendarEvent, actor);

    // Remove existing rule for this user on this event (idempotent)
    await this.reminderRuleRepo.delete({ eventId, ownerId: actor.id });

    if (dto.delay === ReminderDelay.NONE) {
      // "none" means no reminder — return a transient object for the response
      return Object.assign(new ReminderRule(), {
        id: null,
        eventId,
        ownerId: actor.id,
        delay: ReminderDelay.NONE,
        isSent: false,
      });
    }

    const reminderRule = await this.reminderRuleRepo.save(
      this.reminderRuleRepo.create({
        eventId,
        ownerId: actor.id,
        delay: dto.delay,
        isSent: false,
      }),
    );

    return reminderRule;
  }

  /**
   * Create a CalendarVisibilityGrant (RP only).
   * Allows granteeId to read ownerId's calendar.
   */
  async createVisibilityGrant(
    ownerId: string,
    dto: CreateVisibilityGrantDto,
    actor: AuthenticatedUser,
    correlationId?: string,
  ): Promise<CalendarVisibilityGrant> {
    if (actor.role !== UserRole.RESPONSABLE_PEDAGOGIQUE) {
      throw new ForbiddenException('Only a RP can create calendar visibility grants');
    }

    const existingGrant = await this.grantRepo.findOne({
      where: { ownerId, granteeId: dto.granteeId },
    });

    if (existingGrant) {
      return existingGrant;
    }

    return this.grantRepo.save(
      this.grantRepo.create({
        ownerId,
        granteeId: dto.granteeId,
        grantedBy: actor.id,
      }),
    );
  }

  /**
   * Revoke a CalendarVisibilityGrant (RP only).
   */
  async revokeVisibilityGrant(
    ownerId: string,
    granteeId: string,
    actorRole: UserRole,
    correlationId?: string,
  ): Promise<{ revoked: boolean }> {
    if (actorRole !== UserRole.RESPONSABLE_PEDAGOGIQUE) {
      throw new ForbiddenException('Only a RP can revoke calendar visibility grants');
    }

    const grant = await this.grantRepo.findOne({ where: { ownerId, granteeId } });
    if (!grant) {
      throw new NotFoundException(`No visibility grant found for grantee ${granteeId} on calendar ${ownerId}`);
    }

    await this.grantRepo.remove(grant);
    return { revoked: true };
  }

  // ---- Private helpers ----

  private async findEventOrFail(eventId: string): Promise<CalendarEvent> {
    const calendarEvent = await this.eventRepo.findOne({ where: { id: eventId } });
    if (!calendarEvent) {
      throw new NotFoundException(`Event ${eventId} not found`);
    }
    return calendarEvent;
  }

  private async findInvitationOrFail(eventId: string, inviteeId: string): Promise<EventInvitation> {
    const invitation = await this.invitationRepo.findOne({
      where: { eventId, inviteeId },
    });
    if (!invitation) {
      throw new NotFoundException(
        `No pending invitation found for user ${inviteeId} on event ${eventId}`,
      );
    }
    return invitation;
  }

  /**
   * Only the invitee themselves may accept or decline their own invitation.
   */
  private assertActorIsInvitee(userId: string, actor: AuthenticatedUser): void {
    if (actor.id !== userId) {
      throw new ForbiddenException('You can only respond to your own invitations');
    }
  }

  /**
   * Determine whether a user can read events for a given calendar owner.
   * Checks: is owner, has internal privileged role, or has a CalendarVisibilityGrant.
   */
  private async assertCanReadEvents(ownerId: string, actor: AuthenticatedUser): Promise<void> {
    if (actor.id === ownerId) return;

    const privilegedRoles: UserRole[] = [
      UserRole.RESPONSABLE_PEDAGOGIQUE,
      UserRole.ANIMATEUR_PEDAGOGIQUE,
      UserRole.TECHNICIEN_INFORMATIQUE,
      UserRole.ADMINISTRATEUR_FINANCIER,
      UserRole.PARENT_FINANCEUR,
    ];
    if (privilegedRoles.includes(actor.role)) return;

    const visibilityGrant = await this.grantRepo.findOne({
      where: { ownerId, granteeId: actor.id },
    });
    if (visibilityGrant) return;

    throw new ForbiddenException(
      'You do not have permission to view this calendar\'s events',
    );
  }

  /**
   * Only the event creator, RP, or TI can request cancellation.
   */
  private assertCanCancelEvent(calendarEvent: CalendarEvent, actor: AuthenticatedUser): void {
    const cancellationRoles: UserRole[] = [
      UserRole.RESPONSABLE_PEDAGOGIQUE,
      UserRole.TECHNICIEN_INFORMATIQUE,
    ];
    if (calendarEvent.creatorId === actor.id) return;
    if (cancellationRoles.includes(actor.role)) return;
    throw new ForbiddenException('Only the event creator, RP, or TI can request cancellation');
  }

  /**
   * Assert that a user can access (read or configure reminders for) an event.
   * Access is granted if the user is:
   *   - the event organizer (creatorId)
   *   - an invitee with a non-declined invitation
   *   - a privileged internal role (RP, TI, AP, ADMINISTRATEUR_FINANCIER)
   */
  private async assertUserCanAccessEvent(
    calendarEvent: CalendarEvent,
    actor: AuthenticatedUser,
  ): Promise<void> {
    if (calendarEvent.creatorId === actor.id) return;

    const privilegedInternalRoles: UserRole[] = [
      UserRole.RESPONSABLE_PEDAGOGIQUE,
      UserRole.TECHNICIEN_INFORMATIQUE,
      UserRole.ANIMATEUR_PEDAGOGIQUE,
      UserRole.ADMINISTRATEUR_FINANCIER,
    ];
    if (privilegedInternalRoles.includes(actor.role)) return;

    const invitation = await this.invitationRepo.findOne({
      where: { eventId: calendarEvent.id, inviteeId: actor.id },
    });
    if (invitation && invitation.status !== InvitationStatus.DECLINED) return;

    throw new ForbiddenException(
      'You must be the event organizer or an invitee to configure a reminder on this event',
    );
  }
}
