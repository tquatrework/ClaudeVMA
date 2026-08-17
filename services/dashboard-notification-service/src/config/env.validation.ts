import { plainToInstance } from 'class-transformer';
import { IsIn, IsNotEmpty, IsOptional, IsString, validateSync } from 'class-validator';

/**
 * Typed shape of the environment variables required to boot
 * dashboard-notification-service. Centralising this here lets AppModule
 * fail fast at startup instead of letting individual providers discover
 * a missing secret at request time.
 */
export class EnvironmentVariables {
  @IsOptional()
  @IsIn(['development', 'test', 'production'])
  NODE_ENV: string = 'development';

  @IsString()
  @IsNotEmpty()
  DATABASE_URL: string;

  @IsString()
  @IsNotEmpty()
  JWT_SECRET: string;

  @IsString()
  @IsNotEmpty()
  INTERNAL_SECRET: string;

  // Required since 2026-08-14 (arbitrage "Systeme de notifications
  // transversal"): the Redis event consumer and the profile-service
  // client both fail fast at boot rather than discovering a missing
  // configuration at the first event.
  @IsString()
  @IsNotEmpty()
  REDIS_URL: string;

  @IsString()
  @IsNotEmpty()
  PROFILE_SERVICE_URL: string;
}

export function validateEnvironment(config: Record<string, unknown>): EnvironmentVariables {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, { skipMissingProperties: false });

  if (errors.length > 0) {
    throw new Error(
      `Invalid environment configuration for dashboard-notification-service: ${errors
        .map((error) => Object.values(error.constraints ?? {}).join(', '))
        .join('; ')}`,
    );
  }

  return validatedConfig;
}
