import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { EventProcessorService } from './event-processor.service';
import { EVENT_STREAM_CONSUMER_GROUP, EVENT_STREAM_KEY, RawStreamEntry, fieldsToRecord } from './redis-stream.constants';

type XReadGroupResponse = Array<[string, RawStreamEntry[]]> | null;

const READ_BLOCK_MS = 5000;
const READ_COUNT = 10;
const RECONNECT_BACKOFF_MS = 1000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Consumer group loop over the Redis stream `visiomath:events`
 * (`XGROUP`/`XREADGROUP`/`XACK`), started at `onModuleInit` and stopped at
 * `onModuleDestroy`. See docs/architecture.md > "Systeme de notifications
 * transversal" for the full contract this implements.
 *
 * Group creation starts from `0` (beginning of the stream), not `$`
 * (only-new-messages): `teacher-request-service` has been publishing to
 * this stream since 2026-08-12 with no consumer attached, and the
 * project's own arbitrage insists on an at-least-once guarantee — nothing
 * published before this consumer existed should be silently skipped.
 * `EventProcessorService`'s idempotency table makes replaying the whole
 * history safe.
 */
@Injectable()
export class EventStreamConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventStreamConsumerService.name);
  private client: Redis;
  private consumerName: string;
  private stopped = false;
  private loopPromise: Promise<void> | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly processor: EventProcessorService,
  ) {}

  async onModuleInit(): Promise<void> {
    const redisUrl = this.config.getOrThrow<string>('REDIS_URL');
    this.client = new Redis(redisUrl);
    this.client.on('error', (error) => this.logger.error(`Redis connection error: ${error.message}`));
    this.consumerName = `${EVENT_STREAM_CONSUMER_GROUP}-${process.pid}`;
    await this.ensureConsumerGroup();
    this.loopPromise = this.runLoop();
  }

  async onModuleDestroy(): Promise<void> {
    this.stopped = true;
    if (this.client) {
      // Unblocks a pending XREADGROUP BLOCK call so the loop can exit.
      this.client.disconnect();
    }
    if (this.loopPromise) {
      await this.loopPromise.catch(() => undefined);
    }
  }

  private async ensureConsumerGroup(): Promise<void> {
    try {
      await this.client.xgroup('CREATE', EVENT_STREAM_KEY, EVENT_STREAM_CONSUMER_GROUP, '0', 'MKSTREAM');
      this.logger.log(`Created consumer group "${EVENT_STREAM_CONSUMER_GROUP}" on stream "${EVENT_STREAM_KEY}".`);
    } catch (error) {
      if (error instanceof Error && error.message.includes('BUSYGROUP')) {
        // Idempotent setup: the group already exists from a previous boot.
        return;
      }
      throw error;
    }
  }

  private async runLoop(): Promise<void> {
    while (!this.stopped) {
      try {
        const response = (await this.client.xreadgroup(
          'GROUP',
          EVENT_STREAM_CONSUMER_GROUP,
          this.consumerName,
          'COUNT',
          READ_COUNT,
          'BLOCK',
          READ_BLOCK_MS,
          'STREAMS',
          EVENT_STREAM_KEY,
          '>',
        )) as XReadGroupResponse;

        if (!response) {
          continue; // BLOCK timed out with no new entries — loop again.
        }

        await this.handleEntries(response);
      } catch (error) {
        if (this.stopped) {
          return;
        }
        this.logger.error(`Stream read failed, backing off ${RECONNECT_BACKOFF_MS}ms: ${(error as Error).message}`);
        await sleep(RECONNECT_BACKOFF_MS);
      }
    }
  }

  private async handleEntries(response: Array<[string, RawStreamEntry[]]>): Promise<void> {
    for (const [, entries] of response) {
      for (const [entryId, fields] of entries) {
        const record = fieldsToRecord(fields);
        try {
          await this.processor.process(record);
          await this.client.xack(EVENT_STREAM_KEY, EVENT_STREAM_CONSUMER_GROUP, entryId);
        } catch (error) {
          this.logger.error(
            `Failed to process stream entry ${entryId} (${record.eventName ?? 'unknown'}): ` +
              `${(error as Error).message} — left unacknowledged, will be retried via XAUTOCLAIM.`,
          );
        }
      }
    }
  }
}
