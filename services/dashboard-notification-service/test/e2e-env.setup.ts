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
process.env.NODE_ENV = 'test';
