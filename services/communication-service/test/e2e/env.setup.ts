/**
 * Jest `setupFiles` entry for e2e tests.
 *
 * `ConfigModule.forRoot({ validate })` reads `process.env` synchronously as
 * soon as `src/app.module.ts` is evaluated (i.e. at import time, before any
 * `beforeAll`/test body runs). This file therefore prepares every required
 * environment variable *before* Jest requires the spec files, which is the
 * only point guaranteed to run ahead of `import '../../src/app.module'`.
 *
 * Values already present in the environment (e.g. injected by CI) are kept.
 */
import * as path from 'path';
import * as fs from 'fs';

export const TEST_JWT_SECRET = 'test_jwt_secret_for_e2e';
export const TEST_INTERNAL_SECRET = 'test_internal_secret';

function loadDotEnvTest(): void {
  const envFile = path.resolve(__dirname, '../../.env.test');
  if (!fs.existsSync(envFile)) return;

  const raw = fs.readFileSync(envFile, 'utf8');
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function buildLocalDatabaseUrl(): string {
  const host = process.env.TEST_DB_HOST ?? 'localhost';
  const port = process.env.TEST_DB_PORT ?? '5432';
  const name = process.env.TEST_DB_NAME ?? 'communication_test';
  const user = process.env.TEST_DB_USER ?? 'visiomath';
  const password = process.env.TEST_DB_PASSWORD ?? 'visiomath_secret';
  return `postgresql://${user}:${password}@${host}:${port}/${name}`;
}

loadDotEnvTest();
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = TEST_JWT_SECRET;
process.env.INTERNAL_SECRET = TEST_INTERNAL_SECRET;
process.env.DATABASE_URL = buildLocalDatabaseUrl();
