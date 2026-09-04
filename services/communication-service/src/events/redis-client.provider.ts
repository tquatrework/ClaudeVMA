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
      // Bounded (not null): a one-off XADD/XGROUP/XACK call must eventually fail rather than
      // queue forever if Redis is unreachable — important for the app to still boot (and for
      // this service's own e2e harness, which never runs Redis) even when the event pipeline
      // is degraded. Production resilience against a real outage comes from docker-compose's
      // `depends_on: redis: condition: service_healthy`, not from an infinite local retry here.
      maxRetriesPerRequest: 3,
      connectTimeout: 5000,
      lazyConnect: true,
    });
    client.connect().catch((error) => logger.warn(`Initial Redis connection failed: ${error.message}`));
    client.on('error', (error) => logger.error(`Redis connection error: ${error.message}`));
    return client;
  },
  inject: [ConfigService],
};
