import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import Redis from 'ioredis';
import { ProcessedEvent } from '../events/entities/processed-event.entity';
import { REDIS_CLIENT } from '../events/redis-client.provider';
import { VISIOMATH_EVENTS_STREAM } from '../events/event-publisher.service';
import { ContactService } from './contact.service';
import { ProfileServiceClient } from './clients/profile-service.client';

const CONSUMER_GROUP = 'communication-service';
const CONSUMER_NAME = 'communication-service-consumer-1';
const BLOCK_MS = 5000;
const READ_COUNT = 10;
const RECLAIM_INTERVAL_MS = 30_000;
const RECLAIM_IDLE_MS = 60_000;

/**
 * docs/architecture/contacts-messagerie.md (2026-09-04), point 4 — default contacts derived
 * from profile-service business relations, consumed from the same Redis stream
 * (`visiomath:events`) already produced by teacher-request-service and consumed by
 * dashboard-notification-service (arbitrage du 2026-08-14) — same pattern (XGROUP/XREADGROUP/
 * XACK, `eventId` dedup via `processed_events`, periodic XAUTOCLAIM reclaim), replicated here,
 * not reinvented.
 *
 * IMPORTANT — known gap, see the session report: profile-service does not currently publish
 * `TeacherLinkedToStudent` / `StudentLinkedToFinanceOwner` / `AnimatorLinkedToTeacher` (nor
 * their "Unlinked" counterparts) onto this stream — verified empirically via `XRANGE` on
 * 2026-09-04, zero entries for any of these event names. They exist in profile-service's own
 * internal "structured log" (docs/routes.md > profile-service > "Événements publiés") but are
 * never `XADD`ed. This consumer is written and ready, but will sit idle until profile-service
 * wires its own outbox publisher the same way teacher-request-service already did — not
 * something communication-service can or should do on its behalf.
 */
@Injectable()
export class RelationEventConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RelationEventConsumerService.name);
  private running = false;
  private reclaimTimer: NodeJS.Timeout | null = null;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @InjectRepository(ProcessedEvent)
    private readonly processedEventRepository: Repository<ProcessedEvent>,
    private readonly contactService: ContactService,
    private readonly profileServiceClient: ProfileServiceClient,
    private readonly dataSource: DataSource,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ensureConsumerGroup();
    this.running = true;
    void this.consumeLoop();
    this.reclaimTimer = setInterval(() => void this.reclaimStale(), RECLAIM_INTERVAL_MS);
  }

  onModuleDestroy(): void {
    this.running = false;
    if (this.reclaimTimer) clearInterval(this.reclaimTimer);
  }

  private async ensureConsumerGroup(): Promise<void> {
    try {
      // Start from the beginning ('0') so no event published before this consumer existed is
      // lost — safe thanks to eventId dedup, same reasoning as dashboard-notification-service.
      await this.redis.xgroup('CREATE', VISIOMATH_EVENTS_STREAM, CONSUMER_GROUP, '0', 'MKSTREAM');
    } catch (error) {
      if (!String(error).includes('BUSYGROUP')) {
        this.logger.error(`Failed to create consumer group: ${error}`);
      }
    }
  }

  private async consumeLoop(): Promise<void> {
    while (this.running) {
      try {
        const response = await this.redis.xreadgroup(
          'GROUP',
          CONSUMER_GROUP,
          CONSUMER_NAME,
          'COUNT',
          READ_COUNT,
          'BLOCK',
          BLOCK_MS,
          'STREAMS',
          VISIOMATH_EVENTS_STREAM,
          '>',
        );
        if (!response) continue;

        const [, entries] = response[0] as [string, Array<[string, string[]]>];
        for (const [entryId, fields] of entries) {
          await this.handleEntry(entryId, fields);
        }
      } catch (error) {
        this.logger.error(`Consume loop error: ${error}`);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }

  private async reclaimStale(): Promise<void> {
    try {
      const result = await this.redis.xautoclaim(
        VISIOMATH_EVENTS_STREAM,
        CONSUMER_GROUP,
        CONSUMER_NAME,
        RECLAIM_IDLE_MS,
        '0',
        'COUNT',
        50,
      );
      const entries = result[1] as Array<[string, string[]]>;
      for (const [entryId, fields] of entries) {
        await this.handleEntry(entryId, fields);
      }
    } catch (error) {
      this.logger.error(`Reclaim error: ${error}`);
    }
  }

  private fieldsToObject(fields: string[]): Record<string, string> {
    const object: Record<string, string> = {};
    for (let index = 0; index < fields.length; index += 2) {
      object[fields[index]] = fields[index + 1];
    }
    return object;
  }

  private async handleEntry(entryId: string, fields: string[]): Promise<void> {
    const record = this.fieldsToObject(fields);
    const eventId = record.eventId ?? entryId;

    const alreadyProcessed = await this.processedEventRepository.findOne({ where: { eventId } });
    if (alreadyProcessed) {
      await this.redis.xack(VISIOMATH_EVENTS_STREAM, CONSUMER_GROUP, entryId);
      return;
    }

    let payload: Record<string, unknown> = {};
    try {
      payload = record.payload ? JSON.parse(record.payload) : {};
    } catch {
      this.logger.warn(`Unparseable payload for event ${eventId} (${record.eventName})`);
    }

    try {
      await this.dispatch(record.eventName, payload);
      await this.dataSource.transaction(async (manager) => {
        await manager.getRepository(ProcessedEvent).save({ eventId });
      });
      await this.redis.xack(VISIOMATH_EVENTS_STREAM, CONSUMER_GROUP, entryId);
    } catch (error) {
      // Not acked: XAUTOCLAIM will retry later. Never let one bad event block the loop forever —
      // the crash is logged, the entry stays pending for a future retry.
      this.logger.error(`Failed to handle event ${eventId} (${record.eventName}): ${error}`);
    }
  }

  /**
   * Field names below mirror the REST response bodies of the corresponding profile-service
   * writes (teacherId/studentId, financeOwnerId/studentId, animatorId/teacherId) — same
   * convention already used by teacher-request-service's own events. NOT verified against a
   * real payload (profile-service does not publish these yet, see class-level comment) — to be
   * confirmed once profile-service implements publishing.
   */
  private async dispatch(eventName: string, payload: Record<string, unknown>): Promise<void> {
    switch (eventName) {
      case 'TeacherLinkedToStudent':
        await this.onTeacherLinkedToStudent(payload);
        break;
      case 'StudentLinkedToFinanceOwner':
        await this.onStudentLinkedToFinanceOwner(payload);
        break;
      case 'AnimatorLinkedToTeacher':
        await this.onAnimatorLinkedToTeacher(payload);
        break;
      case 'TeacherUnlinkedFromStudent':
      case 'StudentUnlinkedFromFinanceOwner':
        // Deliberate no-op: breaking a Contact is never automatic (point 6), even when the
        // underlying business relation ends.
        break;
      default:
        // An unrecognized event type must never block the stream (same rule as
        // dashboard-notification-service).
        break;
    }
  }

  private async onTeacherLinkedToStudent(payload: Record<string, unknown>): Promise<void> {
    const teacherId = payload.teacherId as string | undefined;
    const studentId = payload.studentId as string | undefined;
    if (!teacherId || !studentId) return;

    await this.contactService.ensureActiveContact(teacherId, studentId, 'default');

    const financeOwnerIds = await this.profileServiceClient.getFinanceOwners(studentId);
    for (const financeOwnerId of financeOwnerIds) {
      await this.contactService.ensureActiveContact(financeOwnerId, teacherId, 'default');
    }
  }

  private async onStudentLinkedToFinanceOwner(payload: Record<string, unknown>): Promise<void> {
    const financeOwnerId = payload.financeOwnerId as string | undefined;
    const studentId = payload.studentId as string | undefined;
    if (!financeOwnerId || !studentId) return;

    await this.contactService.ensureActiveContact(financeOwnerId, studentId, 'default');

    const teacherIds = await this.profileServiceClient.getTeachers(studentId);
    for (const teacherId of teacherIds) {
      await this.contactService.ensureActiveContact(financeOwnerId, teacherId, 'default');
    }
  }

  private async onAnimatorLinkedToTeacher(payload: Record<string, unknown>): Promise<void> {
    const animatorId = payload.animatorId as string | undefined;
    const teacherId = payload.teacherId as string | undefined;
    if (!animatorId || !teacherId) return;

    await this.contactService.ensureActiveContact(animatorId, teacherId, 'default');
  }
}
