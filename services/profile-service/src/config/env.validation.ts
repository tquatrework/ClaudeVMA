import { plainToInstance } from 'class-transformer';
import { IsIn, IsNotEmpty, IsOptional, IsString, validateSync } from 'class-validator';

enum NodeEnvironment {
  DEVELOPMENT = 'development',
  TEST = 'test',
  PRODUCTION = 'production',
}

/**
 * Strongly-typed representation of the environment variables required by
 * profile-service. Validated once at bootstrap so that missing or malformed
 * configuration fails fast instead of surfacing later as an obscure runtime
 * error — ou, pire, comme une porte ouverte.
 *
 * `INTERNAL_SECRET` est OBLIGATOIRE depuis le 2026-08-12. `InternalGuard` se
 * contentait jusqu'ici de journaliser un avertissement puis de LAISSER PASSER
 * quand le secret n'etait pas configure : toutes les routes `/internal/*`
 * etaient alors servies sans aucune authentification. La surface venait de
 * s'elargir avec `GET /internal/profiles/:userId/display-name` et
 * `POST /internal/profiles/display-names`, qui servent une identite (prenom,
 * nom) sans lecteur et sans filtrage de visibilite : un `/internal/*` ouvert
 * exposait donc les noms de tous les utilisateurs a quiconque atteint le
 * reseau Docker.
 *
 * C'est le defaut de famille « plafond cache » arbitre le 2026-08-10 : une
 * valeur par defaut non declaree qui echoue en silence. Une garde qui s'ouvre
 * quand sa configuration manque echoue dans le mauvais sens — un service mal
 * configure doit refuser de servir, pas servir sans controle.
 *
 * Meme forme que `teacher-request-service`, qui a rendu `PROFILE_SERVICE_URL`
 * et `INTERNAL_SECRET` obligatoires dans cette meme branche.
 */
class EnvironmentVariables {
  @IsOptional()
  @IsIn([NodeEnvironment.DEVELOPMENT, NodeEnvironment.TEST, NodeEnvironment.PRODUCTION])
  NODE_ENV?: NodeEnvironment;

  @IsString()
  @IsNotEmpty()
  DATABASE_URL: string;

  @IsString()
  @IsNotEmpty()
  JWT_SECRET: string;

  /**
   * Secret partage protegeant les routes `/internal/*`. Sans lui, aucune
   * verification n'est possible : le service doit refuser de demarrer plutot
   * que de servir ces routes en clair.
   */
  @IsString()
  @IsNotEmpty()
  INTERNAL_SECRET: string;

  /**
   * URL de connexion au flux Redis partagé `visiomath:events` (arbitrage du
   * 2026-08-14). VOLONTAIREMENT OPTIONNELLE, à la différence de
   * `INTERNAL_SECRET` : les environnements de test (unitaires, e2e) n'ont pas
   * de Redis et ne doivent pas être bloqués par son absence — `EventsService`
   * continue d'écrire l'outbox `domain_events` sans elle, seule la
   * publication réelle sur le bus reste en attente (voir
   * `EventPublisherService`).
   */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  REDIS_URL?: string;
}

export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validatedConfig, { skipMissingProperties: false });
  if (errors.length > 0) {
    throw new Error(`Invalid environment configuration: ${errors.toString()}`);
  }
  return validatedConfig;
}
