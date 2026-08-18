import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThan, Repository } from 'typeorm';
import Redis from 'ioredis';

import { DomainEvent } from './entities/domain-event.entity';

/**
 * Flux Redis sur lequel les evenements metier de la plateforme sont publies.
 * Meme flux que `teacher-request-service` — un seul stream `visiomath:events`
 * pour toute la plateforme (arbitrage du 2026-08-14, « Systeme de
 * notifications transversal », point 1 : « generique pour les autres flux »).
 */
export const EVENT_STREAM_KEY = 'visiomath:events';

const FLUSH_INTERVAL_MS = 5000;
const FLUSH_BATCH_SIZE = 100;
const MAX_PUBLISH_ATTEMPTS = 20;

/**
 * Deuxieme temps du patron « outbox » : remet au bus les evenements deja
 * ecrits en base par `EventsService`.
 *
 * Copie fidele de `teacher-request-service/src/events/event-publisher.service.ts` —
 * meme flux Redis, meme format `XADD`, meme comportement en l'absence de
 * `REDIS_URL` (rien n'est publie, rien n'est perdu : les evenements restent
 * en attente dans `domain_events`). `dashboard-notification-service`, deja
 * consommateur de ce flux pour `teacher-request-service`, pourra s'abonner à
 * ces evenements sans aucun changement de son cote.
 */
@Injectable()
export class EventPublisher implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventPublisher.name);
  private readonly redisUrl?: string;
  private redisClient: Redis | null = null;
  private flushTimer: NodeJS.Timeout | null = null;
  private isFlushing = false;

  constructor(
    @InjectRepository(DomainEvent) private readonly eventRepo: Repository<DomainEvent>,
    config: ConfigService,
  ) {
    this.redisUrl = config.get<string>('REDIS_URL');
  }

  onModuleInit(): void {
    if (!this.redisUrl) {
      this.logger.warn(
        "REDIS_URL absent : les evenements sont conserves dans domain_events et seront publies des qu'un bus sera configure.",
      );
      return;
    }
    this.redisClient = new Redis(this.redisUrl, { maxRetriesPerRequest: 3, lazyConnect: false });
    this.redisClient.on('error', (error: Error) => this.logger.warn(`Bus indisponible : ${error.message}`));
    this.flushTimer = setInterval(() => void this.flushPendingEvents(), FLUSH_INTERVAL_MS);
    this.flushTimer.unref?.();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.flushTimer) clearInterval(this.flushTimer);
    if (this.redisClient) await this.redisClient.quit().catch(() => undefined);
  }

  /** Declenche une remise immediate, sans bloquer l'appelant. */
  scheduleFlush(): void {
    if (!this.redisClient) return;
    void this.flushPendingEvents();
  }

  /**
   * Publie les evenements en attente. Un evenement publie porte `publishedAt` :
   * il ne sera jamais republie. Un evenement qui echoue reste en attente et
   * voit son compteur de tentatives augmenter.
   */
  async flushPendingEvents(): Promise<number> {
    if (!this.redisClient || this.isFlushing) return 0;
    this.isFlushing = true;
    let publishedCount = 0;
    try {
      const pendingEvents = await this.eventRepo.find({
        where: { publishedAt: IsNull(), publishAttempts: LessThan(MAX_PUBLISH_ATTEMPTS) },
        order: { occurredAt: 'ASC' },
        take: FLUSH_BATCH_SIZE,
      });

      for (const pendingEvent of pendingEvents) {
        try {
          await this.redisClient.xadd(
            EVENT_STREAM_KEY,
            '*',
            'eventId',
            pendingEvent.id,
            'eventName',
            pendingEvent.eventName,
            'aggregateType',
            pendingEvent.aggregateType,
            'aggregateId',
            pendingEvent.aggregateId,
            'correlationId',
            pendingEvent.correlationId ?? '',
            'occurredAt',
            pendingEvent.occurredAt.toISOString(),
            'payload',
            JSON.stringify(pendingEvent.payload),
          );
          await this.eventRepo.update(pendingEvent.id, { publishedAt: new Date() });
          publishedCount += 1;
        } catch (error) {
          await this.eventRepo.update(pendingEvent.id, {
            publishAttempts: pendingEvent.publishAttempts + 1,
          });
          this.logger.warn(
            `Publication differee de ${pendingEvent.eventName} (${pendingEvent.id}) : ${(error as Error).message}`,
          );
          break;
        }
      }
    } finally {
      this.isFlushing = false;
    }
    return publishedCount;
  }
}
