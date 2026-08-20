import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Interval } from '@nestjs/schedule';
import Redis from 'ioredis';
import { EventProcessorService } from './event-processor.service';
import {
  STREAM_NAME,
  CONSUMER_GROUP,
  RECLAIM_CONSUMER,
  RECLAIM_IDLE_MS,
  fieldsToRecord,
} from './redis-stream.constants';

/**
 * Passe périodique de réclamation (`XAUTOCLAIM`, toutes les 30s) des entrées
 * restées non acquittées plus de 60s — crash du consommateur principal, ou échec
 * transitoire d'un appel à profile-service/calendar-service. Même mécanisme que
 * dashboard-notification-service (docs/architecture.md, "Systeme de notifications
 * transversal"). Connexion Redis dédiée, distincte de la boucle bloquante.
 */
@Injectable()
export class EventStreamReclaimService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventStreamReclaimService.name);
  private redis: Redis | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly processor: EventProcessorService,
  ) {}

  onModuleInit(): void {
    const url = this.config.get<string>('REDIS_URL');
    if (!url) {
      return;
    }
    this.redis = new Redis(url);
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis?.quit();
  }

  @Interval(30000)
  async reclaimStuckEntries(): Promise<void> {
    if (!this.redis) {
      return;
    }

    try {
      const result = (await this.redis.xautoclaim(
        STREAM_NAME,
        CONSUMER_GROUP,
        RECLAIM_CONSUMER,
        RECLAIM_IDLE_MS,
        '0',
      )) as unknown as [string, [string, string[]][], string[]];

      const entries = result[1] ?? [];

      for (const [redisId, fields] of entries) {
        try {
          const record = fieldsToRecord(fields);
          await this.processor.process(record);
          await this.redis.xack(STREAM_NAME, CONSUMER_GROUP, redisId);
        } catch (error) {
          this.logger.error(
            `failed to reprocess reclaimed entry ${redisId}: ${(error as Error).message}`,
          );
        }
      }
    } catch (error) {
      this.logger.error(`XAUTOCLAIM failed: ${(error as Error).message}`);
    }
  }
}
