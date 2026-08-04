/**
 * Jest `setupFiles` entry.
 *
 * `ConfigModule.forRoot({ validate })` runs synchronously as soon as
 * `AppModule` is evaluated (i.e. at `import` time), which happens before
 * any `beforeAll`/test body runs. This file guarantees the required
 * environment variables already exist in `process.env` by the time any
 * spec file imports `AppModule` (directly or via `test/e2e/helpers/app.helper.ts`).
 *
 * Values mirror the defaults in `test/e2e/helpers/app.helper.ts` so real
 * CI-injected variables are never overridden (only filled in if absent).
 */

process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test_jwt_secret_for_e2e';

if (!process.env.DATABASE_URL) {
  const host = process.env.TEST_DB_HOST ?? 'localhost';
  const port = process.env.TEST_DB_PORT ?? '5432';
  const name = process.env.TEST_DB_NAME ?? 'calendar_test';
  const user = process.env.TEST_DB_USER ?? 'visiomath';
  const password = process.env.TEST_DB_PASSWORD ?? 'visiomath_secret';
  process.env.DATABASE_URL = `postgresql://${user}:${password}@${host}:${port}/${name}`;
}
