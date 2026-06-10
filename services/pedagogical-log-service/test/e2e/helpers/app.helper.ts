/**
 * Helper to bootstrap the NestJS application for e2e tests.
 *
 * Connects to a local PostgreSQL instance using variables from .env.test
 * (or environment variables already set by CI/CD).
 *
 * Default values (if .env.test is absent and no env vars are injected):
 *   TEST_DB_HOST     → localhost
 *   TEST_DB_PORT     → 5432
 *   TEST_DB_NAME     → pedagogical_log_test
 *   TEST_DB_USER     → visiomath
 *   TEST_DB_PASSWORD → visiomath_secret
 *
 * JWT tokens are signed with the same JWT_SECRET defined below
 * so that JwtAuthGuard accepts them during tests.
 */

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AppModule } from '../../../src/app.module';
import * as jwt from 'jsonwebtoken';

export const TEST_JWT_SECRET = 'test_jwt_secret_for_e2e';

function setStaticTestEnv(): void {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = TEST_JWT_SECRET;
}

function buildLocalDatabaseUrl(): string {
  const host     = process.env.TEST_DB_HOST     ?? 'localhost';
  const port     = process.env.TEST_DB_PORT     ?? '5432';
  const name     = process.env.TEST_DB_NAME     ?? 'pedagogical_log_test';
  const user     = process.env.TEST_DB_USER     ?? 'visiomath';
  const password = process.env.TEST_DB_PASSWORD ?? 'visiomath_secret';
  return `postgresql://${user}:${password}@${host}:${port}/${name}`;
}

/**
 * Load .env.test from the service root into process.env.
 * Variables already present in the environment are NOT overwritten.
 */
function loadDotEnvTest(): void {
  const path = require('path') as typeof import('path');
  const fs   = require('fs')   as typeof import('fs');

  const envFile = path.resolve(__dirname, '../../../.env.test');
  if (!fs.existsSync(envFile)) return;

  const raw = fs.readFileSync(envFile, 'utf8');
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key   = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

/**
 * Build and start a test application instance backed by a local PostgreSQL database.
 * The schema is reset before each suite so tests stay independent.
 */
export async function createTestApp(): Promise<INestApplication> {
  loadDotEnvTest();
  setStaticTestEnv();

  process.env.DATABASE_URL = buildLocalDatabaseUrl();

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  await app.init();

  // Drop the public schema entirely (removes tables AND enum types) then recreate.
  const dataSource = app.get<DataSource>(getDataSourceToken());
  await dataSource.query('DROP SCHEMA public CASCADE');
  await dataSource.query('CREATE SCHEMA public');
  await dataSource.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
  await dataSource.synchronize();

  return app;
}

/**
 * Generate a signed JWT access token for the given role and userId.
 * Mirrors the token shape expected by JwtAuthGuard in the service.
 */
export function makeJwt(
  userId: string,
  role: string,
  secret: string = TEST_JWT_SECRET,
): string {
  return jwt.sign(
    {
      sub: userId,
      role,
      type: 'access',
    },
    secret,
    { expiresIn: '1h' },
  );
}

/**
 * UUID v4 helpers for readable test data.
 * All values are valid RFC 4122 v4 UUIDs.
 */
export const IDS = {
  student1: 'f841ccff-a112-4df8-9dc3-f875c995507d',
  student2: 'c1ec1f5c-bbe0-45a2-ac52-b8732878ffe1',
  parent1:  '5103b232-6f79-4f11-9e37-cb56af21ac13',
  teacher1: '47a5808b-66c7-41c9-92cd-7367d1cda003',
  teacher2: '39573f2a-d0f3-4864-9b03-bac893137100',
  rp1:      '60eff2e3-586f-4f6f-a37c-accad1676ccf',
  ap1:      '88d58936-a2ac-4323-827d-6b3e90709b9f',
  ti:       '972ba620-44bf-45ea-82df-8a80357d349f',
  unknown:  '8769d2b1-4e58-4de0-a7c1-bcde7e5b0c12',
};
