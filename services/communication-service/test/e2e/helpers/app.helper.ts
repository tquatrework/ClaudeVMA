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
import { DataSource, Repository } from 'typeorm';
import { Client } from 'pg';
import { AppModule } from '../../../src/app.module';
import * as jwt from 'jsonwebtoken';
import { TEST_JWT_SECRET, TEST_INTERNAL_SECRET } from '../env.setup';
import { Contact } from '../../../src/contact/entities/contact.entity';
import { ContactRequest } from '../../../src/contact/entities/contact-request.entity';

export { TEST_JWT_SECRET, TEST_INTERNAL_SECRET };

/**
 * Build and start a test application instance backed by a local PostgreSQL database.
 * The schema is reset before each suite so tests stay independent.
 *
 * `overrideProviders` lets a spec stub outbound HTTP clients (ProfileServiceClient,
 * IdentityAccessClient) instead of hitting real services that aren't running in this harness —
 * standard Nest DI override, not a network mock.
 */
export async function createTestApp(
  overrideProviders: Array<{ provide: unknown; useValue: unknown }> = [],
): Promise<INestApplication> {
  // Drop the public schema entirely (removes tables, enum types, AND TypeORM's own
  // `migrations` bookkeeping table) BEFORE the Nest app is built. `app.init()` below triggers
  // TypeOrmModule's connection, which now runs `migrationsRun: true` (AppModule) — it must see
  // an empty schema, otherwise a previous spec file's leftover tables (created by this same
  // helper's own `synchronize()` a few lines down) collide with the migration's `CREATE TABLE`.
  await resetSchema();

  const builder = Test.createTestingModule({ imports: [AppModule] });
  for (const override of overrideProviders) {
    builder.overrideProvider(override.provide).useValue(override.useValue);
  }
  const moduleFixture: TestingModule = await builder.compile();

  const app = moduleFixture.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();

  // Migrations (run above, during app.init()) only cover contacts/contact_requests/
  // domain_events/processed_events. `synchronize()` fills in the remaining entities
  // (conversations, messages, incident_threads) that have no migration yet — see
  // "Points en suspens" in docs/services/communication-service.md. It leaves the
  // already-migrated tables untouched since they already match their entity metadata.
  const dataSource = app.get<DataSource>(getDataSourceToken());
  await dataSource.synchronize();

  return app;
}

async function resetSchema(): Promise<void> {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query('DROP SCHEMA public CASCADE');
    await client.query('CREATE SCHEMA public');
    await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
  } finally {
    await client.end();
  }
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
 * Direct repository access for test-only seeding (e.g. inserting an ACTIVE Contact directly,
 * standing in for the Redis-derived default-contact flow that e2e tests don't exercise
 * end-to-end) — the public API intentionally does not expose a way to fabricate a contact.
 */
export function getContactRepository(app: INestApplication): Repository<Contact> {
  const dataSource = app.get<DataSource>(getDataSourceToken());
  return dataSource.getRepository(Contact);
}

export function getContactRequestRepository(app: INestApplication): Repository<ContactRequest> {
  const dataSource = app.get<DataSource>(getDataSourceToken());
  return dataSource.getRepository(ContactRequest);
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
