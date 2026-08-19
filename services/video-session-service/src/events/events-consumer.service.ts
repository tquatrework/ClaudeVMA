import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Redis from 'ioredis';
import { ActivityProjection } from './entities/activity-projection.entity';
import { ProcessedEvent } from './entities/processed-event.entity';
import { VideoSessionService } from '../video-session/video-session.service';

const STREAM_KEY = 'visiomath:events';
const GROUP_NAME = 'video-session-service';
const BLOCK_MS = 5000;
const BATCH_SIZE = 10;

/** Domain event types this service reacts to. Anything else is ack'ed and ignored. */
const ACTIVITY_SCHEDULED = 'ActivityScheduled';
const ACTIVITY_CONFIRMED = 'ActivityConfirmed';

/** Only this ScheduledActivity.type triggers automatic room creation (out of scope: other types). */
const AUTO_ROOM_ACTIVITY_TYPE = 'cours';

interface DomainEventEnvelope {
  eventId: string;
  eventName: string;
  aggregateType?: string;
  aggregateId?: string;
  correlationId?: string;
  occurredAt?: string;
  payload: Record<string, unknown>;
}

/**
 * EventsConsumerService — subscribes to calendar-service's `visiomath:events`
 * Redis stream (chantier calendrier-visio-livekit, point 4, 2026-08-19).
 *
 * Verified directly against the live Redis stream on 2026-08-19 (not assumed
 * from documentation): each stream entry carries flat fields `eventId`,
 * `eventName`, `aggregateType`, `aggregateId`, `correlationId`, `occurredAt`,
 * `payload` (JSON string) — `dashboard-notification-service` already consumes
 * this exact shape under consumer group `dashboard-notification-service`. This
 * service reuses the same stream under its own group `video-session-service`
 * (arbitrage 2026-08-14, "generique pour les autres flux").
 *
 * `ActivityConfirmed`'s real payload is `{activityId, confirmedBy}` only — no
 * `type`, no `participantIds`. Deciding whether to auto-create a room for
 * "cours" therefore requires the earlier `ActivityScheduled` event for the same
 * `activityId`, which does carry `type`/`participantIds`/`creatorId`. This
 * service projects `ActivityScheduled` into `activity_projections` and reads it
 * back when the matching `ActivityConfirmed` arrives. See the session report for
 * why this was necessary (no internal route exists on calendar-service today to
 * fetch an activity's type/participants by id after the fact).
 */
@Injectable()
export class EventsConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventsConsumerService.name);
  private redis: Redis | null = null;
  private stopping = false;
  private loopPromise: Promise<void> | null = null;

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(ActivityProjection)
    private readonly projectionRepo: Repository<ActivityProjection>,
    @InjectRepository(ProcessedEvent)
    private readonly processedRepo: Repository<ProcessedEvent>,
    private readonly videoSessionService: VideoSessionService,
  ) {}

  async onModuleInit(): Promise<void> {
    const redisUrl = this.config.get<string>('REDIS_URL');
    if (!redisUrl) {
      this.logger.warn(
        'REDIS_URL is not configured — automatic room creation from ActivityConfirmed is disabled.',
      );
      return;
    }

    this.redis = new Redis(redisUrl, { maxRetriesPerRequest: null });

    try {
      // MKSTREAM: create the stream if calendar-service has not published anything
      // yet. Start at "0": replay the full history so activities confirmed before
      // this consumer group existed are still picked up — the same choice observed
      // on the real `dashboard-notification-service` consumer group (entries-read
      // equal to the stream's full length, not just new events since creation).
      await this.redis.xgroup('CREATE', STREAM_KEY, GROUP_NAME, '0', 'MKSTREAM');
    } catch (error) {
      const message = (error as Error).message ?? '';
      if (!message.includes('BUSYGROUP')) {
        this.logger.error(`Failed to create consumer group: ${message}`);
      }
    }

    this.loopPromise = this.consumeLoop();
  }

  async onModuleDestroy(): Promise<void> {
    this.stopping = true;
    if (this.loopPromise) {
      await this.loopPromise.catch(() => undefined);
    }
    if (this.redis) {
      await this.redis.quit().catch(() => undefined);
    }
  }

  private consumerName(): string {
    return `video-session-service-${process.pid}`;
  }

  private async consumeLoop(): Promise<void> {
    while (!this.stopping) {
      try {
        await this.readAndProcessBatch();
      } catch (error) {
        this.logger.error(`Consumer loop error: ${(error as Error).message}`);
        await this.sleep(1000);
      }
    }
  }

  private async readAndProcessBatch(): Promise<void> {
    if (!this.redis) return;

    const response = await this.redis.xreadgroup(
      'GROUP',
      GROUP_NAME,
      this.consumerName(),
      'COUNT',
      BATCH_SIZE,
      'BLOCK',
      BLOCK_MS,
      'STREAMS',
      STREAM_KEY,
      '>',
    );

    if (!response) return;

    // ioredis shape: [[streamKey, [[entryId, [field, value, field, value, ...]], ...]]]
    const [, entries] = response[0] as unknown as [string, [string, string[]][]];

    for (const [entryId, fields] of entries) {
      await this.processEntry(entryId, fields);
    }
  }

  private async processEntry(entryId: string, fields: string[]): Promise<void> {
    const envelope = this.parseEnvelope(fields);

    if (!envelope) {
      this.logger.warn(`Unparseable stream entry ${entryId}, acknowledging and skipping.`);
      await this.ack(entryId);
      return;
    }

    const alreadyProcessed = await this.markProcessed(envelope);
    if (!alreadyProcessed) {
      try {
        await this.handleEvent(envelope);
      } catch (error) {
        this.logger.error(
          `Failed to handle event ${envelope.eventName} (${envelope.eventId}): ${
            (error as Error).message
          }`,
        );
      }
    }

    await this.ack(entryId);
  }

  private parseEnvelope(fields: string[]): DomainEventEnvelope | null {
    const record: Record<string, string> = {};
    for (let index = 0; index < fields.length; index += 2) {
      record[fields[index]] = fields[index + 1];
    }

    if (!record.eventId || !record.eventName || !record.payload) {
      return null;
    }

    try {
      return {
        eventId: record.eventId,
        eventName: record.eventName,
        aggregateType: record.aggregateType,
        aggregateId: record.aggregateId,
        correlationId: record.correlationId || undefined,
        occurredAt: record.occurredAt,
        payload: JSON.parse(record.payload),
      };
    } catch {
      return null;
    }
  }

  /** Returns true if the event was already processed (duplicate delivery). */
  private async markProcessed(envelope: DomainEventEnvelope): Promise<boolean> {
    try {
      await this.processedRepo.insert({
        eventId: envelope.eventId,
        eventName: envelope.eventName,
      });
      return false;
    } catch {
      // Unique constraint violation on eventId: already processed.
      return true;
    }
  }

  private async handleEvent(envelope: DomainEventEnvelope): Promise<void> {
    switch (envelope.eventName) {
      case ACTIVITY_SCHEDULED:
        await this.handleActivityScheduled(envelope.payload);
        break;
      case ACTIVITY_CONFIRMED:
        await this.handleActivityConfirmed(envelope.payload);
        break;
      default:
        // Not a domain event this service reacts to.
        break;
    }
  }

  private async handleActivityScheduled(payload: Record<string, unknown>): Promise<void> {
    const activityId = payload.activityId as string | undefined;
    const type = payload.type as string | undefined;
    const creatorId = payload.creatorId as string | undefined;
    const participantIds = (payload.participantIds as string[] | undefined) ?? [];
    const startTime = payload.startTime as string | undefined;

    if (!activityId || !type || !creatorId || !startTime) {
      this.logger.warn(
        `ActivityScheduled payload missing required fields: ${JSON.stringify(payload)}`,
      );
      return;
    }

    const existing = await this.projectionRepo.findOne({ where: { activityId } });
    const projection = existing ?? this.projectionRepo.create({ activityId });
    projection.type = type;
    projection.creatorId = creatorId;
    projection.participantIds = participantIds;
    projection.startTime = new Date(startTime);
    await this.projectionRepo.save(projection);
  }

  private async handleActivityConfirmed(payload: Record<string, unknown>): Promise<void> {
    const activityId = payload.activityId as string | undefined;
    if (!activityId) {
      this.logger.warn(`ActivityConfirmed payload missing activityId: ${JSON.stringify(payload)}`);
      return;
    }

    const projection = await this.projectionRepo.findOne({ where: { activityId } });
    if (!projection) {
      // The matching ActivityScheduled was never observed by this consumer
      // (published before the group existed and outside the "0" backlog replay,
      // or genuinely lost). Documented limitation, see the session report —
      // calendar-service has no internal route today to fetch an activity's
      // type/participants by id after the fact.
      this.logger.warn(
        `No ActivityScheduled projection for confirmed activity ${activityId}; ` +
          'cannot decide whether to create a room.',
      );
      return;
    }

    if (projection.type !== AUTO_ROOM_ACTIVITY_TYPE) {
      return;
    }

    await this.videoSessionService.createForActivity(activityId);
  }

  private async ack(entryId: string): Promise<void> {
    if (!this.redis) return;
    await this.redis.xack(STREAM_KEY, GROUP_NAME, entryId);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
