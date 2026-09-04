import { Provider, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

const logger = new Logger('RedisClient');

/**
 * Single shared ioredis connection, reused by EventPublisherService (XADD) and
 * EventConsumerService (XREADGROUP/XACK/XAUTOCLAIM) — same stream `visiomath:events`
 * already used by teacher-request-service / dashboard-notification-service (2026-08-14).
 */
export const RedisClientProvider: Provider = {
  provide: REDIS_CLIENT,
  useFactory: (config: ConfigService) => {
    const client = new Redis(config.getOrThrow<string>('REDIS_URL'), {
      maxRetriesPerRequest: null,
    });
    client.on('error', (error) => logger.error(`Redis connection error: ${error.message}`));
    return client;
  },
  inject: [ConfigService],
};
