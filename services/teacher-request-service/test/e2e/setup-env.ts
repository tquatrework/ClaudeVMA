/**
 * Jest `setupFiles` entry — runs before any test module is loaded.
 *
 * AppModule (imported statically by helpers/app.helper.ts) evaluates
 * ConfigModule.forRoot(...) as soon as it is imported, because Nest
 * evaluates @Module() decorator arguments eagerly at class-definition time.
 * Setting the required env vars only inside createTestApp() is too late:
 * by then AppModule has already been imported and validated with an empty
 * environment. Setting them here, before any e2e spec file (and therefore
 * before AppModule) is imported, ensures validateEnv() sees real values.
 */
process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test_jwt_secret_for_e2e';
process.env.DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://visiomath:visiomath_secret@localhost:5432/teacher_request_test';
