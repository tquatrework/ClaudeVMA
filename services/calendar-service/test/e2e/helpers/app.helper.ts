/**
 * Helper to bootstrap the NestJS application for e2e tests.
 *
 * Connects to a local PostgreSQL instance using variables from .env.test
 * (or environment variables already set by CI/CD).
 *
 * Default values (if .env.test is absent and no env vars are injected):
 *   TEST_DB_HOST     → localhost
 *   TEST_DB_PORT     → 5432
 *   TEST_DB_NAME     → calendar_test
 *   TEST_DB_USER     → visiomath
 *   TEST_DB_PASSWORD → visiomath_secret
 *
 * JWT tokens are signed with the same JWT_SECRET defined below
 * so that JwtAuthGuard accepts them during tests.
 */

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule, TestingModuleBuilder } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AppModule } from '../../../src/app.module';
import {
  ProfileRelationsClient,
  ProfileRelationsUnavailableError,
} from '../../../src/common/clients/profile-relations.client';
import {
  IdentityAccessClient,
  IdentityAccessUnavailableError,
} from '../../../src/common/clients/identity-access.client';
import { RelationSnapshot } from '../../../src/common/relations/relation-kind';
import * as jwt from 'jsonwebtoken';

export const TEST_JWT_SECRET = 'test_jwt_secret_for_e2e';
export const INTERNAL_SECRET = 'test_internal_secret';

function setStaticTestEnv(): void {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = TEST_JWT_SECRET;
  process.env.INTERNAL_SECRET = INTERNAL_SECRET;
  // Hôte volontairement non résolvable : les specs e2e qui exercent
  // GET /calendars/:ownerId/busy remplacent ProfileRelationsClient par un
  // faux (`overrideProfileRelationsClient`) plutôt que de joindre un vrai
  // profile-service. Les autres specs ne l'appellent jamais.
  process.env.PROFILE_SERVICE_URL =
    process.env.PROFILE_SERVICE_URL ?? 'http://profile-service.test:3002';
  // Même posture que PROFILE_SERVICE_URL ci-dessus : les specs e2e qui
  // exercent GET /calendars/:ownerId/busy remplacent IdentityAccessClient par
  // un faux (`overrideIdentityAccessClient`) plutôt que de joindre un vrai
  // identity-access-service.
  process.env.IDENTITY_ACCESS_SERVICE_URL =
    process.env.IDENTITY_ACCESS_SERVICE_URL ?? 'http://identity-access-service.test:3001';
}

function buildLocalDatabaseUrl(): string {
  const host     = process.env.TEST_DB_HOST     ?? 'localhost';
  const port     = process.env.TEST_DB_PORT     ?? '5432';
  const name     = process.env.TEST_DB_NAME     ?? 'calendar_test';
  const user     = process.env.TEST_DB_USER     ?? 'visiomath';
  const password = process.env.TEST_DB_PASSWORD ?? 'visiomath_secret';
  return `postgresql://${user}:${password}@${host}:${port}/${name}`;
}

/**
 * Load .env.test from the service root into process.env.
 * Variables already present in the environment are NOT overwritten
 * so that CI/CD can inject its own values.
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
 * Fake `ProfileRelationsClient`, injectable in e2e specs that exercise
 * `GET /calendars/:ownerId/busy` — la vraie relation métier vit dans
 * `profile-service`, hors de portée d'un e2e de `calendar-service` isolé.
 * `resolveRelations` renvoie ce que le test y a placé via `setSnapshot`
 * (ou lève `ProfileRelationsUnavailableError` via `setUnavailable`), pour
 * couvrir aussi bien la matrice de politique que le cas 503.
 */
export class FakeProfileRelationsClient {
  private snapshotsByKey = new Map<string, RelationSnapshot>();
  private unavailable = false;

  setSnapshot(viewerId: string, targetId: string, snapshot: RelationSnapshot): void {
    this.snapshotsByKey.set(`${viewerId}:${targetId}`, snapshot);
  }

  setUnavailable(value: boolean): void {
    this.unavailable = value;
  }

  async resolveRelations(
    viewerId: string,
    targetId: string,
    _viewerRole: string,
    _correlationId?: string,
  ): Promise<RelationSnapshot> {
    if (this.unavailable) {
      throw new ProfileRelationsUnavailableError('profile-service unreachable (test double)');
    }
    const snapshot = this.snapshotsByKey.get(`${viewerId}:${targetId}`);
    if (snapshot) return snapshot;
    return {
      viewerId,
      targetId,
      isSelf: viewerId === targetId,
      isAdministrator: false,
      relations: [],
    };
  }
}

/**
 * Fake `IdentityAccessClient`, injectable en e2e à côté de
 * `FakeProfileRelationsClient` — même modèle. Le rôle réel du titulaire
 * vit dans `identity-access-service`, hors de portée d'un e2e de
 * `calendar-service` isolé. `resolveRole` renvoie ce que le test y a placé
 * via `setRole` (défaut : `undefined`, compte inconnu — reproduit
 * exactement CAL-FB-004 : un titulaire jamais résolu doit rester en repli
 * fermé), ou lève `IdentityAccessUnavailableError` via `setUnavailable`.
 */
export class FakeIdentityAccessClient {
  private rolesByUserId = new Map<string, string>();
  private unavailable = false;

  setRole(userId: string, role: string): void {
    this.rolesByUserId.set(userId, role);
  }

  setUnavailable(value: boolean): void {
    this.unavailable = value;
  }

  async resolveRole(userId: string, _correlationId?: string): Promise<string | undefined> {
    if (this.unavailable) {
      throw new IdentityAccessUnavailableError('identity-access-service unreachable (test double)');
    }
    return this.rolesByUserId.get(userId);
  }
}

async function buildTestApp(
  moduleBuilder: (base: TestingModuleBuilder) => TestingModuleBuilder,
): Promise<INestApplication> {
  loadDotEnvTest();
  setStaticTestEnv();

  process.env.DATABASE_URL = buildLocalDatabaseUrl();

  const base = Test.createTestingModule({ imports: [AppModule] });
  const moduleFixture: TestingModule = await moduleBuilder(base).compile();

  const app = moduleFixture.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  await app.init();

  // Drop the public schema entirely (removes tables AND enum types) then recreate.
  // This avoids the PostgreSQL "type already exists" error that occurs when
  // synchronize(true) drops tables but leaves orphaned enum types behind.
  // After recreation, restore the uuid-ossp extension so uuid_generate_v4() is available.
  const dataSource = app.get<DataSource>(getDataSourceToken());
  await dataSource.query('DROP SCHEMA public CASCADE');
  await dataSource.query('CREATE SCHEMA public');
  await dataSource.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
  await dataSource.synchronize();

  return app;
}

/**
 * Build and start a test application instance backed by a local PostgreSQL database.
 * The schema is reset via synchronize(true) before each suite so tests stay independent.
 */
export async function createTestApp(): Promise<INestApplication> {
  return buildTestApp((base) => base);
}

/**
 * Même bootstrap que `createTestApp`, avec `ProfileRelationsClient` remplacé
 * par un faux contrôlable — réservé aux specs qui exercent
 * `GET /calendars/:ownerId/busy` (sur le modèle de
 * `teacher-request-service/test/e2e/helpers/app.helper.ts`, qui override
 * `ProfileServiceClient` de la même façon).
 */
export async function createTestAppWithFakeProfileRelations(): Promise<{
  app: INestApplication;
  profileRelations: FakeProfileRelationsClient;
  identityAccess: FakeIdentityAccessClient;
}> {
  const profileRelations = new FakeProfileRelationsClient();
  const identityAccess = new FakeIdentityAccessClient();
  const app = await buildTestApp((base) =>
    base
      .overrideProvider(ProfileRelationsClient)
      .useValue(profileRelations)
      .overrideProvider(IdentityAccessClient)
      .useValue(identityAccess),
  );
  return { app, profileRelations, identityAccess };
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
 * All values are valid RFC 4122 v4 UUIDs so they pass @IsUUID('4') validation.
 */
export const IDS = {
  student1: 'f841ccff-a112-4df8-9dc3-f875c995507d',
  student2: 'c1ec1f5c-bbe0-45a2-ac52-b8732878ffe1',
  parent1:  '5103b232-6f79-4f11-9e37-cb56af21ac13',
  teacher1: '47a5808b-66c7-41c9-92cd-7367d1cda003',
  teacher2: '39573f2a-d0f3-4864-9b03-bac893137100',
  rp1:      '60eff2e3-586f-4f6f-a37c-accad1676ccf',
  ap1:      '88d58936-a2ac-4323-827d-6b3e90709b9f',
  adminFin: '076a452f-3f72-428c-9563-f2a0f9fe5f35',
  ti:       '972ba620-44bf-45ea-82df-8a80357d349f',
  unknown:  '8769d2b1-4e58-4de0-a7c1-bcde7e5b0c12',
};
