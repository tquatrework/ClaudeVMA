/**
 * Environment variable validation for calendar-service.
 *
 * Runs once at bootstrap (via ConfigModule.forRoot({ validate })).
 * Fails fast if a required secret or connection string is missing,
 * instead of letting the service start with an empty/undefined value
 * that would only surface later as a confusing runtime error.
 */

export interface CalendarServiceEnvironmentVariables {
  DATABASE_URL: string;
  JWT_SECRET: string;
  /**
   * URL de `profile-service`, unique propriétaire des relations métier.
   * Requise depuis le chantier calendrier de disponibilités, point 2
   * (visibilité busy/free) : sans elle, `ProfileRelationsClient` retomberait
   * sur un défaut codé en dur — le même défaut qui, sur
   * `teacher-request-service`, avait pointé un port où personne n'écoute et
   * laissé le RP ne lire que des UUID (docker-compose.yml, service
   * `teacher-request-service`).
   */
  PROFILE_SERVICE_URL: string;
  /** Header `X-Internal-Secret` attendu par les routes `/internal/*` de `profile-service`. */
  INTERNAL_SECRET: string;
  NODE_ENV?: string;
  PORT?: string;
}

const REQUIRED_KEYS: ReadonlyArray<keyof CalendarServiceEnvironmentVariables> = [
  'DATABASE_URL',
  'JWT_SECRET',
  'PROFILE_SERVICE_URL',
  'INTERNAL_SECRET',
];

export function validateEnv(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const missingKeys = REQUIRED_KEYS.filter((key) => {
    const value = config[key];
    return value === undefined || value === null || value === '';
  });

  if (missingKeys.length > 0) {
    throw new Error(
      `calendar-service: missing required environment variable(s): ${missingKeys.join(', ')}`,
    );
  }

  return config;
}
