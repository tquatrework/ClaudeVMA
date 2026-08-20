import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { EventProcessorService } from './event-processor.service';
import {
  STREAM_NAME,
  CONSUMER_GROUP,
  CONSUMER_NAME,
  fieldsToRecord,
} from './redis-stream.constants';

/**
 * Consommateur principal du flux Redis `visiomath:events` (docs/architecture.md,
 * "Systeme de notifications transversal", généralisé à ce service pour le point 5
 * de la refonte du cahier de texte). `XGROUP`/`XREADGROUP BLOCK`/`XACK`, groupe
 * démarré à `0` (pas `$`) pour ne perdre aucun événement publié avant que ce
 * consommateur n'existe — sûr grâce à la déduplication par eventId.
 *
 * Sans REDIS_URL configurée, ce consommateur reste désactivé : aucune entrée
 * automatique de cahier de texte ne sera créée, journalisé en avertissement au
 * démarrage plutôt que de faire échouer le boot de l'application.
 */
@Injectable()
export class EventStreamConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventStreamConsumerService.name);
  private redis: Redis | null = null;
  private running = false;

  constructor(
    private readonly config: ConfigService,
    private readonly processor: EventProcessorService,
  ) {}

  async onModuleInit(): Promise<void> {
    const url = this.config.get<string>('REDIS_URL');
    if (!url) {
      this.logger.warn(
        'REDIS_URL not configured — event consumer disabled, no automatic pedagogical log entries will be created',
      );
      return;
    }

    this.redis = new Redis(url);
    await this.ensureConsumerGroup();
    this.running = true;
    this.loop().catch((error) => {
      this.logger.error(`consumer loop crashed: ${(error as Error).message}`);
    });
  }

  async onModuleDestroy(): Promise<void> {
    this.running = false;
    await this.redis?.quit();
  }

  private async ensureConsumerGroup(): Promise<void> {
    try {
      await this.redis!.xgroup('CREATE', STREAM_NAME, CONSUMER_GROUP, '0', 'MKSTREAM');
    } catch (error) {
      if (!(error as Error).message.includes('BUSYGROUP')) {
        throw error;
      }
    }
  }

  private async loop(): Promise<void> {
    while (this.running) {
      const response = await this.redis!.xreadgroup(
        'GROUP',
        CONSUMER_GROUP,
        CONSUMER_NAME,
        'COUNT',
        10,
        'BLOCK',
        5000,
        'STREAMS',
        STREAM_NAME,
        '>',
      );

      if (!response) {
        continue;
      }

      await this.handleEntries(response as unknown as [string, [string, string[]][]][]);
    }
  }

  async handleEntries(response: [string, [string, string[]][]][]): Promise<void> {
    for (const [, entries] of response) {
      for (const [redisId, fields] of entries) {
        await this.processEntry(redisId, fields);
      }
    }
  }

  private async processEntry(redisId: string, fields: string[]): Promise<void> {
    try {
      const record = fieldsToRecord(fields);
      await this.processor.process(record);
      await this.redis!.xack(STREAM_NAME, CONSUMER_GROUP, redisId);
    } catch (error) {
      this.logger.error(
        `failed to process stream entry ${redisId}: ${(error as Error).message} — left unacknowledged for reclaim`,
      );
    }
  }
}
