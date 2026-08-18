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
  /**
   * URL d'`identity-access-service`, unique propriétaire du rôle
   * (`docs/architecture.md` > "Propriété du rôle"). Requise depuis le
   * correctif CAL-FB-004 (2026-08-18) : `GET /calendars/:ownerId/busy`
   * résout désormais le rôle du titulaire auprès de la source de vérité
   * (`IdentityAccessClient`) plutôt que depuis la ligne `Calendar`, dont
   * l'existence n'est pas garantie. Sans elle, `IdentityAccessClient`
   * retomberait sur un défaut codé en dur.
   */
  IDENTITY_ACCESS_SERVICE_URL: string;
  /** Header `X-Internal-Secret` attendu par les routes `/internal/*` de `profile-service` et `identity-access-service`. */
  INTERNAL_SECRET: string;
  /**
   * URL du flux Redis `visiomath:events` (chantier calendrier de
   * disponibilités, point 3, 2026-08-18) : `EventPublisher` y publie les
   * évènements de la boîte d'envoi (`domain_events`) pour que
   * `dashboard-notification-service` puisse s'y abonner — même flux que
   * `teacher-request-service`. Optionnelle, comme sur les autres services :
   * en son absence, `EventPublisher` journalise un avertissement et
   * n'écrit rien (aucun évènement perdu — voir `EventPublisher`), le
   * service démarre normalement.
   */
  REDIS_URL?: string;
  NODE_ENV?: string;
  PORT?: string;
}

const REQUIRED_KEYS: ReadonlyArray<keyof CalendarServiceEnvironmentVariables> = [
  'DATABASE_URL',
  'JWT_SECRET',
  'PROFILE_SERVICE_URL',
  'IDENTITY_ACCESS_SERVICE_URL',
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
