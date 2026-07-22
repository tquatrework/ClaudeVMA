/**
 * Helper to bootstrap the NestJS application for e2e tests.
 *
 * Environment variables (DATABASE_URL, JWT_SECRET, INTERNAL_SECRET, NODE_ENV)
 * are prepared by `test/e2e/env.setup.ts` (Jest `setupFiles`), which runs
 * before this file — and `src/app.module.ts` — are ever imported. This file
 * only builds and tears down the Nest application.
 */

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AppModule } from '../../../src/app.module';
import * as jwt from 'jsonwebtoken';
import { TEST_JWT_SECRET } from '../env.setup';

export { TEST_JWT_SECRET };

/**
 * Build and start a test application instance backed by a local PostgreSQL database.
 * The schema is reset before each suite so tests stay independent.
 */
export async function createTestApp(): Promise<INestApplication> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
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
  student1:  'f841ccff-a112-4df8-9dc3-f875c995507d',
  student2:  'c1ec1f5c-bbe0-45a2-ac52-b8732878ffe1',
  parent1:   '5103b232-6f79-4f11-9e37-cb56af21ac13',
  teacher1:  '47a5808b-66c7-41c9-92cd-7367d1cda003',
  teacher2:  '39573f2a-d0f3-4864-9b03-bac893137100',
  rp1:       '60eff2e3-586f-4f6f-a37c-accad1676ccf',
  ap1:       '88d58936-a2ac-4323-827d-6b3e90709b9f',
  ti:        '972ba620-44bf-45ea-82df-8a80357d349f',
  unknown:   '8769d2b1-4e58-4de0-a7c1-bcde7e5b0c12',
};
