import { plainToInstance } from 'class-transformer';
import { IsIn, IsNotEmpty, IsOptional, IsString, validateSync } from 'class-validator';

enum NodeEnvironment {
  DEVELOPMENT = 'development',
  TEST = 'test',
  PRODUCTION = 'production',
}

/**
 * Strongly-typed representation of the environment variables required by
 * teacher-request-service. Validated once at bootstrap so that missing or
 * malformed configuration fails fast instead of surfacing later as an
 * obscure runtime error.
 *
 * `PROFILE_SERVICE_URL` et `INTERNAL_SECRET` sont OBLIGATOIRES depuis le
 * 2026-08-12 : le service ne peut plus verifier le lien parent↔eleve ni creer
 * le lien eleve↔formateur sans eux. Ils etaient jusqu'ici absents, et le client
 * retombait sur un defaut code en dur (`http://profile-service:3000`) pointant
 * un port ou personne n'ecoute — un plafond cache exactement de la famille de
 * ceux arbitres le 2026-08-10, qui echouait sans bruit et affichait des UUID au
 * RP au lieu des noms.
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

  @IsString()
  @IsNotEmpty()
  PROFILE_SERVICE_URL: string;

  @IsString()
  @IsNotEmpty()
  INTERNAL_SECRET: string;

  /**
   * Optionnel : sans lui, les evenements restent dans la boite d'envoi
   * (`domain_events`) et seront publies des qu'un bus sera configure. Ils ne
   * sont jamais perdus, et jamais transformes en simple ligne de log.
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
