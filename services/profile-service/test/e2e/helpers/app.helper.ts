/**
 * Helper to bootstrap the NestJS application for e2e tests.
 *
 * Starts a real PostgreSQL container via testcontainers so that tests
 * run against a production-equivalent database engine.
 * Each call to createTestApp() starts a fresh container and stops it
 * in the returned teardown callback — isolating test suites from each other.
 *
 * FALLBACK (temporary): if USE_LOCAL_DB=true is set in the environment, or if
 * Testcontainers fails (e.g. no Docker socket access), the tests connect to a
 * local PostgreSQL instance using the following env vars (with defaults):
 *   TEST_DB_HOST     (default: localhost)
 *   TEST_DB_PORT     (default: 5432)
 *   TEST_DB_NAME     (default: profile_test)
 *   TEST_DB_USER     (default: visiomath)
 *   TEST_DB_PASSWORD (default: visiomath_secret)
 *
 * // TODO: remove when Testcontainers has Docker permissions
 *
 * JWT tokens are signed with the same JWT_SECRET defined below
 * so that JwtAuthGuard accepts them during tests.
 */

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  IdentityAccessClient,
  IdentityAccessNotFoundError,
  IdentityAccessUnavailableError,
  IdentityAccount,
} from '../../../src/common/clients/identity-access.client';
import * as jwt from 'jsonwebtoken';

export const TEST_JWT_SECRET = 'test_jwt_secret_for_e2e';
export const INTERNAL_SECRET = 'test_internal_secret';

/**
 * Minimal set of static environment variables required by profile-service.
 * DATABASE_URL is set dynamically once the container is started.
 */
function setStaticTestEnv(): void {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = TEST_JWT_SECRET;
  process.env.INTERNAL_SECRET = INTERNAL_SECRET;
}

/**
 * Build the DATABASE_URL for the local PostgreSQL fallback.
 * Reads TEST_DB_* variables from the environment (populated from .env.test).
 *
 * // TODO: remove when Testcontainers has Docker permissions
 */
function buildLocalDatabaseUrl(): string {
  const host     = process.env.TEST_DB_HOST     ?? 'localhost';
  const port     = process.env.TEST_DB_PORT     ?? '5432';
  const name     = process.env.TEST_DB_NAME     ?? 'profile_test';
  const user     = process.env.TEST_DB_USER     ?? 'visiomath';
  const password = process.env.TEST_DB_PASSWORD ?? 'visiomath_secret';
  return `postgresql://${user}:${password}@${host}:${port}/${name}`;
}

/**
 * In-memory stand-in for identity-access-service.
 *
 * No identity-access-service instance runs during e2e tests, so the real
 * IdentityAccessClient would always fail with a 3s network timeout. That made
 * the "account exists / account unknown" distinction — which now drives the
 * 404 vs 500 vs 200 outcome of GET /profiles/:userId — impossible to exercise.
 *
 * Default behaviour for a userId that was neither registered nor explicitly
 * marked unknown is IdentityAccessUnavailableError, i.e. exactly what the real
 * client produced before this stub existed (unreachable host), so suites that
 * do not care about identity-access keep their previous semantics — just
 * without the timeout.
 *
 * The real client's own transport behaviour (200/404/401/network) stays
 * covered by test/unit/common/identity-access.client.spec.ts.
 */
class IdentityAccessClientStub {
  private readonly accountsByUserId = new Map<string, IdentityAccount>();
  private readonly unknownUserIds = new Set<string>();

  /** Declares an existing account (identity-access-service answers 200). */
  registerAccount(userId: string, loginIdentifier: string, role: string): void {
    this.accountsByUserId.set(userId, { userId, loginIdentifier, role });
  }

  /** Declares a userId identity-access-service does not know (answers 404). */
  markAccountUnknown(userId: string): void {
    this.unknownUserIds.add(userId);
  }

  reset(): void {
    this.accountsByUserId.clear();
    this.unknownUserIds.clear();
  }

  async findAccountByUserId(userId: string): Promise<IdentityAccount> {
    const account = this.accountsByUserId.get(userId);
    if (account) return account;
    if (this.unknownUserIds.has(userId)) {
      throw new IdentityAccessNotFoundError(`No account found for userId ${userId}`);
    }
    throw new IdentityAccessUnavailableError('identity-access-service unreachable (e2e stub default)');
  }

  async findAccountByLoginIdentifier(loginIdentifier: string): Promise<IdentityAccount> {
    for (const account of this.accountsByUserId.values()) {
      if (account.loginIdentifier === loginIdentifier) return account;
    }
    throw new IdentityAccessUnavailableError('identity-access-service unreachable (e2e stub default)');
  }
}

/**
 * Shared stub instance, reset by every createTestApp() call.
 * Jest isolates module registries per test file, so each e2e suite gets its
 * own instance.
 */
export const identityAccessStub = new IdentityAccessClientStub();

/**
 * Result returned by createTestApp.
 * Call teardown() in afterAll to stop the container and close the app.
 */
export interface TestAppContext {
  app: INestApplication;
  teardown: () => Promise<void>;
}

/**
 * Build and start a test application instance.
 *
 * Strategy:
 *  1. If USE_LOCAL_DB=true → skip Testcontainers and use local PostgreSQL directly.
 *  2. Otherwise → attempt to start a Testcontainers PostgreSQL container.
 *     If Testcontainers fails (e.g. Docker socket not available), fall back to
 *     the local PostgreSQL instance automatically.
 *
 * // TODO: remove the fallback logic when Testcontainers has Docker permissions
 */
export async function createTestApp(): Promise<INestApplication> {
  // Load .env.test values into process.env before anything else so that
  // TEST_DB_* variables are available when building the connection URL.
  loadDotEnvTest();

  setStaticTestEnv();

  const useLocalDb = process.env.USE_LOCAL_DB === 'true';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let stopContainer: (() => Promise<any>) | null = null;

  if (useLocalDb) {
    // TODO: remove when Testcontainers has Docker permissions
    process.env.DATABASE_URL = buildLocalDatabaseUrl();
  } else {
    try {
      // Lazy-import so that the module is only resolved when actually needed.
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { PostgreSqlContainer } = require('@testcontainers/postgresql') as typeof import('@testcontainers/postgresql');
      const pgContainer = await new PostgreSqlContainer()
        .withDatabase('profile_test')
        .withUsername('test')
        .withPassword('test')
        .start();

      process.env.DATABASE_URL = pgContainer.getConnectionUri();
      stopContainer = () => pgContainer.stop();
    } catch (err) {
      // TODO: remove when Testcontainers has Docker permissions
      console.warn(
        '[app.helper] Testcontainers failed, falling back to local PostgreSQL.',
        (err as Error).message,
      );
      process.env.DATABASE_URL = buildLocalDatabaseUrl();
    }
  }

  identityAccessStub.reset();

  // AppModule est importe ICI, et non en tete de fichier, parce que Nest evalue
  // les arguments de @Module() des la definition de la classe : le
  // `ConfigModule.forRoot({ validate: validateEnv })` de AppConfigModule lit et
  // FIGE l'environnement au moment de l'import. Un import statique se ferait
  // donc avant que les lignes ci-dessus aient pose JWT_SECRET, INTERNAL_SECRET
  // et surtout DATABASE_URL (dont l'URL Testcontainers n'est connue qu'apres le
  // demarrage du conteneur) — la validation echouerait, et ConfigService
  // servirait ensuite un instantane perime a la place des vraies valeurs.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { AppModule } = require('../../../src/app.module') as typeof import('../../../src/app.module');

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(IdentityAccessClient)
    .useValue(identityAccessStub)
    .compile();

  const app = moduleFixture.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  await app.init();

  // TODO: remove when Testcontainers has Docker permissions
  // With Testcontainers each suite gets a fresh DB; with a shared local DB we
  // must reset the schema manually so tests stay independent.
  // synchronize(true) drops all tables then recreates them.
  const dataSource = app.get<DataSource>(getDataSourceToken());
  await dataSource.synchronize(true);

  // Override app.close() to also stop the container when one was started.
  const originalClose = app.close.bind(app);
  app.close = async () => {
    await originalClose();
    if (stopContainer) {
      await stopContainer();
    }
  };

  return app;
}

/**
 * Load .env.test from the service root into process.env.
 * Variables already present in the environment are NOT overwritten so that
 * CI/CD can inject its own values.
 *
 * // TODO: remove when Testcontainers has Docker permissions (keep only if
 *         other env vars are still needed)
 */
function loadDotEnvTest(): void {
  const path = require('path') as typeof import('path');
  const fs   = require('fs')   as typeof import('fs');

  const envFile = path.resolve(__dirname, '../../../../.env.test');
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
 * UUID helpers for readable test data.
 */
export const IDS = {
  student1: '00000000-0000-4000-8000-000000000001',
  student2: '00000000-0000-4000-8000-000000000002',
  parent1:  '00000000-0000-4000-8000-000000000010',
  teacher1: '00000000-0000-4000-8000-000000000020',
  teacher2: '00000000-0000-4000-8000-000000000021',
  rp1:      '00000000-0000-4000-8000-000000000030',
  ap1:      '00000000-0000-4000-8000-000000000031',
  adminFin: '00000000-0000-4000-8000-000000000040',
  ti:       '00000000-0000-4000-8000-000000000050',
  genericAccount1: '00000000-0000-4000-8000-000000000060',
  genericAccount2: '00000000-0000-4000-8000-000000000061',
  /** Compte dédié aux tests de relais de birthDate à la création du profil. */
  birthDateAccount: '00000000-0000-4000-8000-000000000062',
  /**
   * Account known to identity-access-service but WITHOUT any administrative
   * profile in profile-service: the data inconsistency that must surface as a
   * 500 on GET /profiles/:userId.
   */
  accountWithoutAdminProfile: '00000000-0000-4000-8000-000000000070',
  /**
   * Account holding an administrative profile but no pedagogical profile:
   * the normal state that must return 200 with pedagogical: null.
   */
  accountWithoutPedaProfile: '00000000-0000-4000-8000-000000000071',
  /** userId identity-access-service does not know at all → 404. */
  unknown:  '00000000-0000-4000-8000-999999999999',
};
