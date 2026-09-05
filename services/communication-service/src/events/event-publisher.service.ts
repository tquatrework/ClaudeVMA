import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, IsNull, Repository } from 'typeorm';
import Redis from 'ioredis';
import { randomUUID } from 'crypto';
import { DomainEvent } from './entities/domain-event.entity';
import { REDIS_CLIENT } from './redis-client.provider';

export const VISIOMATH_EVENTS_STREAM = 'visiomath:events';
const PUBLISH_INTERVAL_MS = 2000;
const PUBLISH_BATCH_SIZE = 20;

/**
 * Transactional outbox writer + background publisher.
 *
 * `record()` is called from within the same DB transaction as the business write it describes
 * (contact request created/accepted/declined) — see docs/architecture/contacts-messagerie.md,
 * point 9. A background loop then `XADD`s unpublished rows onto `visiomath:events` and stamps
 * `publishedAt`, exactly like teacher-request-service's `EventPublisher` (arbitrage du
 * 2026-08-12) — replicated here, not reinvented.
 */
@Injectable()
export class EventPublisherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventPublisherService.name);
  private timer: NodeJS.Timeout | null = null;
  private publishing = false;

  constructor(
    @InjectRepository(DomainEvent)
    private readonly domainEventRepository: Repository<DomainEvent>,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => void this.publishPending(), PUBLISH_INTERVAL_MS);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    // Without this, ioredis's default indefinite reconnection strategy keeps a background
    // timer alive and the process never exits cleanly (observed hanging the e2e Jest run).
    this.redis.disconnect();
  }

  /**
   * Record a domain event in the outbox, within the caller's transaction (via the shared
   * EntityManager). Never publishes synchronously — the background loop does, so a request
   * never blocks on Redis availability.
   */
  async record(
    manager: EntityManager,
    eventName: string,
    aggregateType: string,
    aggregateId: string,
    payload: Record<string, unknown>,
    correlationId: string | null = null,
  ): Promise<void> {
    const repository = manager.getRepository(DomainEvent);
    await repository.save(
      repository.create({ eventName, aggregateType, aggregateId, payload, correlationId }),
    );
  }

  private async publishPending(): Promise<void> {
    if (this.publishing) return;
    this.publishing = true;
    try {
      // Bug fixed 2026-09-05 (see docs/services/communication-service.md): a raw `null` literal
      // here is silently dropped by this TypeORM version when building the WHERE clause — the
      // query executed in production had *no* filter at all (`SELECT ... ORDER BY occurred_at
      // ASC LIMIT 20`, verified via pg_stat_activity), so every tick re-published every row in
      // the table, published or not, forever. `IsNull()` is the operator TypeORM actually
      // translates into `published_at IS NULL`.
      const pending = await this.domainEventRepository.find({
        where: { publishedAt: IsNull() },
        order: { occurredAt: 'ASC' },
        take: PUBLISH_BATCH_SIZE,
      });

      for (const event of pending) {
        try {
          await this.redis.xadd(
            VISIOMATH_EVENTS_STREAM,
            '*',
            'eventId',
            event.id ?? randomUUID(),
            'eventName',
            event.eventName,
            'aggregateType',
            event.aggregateType,
            'aggregateId',
            event.aggregateId,
            'correlationId',
            event.correlationId ?? '',
            'occurredAt',
            event.occurredAt.toISOString(),
            'payload',
            JSON.stringify(event.payload),
          );
          await this.domainEventRepository.update({ id: event.id }, { publishedAt: new Date() });
        } catch (error) {
          this.logger.error(`Failed to publish event ${event.id} (${event.eventName}): ${error}`);
        }
      }
    } catch (error) {
      // Defensive: a failure here (e.g. fetching the pending batch) used to be an unhandled
      // promise rejection with zero logging, since `onModuleInit` fires this via
      // `void this.publishPending()`. Surfacing it explicitly makes a future regression of this
      // kind visible instead of silently starving the publisher loop.
      this.logger.error(`Failed to fetch pending domain events: ${error}`);
    } finally {
      this.publishing = false;
    }
  }
}
