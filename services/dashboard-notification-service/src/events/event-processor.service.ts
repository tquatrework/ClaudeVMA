import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Notification, NotificationType } from '../notification/entities/notification.entity';
import { ProcessedEvent } from './entities/processed-event.entity';
import { ProfileServiceClient, DisplayName } from './profile-service.client';
import { IdentityAccessServiceClient } from '../common/clients/identity-access-service.client';

const POSTGRES_UNIQUE_VIOLATION = '23505';

interface NotificationRecipient {
  userId: string;
  type: NotificationType;
  metadata: Record<string, unknown>;
}

function displayName(entry: DisplayName | undefined): string | null {
  if (!entry) {
    return null;
  }
  const parts = [entry.firstName, entry.lastName].filter((part): part is string => Boolean(part && part.trim()));
  return parts.length > 0 ? parts.join(' ') : null;
}

/**
 * Consumes domain events read from the Redis stream `visiomath:events`
 * (see EventStreamConsumerService / EventStreamReclaimService) and turns
 * the ones this service cares about into notifications.
 *
 * Contract with callers: `process()` resolves normally once the event has
 * been durably handled (a notification was created, or the event
 * legitimately produces none) — the caller may then XACK the stream
 * entry. `process()` *throws* when the event could not be handled because
 * of a transient failure (profile-service unreachable, name unresolved):
 * the caller must leave the entry unacknowledged so it is retried, per
 * "une erreur metier ne devient jamais un succes technique" and the
 * explicit instruction not to publish a degraded notification with a
 * missing name.
 */
@Injectable()
export class EventProcessorService {
  private readonly logger = new Logger(EventProcessorService.name);

  constructor(
    @InjectRepository(Notification) private readonly notificationRepository: Repository<Notification>,
    @InjectRepository(ProcessedEvent) private readonly processedEventRepository: Repository<ProcessedEvent>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly profileServiceClient: ProfileServiceClient,
    private readonly identityAccessServiceClient: IdentityAccessServiceClient,
  ) {}

  /**
   * Resolve every real userId currently holding `role` via
   * identity-access-service (the sole owner of the role) and build one
   * recipient per account — a real fan-out. Replaces the former pis-aller
   * of a single recipient keyed by a synthetic `userId = "role:<role>"`
   * that never matched a real account and was therefore invisible to
   * `GET /notifications`. Fixed 2026-08-17 — see
   * docs/services/dashboard-notification-service.md.
   */
  private async resolveRoleRecipients(
    role: string,
    type: NotificationType,
    metadata: Record<string, unknown>,
  ): Promise<NotificationRecipient[]> {
    const userIds = await this.identityAccessServiceClient.listUserIdsByRole(role);
    return userIds.map((userId) => ({ userId, type, metadata }));
  }

  async process(fields: Record<string, string>): Promise<void> {
    const eventId = fields.eventId;
    const eventName = fields.eventName;

    if (!eventId || !eventName) {
      this.logger.error(`Malformed stream entry (missing eventId/eventName), dropping: ${JSON.stringify(fields)}`);
      return;
    }

    const alreadyProcessed = await this.processedEventRepository.findOne({ where: { eventId } });
    if (alreadyProcessed) {
      this.logger.debug(`Event ${eventId} (${eventName}) already processed — skipping (idempotent replay).`);
      return;
    }

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(fields.payload ?? '{}');
    } catch (error) {
      this.logger.error(`Event ${eventId} (${eventName}) has an unparsable payload, dropping: ${(error as Error).message}`);
      await this.markProcessedOnly(eventId, eventName);
      return;
    }

    switch (eventName) {
      case 'TeacherRequestCreated':
        await this.handleTeacherRequestCreated(eventId, eventName, payload);
        break;
      case 'TeacherProposalSent':
        await this.handleTeacherProposalSent(eventId, eventName, payload);
        break;
      case 'TeacherProposalAccepted':
        await this.handleProposalDecisionForRp(eventId, eventName, payload, NotificationType.TEACHER_PROPOSAL_ACCEPTED);
        break;
      case 'TeacherProposalDeclined':
        await this.handleProposalDecisionForRp(eventId, eventName, payload, NotificationType.TEACHER_PROPOSAL_DECLINED);
        break;
      case 'TeacherProposalNotSelected':
        await this.handleProposalOutcomeForTeacher(eventId, eventName, payload, NotificationType.TEACHER_PROPOSAL_NOT_SELECTED);
        break;
      case 'TeacherProposalExpired':
        await this.handleProposalOutcomeForTeacher(eventId, eventName, payload, NotificationType.TEACHER_PROPOSAL_EXPIRED);
        break;
      case 'TeacherAssigned':
        await this.handleTeacherAssigned(eventId, eventName, payload);
        break;
      case 'MainTeacherAssigned':
        await this.handleMainTeacherAssigned(eventId, eventName, payload);
        break;
      case 'TeacherRequestStatusUpdated':
        await this.handleTeacherRequestStatusUpdated(eventId, eventName, payload);
        break;
      case 'ActivityScheduled':
        await this.handleActivityScheduled(eventId, eventName, payload);
        break;
      case 'CalendarEventCreated':
        await this.handleCalendarEventCreated(eventId, eventName, payload);
        break;
      case 'TeacherRequestClosed':
      case 'TeacherRequestDeleted':
        // No notification: TeacherRequestClosed is redundant with TeacherAssigned's
        // notification, and TeacherRequestDeleted's actor is the requester themselves.
        // See docs/architecture.md > "Systeme de notifications transversal", points 7/8.
        await this.markProcessedOnly(eventId, eventName);
        break;
      default:
        this.logger.warn(`Unrecognized eventName "${eventName}" (event ${eventId}) — acking without action.`);
        await this.markProcessedOnly(eventId, eventName);
    }
  }

  private async resolveNames(userIds: string[]): Promise<Map<string, DisplayName>> {
    const uniqueIds = [...new Set(userIds)];
    const map = await this.profileServiceClient.resolveDisplayNames(uniqueIds);
    const missing = uniqueIds.filter((id) => !map.has(id));
    if (missing.length > 0) {
      throw new Error(`Unresolved display name(s) for userId(s): ${missing.join(', ')}`);
    }
    return map;
  }

  /**
   * Recipients: role RP (arbitrage du 2026-08-14, point 8) **plus** every
   * finance owner of the student (2026-08-18) — a parent must learn that
   * their own child has requested a teacher, not only that one has been
   * found (`TeacherAssigned`, which already notifies finance owners). Same
   * `getFinanceOwners` helper as `handleTeacherAssigned` /
   * `handleTeacherRequestStatusUpdated`: no duplicated resolution logic.
   * A finance-owner lookup failure throws like every other unresolved
   * dependency here — the entry is left unacknowledged and retried, never
   * silently degraded to "RP only".
   */
  private async handleTeacherRequestCreated(eventId: string, eventName: string, payload: Record<string, unknown>): Promise<void> {
    const studentId = payload.studentId as string;
    const [names, financeOwnerUserIds] = await Promise.all([
      this.resolveNames([studentId]),
      this.profileServiceClient.getFinanceOwners(studentId),
    ]);
    const metadata = {
      requestId: payload.requestId,
      studentId,
      studentName: displayName(names.get(studentId)),
      requesterId: payload.requesterId,
      requesterRole: payload.requesterRole,
      type: payload.type,
    };
    const rpRecipients = await this.resolveRoleRecipients(
      'responsable_pedagogique',
      NotificationType.TEACHER_REQUEST_CREATED,
      metadata,
    );
    const recipients: NotificationRecipient[] = [
      ...rpRecipients,
      ...financeOwnerUserIds.map((userId) => ({ userId, type: NotificationType.TEACHER_REQUEST_CREATED, metadata })),
    ];
    await this.persist(eventId, eventName, recipients);
  }

  private async handleTeacherProposalSent(eventId: string, eventName: string, payload: Record<string, unknown>): Promise<void> {
    const studentId = payload.studentId as string;
    const names = await this.resolveNames([studentId]);
    const metadata = {
      proposalId: payload.proposalId,
      requestId: payload.requestId,
      studentId,
      studentName: displayName(names.get(studentId)),
      sentBy: payload.sentBy,
      responseDeadline: payload.responseDeadline ?? null,
    };
    await this.persist(eventId, eventName, [
      { userId: payload.teacherId as string, type: NotificationType.TEACHER_PROPOSAL_SENT, metadata },
    ]);
  }

  private async handleProposalDecisionForRp(
    eventId: string,
    eventName: string,
    payload: Record<string, unknown>,
    type: NotificationType,
  ): Promise<void> {
    const studentId = payload.studentId as string;
    const teacherId = payload.teacherId as string;
    const names = await this.resolveNames([studentId, teacherId]);
    const metadata = {
      proposalId: payload.proposalId,
      requestId: payload.requestId,
      studentId,
      studentName: displayName(names.get(studentId)),
      teacherId,
      teacherName: displayName(names.get(teacherId)),
    };
    const recipients = await this.resolveRoleRecipients('responsable_pedagogique', type, metadata);
    await this.persist(eventId, eventName, recipients);
  }

  private async handleProposalOutcomeForTeacher(
    eventId: string,
    eventName: string,
    payload: Record<string, unknown>,
    type: NotificationType,
  ): Promise<void> {
    const studentId = payload.studentId as string;
    const names = await this.resolveNames([studentId]);
    const metadata = {
      proposalId: payload.proposalId,
      requestId: payload.requestId,
      studentId,
      studentName: displayName(names.get(studentId)),
    };
    await this.persist(eventId, eventName, [{ userId: payload.teacherId as string, type, metadata }]);
  }

  private async handleTeacherAssigned(eventId: string, eventName: string, payload: Record<string, unknown>): Promise<void> {
    const studentId = payload.studentId as string;
    const teacherId = payload.teacherId as string;
    const [names, financeOwnerUserIds] = await Promise.all([
      this.resolveNames([studentId, teacherId]),
      this.profileServiceClient.getFinanceOwners(studentId),
    ]);
    const metadata = {
      requestId: payload.requestId,
      proposalId: payload.proposalId,
      studentId,
      studentName: displayName(names.get(studentId)),
      teacherId,
      teacherName: displayName(names.get(teacherId)),
      isPrincipalTeacher: payload.isPrincipalTeacher ?? false,
      validatedBy: payload.validatedBy,
    };
    await this.persist(eventId, eventName, this.buildTeacherAssignedRecipients(teacherId, studentId, financeOwnerUserIds, metadata));
  }

  private async handleMainTeacherAssigned(eventId: string, eventName: string, payload: Record<string, unknown>): Promise<void> {
    const studentId = payload.studentId as string;
    const teacherId = payload.teacherId as string;
    const [names, financeOwnerUserIds] = await Promise.all([
      this.resolveNames([studentId, teacherId]),
      this.profileServiceClient.getFinanceOwners(studentId),
    ]);
    const metadata = {
      assignmentId: payload.assignmentId,
      studentId,
      studentName: displayName(names.get(studentId)),
      teacherId,
      teacherName: displayName(names.get(teacherId)),
    };
    await this.persist(eventId, eventName, this.buildTeacherAssignedRecipients(teacherId, studentId, financeOwnerUserIds, metadata));
  }

  private buildTeacherAssignedRecipients(
    teacherId: string,
    studentId: string,
    financeOwnerUserIds: string[],
    metadata: Record<string, unknown>,
  ): NotificationRecipient[] {
    return [
      { userId: teacherId, type: NotificationType.TEACHER_ASSIGNED, metadata },
      { userId: studentId, type: NotificationType.TEACHER_ASSIGNED, metadata },
      ...financeOwnerUserIds.map((userId) => ({ userId, type: NotificationType.TEACHER_ASSIGNED, metadata })),
    ];
  }

  private async handleTeacherRequestStatusUpdated(eventId: string, eventName: string, payload: Record<string, unknown>): Promise<void> {
    const studentId = payload.studentId as string;
    const [names, financeOwnerUserIds] = await Promise.all([
      this.resolveNames([studentId]),
      this.profileServiceClient.getFinanceOwners(studentId),
    ]);
    const metadata = {
      requestId: payload.requestId,
      status: payload.status,
      updatedBy: payload.updatedBy,
      studentId,
      studentName: displayName(names.get(studentId)),
    };
    const recipients: NotificationRecipient[] = [
      { userId: studentId, type: NotificationType.TEACHER_REQUEST_STATUS_UPDATED, metadata },
      ...financeOwnerUserIds.map((userId) => ({ userId, type: NotificationType.TEACHER_REQUEST_STATUS_UPDATED, metadata })),
    ];
    await this.persist(eventId, eventName, recipients);
  }

  /**
   * `ActivityScheduled` is published by calendar-service for *every*
   * activity creation, not only single-recipient proposals — this service
   * only cares about the 1 proposeur -> 1 destinataire case (`cours`
   * typically, but also `reunion_pedagogique` targeting a single
   * recipient). `payload.recipientId` is calendar-service's own signal for
   * that case: `null` for every multi-participant usage (RP to several
   * formateurs, `entretien_rp`, `rappel`, `autre`, multi-participant
   * meetings), which this handler must ignore — acked, no notification, no
   * "unrecognized type" warning since the type itself *is* recognized.
   * Arbitrage du 2026-08-19, chantier "calendrier de disponibilités lié à
   * la visio", point 3.
   */
  private async handleActivityScheduled(eventId: string, eventName: string, payload: Record<string, unknown>): Promise<void> {
    const recipientId = payload.recipientId as string | null | undefined;
    if (!recipientId) {
      await this.markProcessedOnly(eventId, eventName);
      return;
    }

    const creatorId = payload.creatorId as string;
    const names = await this.resolveNames([creatorId]);
    const metadata = {
      proposerName: displayName(names.get(creatorId)),
      activityId: payload.activityId,
      activityType: payload.type,
      startTime: payload.startTime,
    };
    await this.persist(eventId, eventName, [
      { userId: recipientId, type: NotificationType.COURSE_SLOT_PROPOSED, metadata },
    ]);
  }

  /**
   * `CalendarEventCreated` is published by calendar-service for *every*
   * calendar event creation (`POST /calendars/:ownerId/events`), whether or
   * not the event carries invitees. `payload.inviteeIds` is a plain array
   * (never `undefined`, `[]` when no one was invited) — one recipient per
   * element, unlike `ActivityScheduled`/`recipientId` above which only ever
   * targets a single destinataire. Bug réel signalé par un utilisateur en
   * conditions réelles le 2026-08-20 : un invité ne recevait jusque-là
   * aucune notification, corrigé ici après que calendar-service a corrigé
   * la visibilité côté calendrier le même jour.
   *
   * `payload.title` is genuinely absent from the real payload observed on
   * the Redis stream (verified 2026-08-20 via `XREVRANGE` against the live
   * stream, not only against the documented example) — `title` having
   * become optional on `CalendarEvent` itself in this same chantier. Treated
   * as `null` whether the key is absent or explicitly `null`; no default
   * title is fabricated server-side, per the language/metadata rule already
   * applied to every other type produced by this consumer.
   */
  private async handleCalendarEventCreated(eventId: string, eventName: string, payload: Record<string, unknown>): Promise<void> {
    const inviteeIds = [...new Set((payload.inviteeIds as string[] | undefined) ?? [])];
    if (inviteeIds.length === 0) {
      await this.markProcessedOnly(eventId, eventName);
      return;
    }

    const creatorId = payload.creatorId as string;
    const names = await this.resolveNames([creatorId]);
    const metadata = {
      creatorName: displayName(names.get(creatorId)),
      eventId: payload.eventId,
      eventType: payload.eventType,
      title: (payload.title as string | null | undefined) ?? null,
      startAt: payload.startTime,
    };
    await this.persist(
      eventId,
      eventName,
      inviteeIds.map((userId) => ({ userId, type: NotificationType.EVENT_INVITATION_RECEIVED, metadata })),
    );
  }

  /** Atomically records the event as processed and creates its notifications, or neither. */
  private async persist(eventId: string, eventName: string, recipients: NotificationRecipient[]): Promise<void> {
    try {
      await this.dataSource.transaction(async (manager) => {
        const notificationRepository = manager.getRepository(Notification);
        const processedEventRepository = manager.getRepository(ProcessedEvent);

        for (const recipient of recipients) {
          await notificationRepository.save(
            notificationRepository.create({
              userId: recipient.userId,
              type: recipient.type,
              title: null,
              message: null,
              metadata: recipient.metadata,
            }),
          );
        }

        await processedEventRepository.save(processedEventRepository.create({ eventId, eventName }));
      });
    } catch (error) {
      this.swallowConcurrentDuplicate(error, eventId, eventName);
    }
  }

  /** Same guarantee as `persist`, for events that produce no notification. */
  private async markProcessedOnly(eventId: string, eventName: string): Promise<void> {
    try {
      await this.processedEventRepository.save(this.processedEventRepository.create({ eventId, eventName }));
    } catch (error) {
      this.swallowConcurrentDuplicate(error, eventId, eventName);
    }
  }

  /**
   * A duplicate `eventId` insert can only mean another consumer (or a
   * reclaim pass racing the main loop) processed this exact event between
   * our dedupe check and our write — the desired outcome either way. Any
   * other failure is a real error and must propagate so the caller does
   * not acknowledge the entry.
   */
  private swallowConcurrentDuplicate(error: unknown, eventId: string, eventName: string): void {
    const code = (error as { code?: string })?.code;
    if (code === POSTGRES_UNIQUE_VIOLATION) {
      this.logger.debug(`Event ${eventId} (${eventName}) processed concurrently by another consumer — ignoring duplicate.`);
      return;
    }
    throw error;
  }
}
