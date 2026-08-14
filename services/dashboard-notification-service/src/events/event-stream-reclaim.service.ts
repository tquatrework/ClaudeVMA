import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { EventProcessorService } from './event-processor.service';
import { EVENT_STREAM_CONSUMER_GROUP, EVENT_STREAM_KEY, RawStreamEntry, fieldsToRecord } from './redis-stream.constants';

const RECLAIM_INTERVAL_MS = 30_000;
const MIN_IDLE_TIME_MS = 60_000;
const RECLAIM_COUNT = 10;

type XAutoClaimResponse = [string, RawStreamEntry[], string[]?];

/**
 * Periodic safety net for `EventStreamConsumerService`: entries left
 * unacknowledged (a crash mid-processing, or a transient failure such as
 * profile-service being briefly unreachable) are reclaimed via
 * `XAUTOCLAIM` once they have been pending for longer than
 * `MIN_IDLE_TIME_MS`, then handed back to `EventProcessorService` exactly
 * like a fresh delivery. This is what actually retries a stream entry
 * that `EventProcessorService.process()` rejected — the main consumer
 * loop only reads new ('>') entries and never re-reads its own pending
 * ones.
 *
 * Runs on `@nestjs/schedule`'s `@Interval`, on a Redis connection of its
 * own (a blocking XREADGROUP and XAUTOCLAIM must not share a connection).
 */
@Injectable()
export class EventStreamReclaimService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventStreamReclaimService.name);
  private client: Redis;
  private consumerName: string;
  private running = false;

  constructor(
    private readonly config: ConfigService,
    private readonly processor: EventProcessorService,
  ) {}

  onModuleInit(): void {
    const redisUrl = this.config.getOrThrow<string>('REDIS_URL');
    this.client = new Redis(redisUrl);
    this.client.on('error', (error) => this.logger.error(`Redis connection error (reclaim): ${error.message}`));
    this.consumerName = `${EVENT_STREAM_CONSUMER_GROUP}-reclaim-${process.pid}`;
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      this.client.disconnect();
    }
  }

  @Interval(RECLAIM_INTERVAL_MS)
  async reclaimStuckEntries(): Promise<void> {
    if (!this.client || this.running) {
      return; // Not initialized yet, or a previous pass is still running.
    }
    this.running = true;
    try {
      const response = (await this.client.xautoclaim(
        EVENT_STREAM_KEY,
        EVENT_STREAM_CONSUMER_GROUP,
        this.consumerName,
        MIN_IDLE_TIME_MS,
        '0-0',
        'COUNT',
        RECLAIM_COUNT,
      )) as XAutoClaimResponse;

      const [, claimedEntries] = response;
      for (const [entryId, fields] of claimedEntries) {
        if (fields.length === 0) {
          // Tombstone: the entry was deleted from the stream since it was claimed.
          continue;
        }
        const record = fieldsToRecord(fields);
        try {
          await this.processor.process(record);
          await this.client.xack(EVENT_STREAM_KEY, EVENT_STREAM_CONSUMER_GROUP, entryId);
          this.logger.log(`Reclaimed and processed stuck entry ${entryId} (${record.eventName ?? 'unknown'}).`);
        } catch (error) {
          this.logger.error(
            `Reclaimed entry ${entryId} (${record.eventName ?? 'unknown'}) still fails: ${(error as Error).message} — will retry next pass.`,
          );
        }
      }
    } catch (error) {
      this.logger.error(`XAUTOCLAIM pass failed: ${(error as Error).message}`);
    } finally {
      this.running = false;
    }
  }
}
