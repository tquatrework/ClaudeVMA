/**
 * Helper to bootstrap the NestJS application for e2e tests.
 *
 * Uses the local PostgreSQL instance (visiomath credentials) with a dedicated
 * test database so that tests run against a production-equivalent database engine
 * without requiring Docker / testcontainers.
 *
 * TypeORM synchronize=true (enabled for NODE_ENV !== 'production') ensures
 * the schema is up-to-date before each suite. Each suite should clean up
 * its own data or rely on the isolated database name.
 *
 * JWT tokens are signed with the same JWT_SECRET defined below
 * so that JwtAuthGuard accepts them during tests.
 */

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../../src/app.module';
import * as jwt from 'jsonwebtoken';

export const TEST_JWT_SECRET = 'test_jwt_secret_for_e2e';

/**
 * Local PostgreSQL connection details.
 * The teacher_request_test database must exist before running the tests.
 * Create it once with:
 *   PGPASSWORD=visiomath_secret psql -h localhost -U visiomath \
 *     -c "CREATE DATABASE teacher_request_test OWNER visiomath;"
 */
const PG_TEST_URL =
  'postgresql://visiomath:visiomath_secret@localhost:5432/teacher_request_test';

/**
 * Set all environment variables required by the service before the NestJS
 * module is compiled — ConfigModule reads them synchronously at startup.
 */
function setTestEnv(): void {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = TEST_JWT_SECRET;
  process.env.DATABASE_URL = PG_TEST_URL;
}

/**
 * Build and start a test application instance backed by a local PostgreSQL
 * database. TypeORM synchronize is enabled for NODE_ENV=test so the schema
 * is always up-to-date.
 */
export async function createTestApp(): Promise<INestApplication> {
  setTestEnv();

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  await app.init();

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
 * UUID helpers for readable test data.
 */
export const IDS = {
  student1: '00000000-0000-0000-0000-000000000001',
  student2: '00000000-0000-0000-0000-000000000002',
  parent1: '00000000-0000-0000-0000-000000000010',
  teacher1: '00000000-0000-0000-0000-000000000020',
  teacher2: '00000000-0000-0000-0000-000000000021',
  rp1: '00000000-0000-0000-0000-000000000030',
  ap1: '00000000-0000-0000-0000-000000000031',
  adminFin: '00000000-0000-0000-0000-000000000040',
  ti: '00000000-0000-0000-0000-000000000050',
  unknown: '00000000-0000-0000-0000-999999999999',
};
