/**
 * Must be imported before any module that (transitively) imports AppModule.
 * AppModule's ConfigModule.forRoot({ validate }) runs its env validation
 * synchronously at module-definition time (i.e. as soon as app.module.ts is
 * required), which happens before any `beforeAll` hook runs. Env variables
 * therefore have to be set here, at import time, rather than inside a hook.
 */
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/dashboard_notification_test';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-jwt-secret';
process.env.INTERNAL_SECRET = process.env.INTERNAL_SECRET ?? 'test-internal-secret';
// Required since 2026-08-14 by env.validation.ts (Redis event consumer +
// profile-service client). AppModule boots EventsModule's
// EventStreamConsumerService/EventStreamReclaimService, which will try to
// reach these — the e2e suite already requires a real Postgres and is not
// wired to any npm script (see docs/services/dashboard-notification-service.md
// "points en suspens"); a real Redis and profile-service are the same kind
// of prerequisite, not a new one.
process.env.REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
process.env.PROFILE_SERVICE_URL = process.env.PROFILE_SERVICE_URL ?? 'http://localhost:3002';
process.env.NODE_ENV = 'test';
