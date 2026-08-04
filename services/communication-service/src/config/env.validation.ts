import { plainToInstance } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min, MinLength, validateSync } from 'class-validator';

enum NodeEnv {
  Development = 'development',
  Test = 'test',
  Production = 'production',
}

/**
 * Strict shape of the environment variables required by communication-service.
 * Validated once at bootstrap by ConfigModule so that any missing/invalid
 * value fails fast instead of surfacing later as an undefined secret.
 */
export class EnvironmentVariables {
  @IsOptional()
  @IsEnum(NodeEnv)
  NODE_ENV?: NodeEnv;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT?: number;

  @IsString()
  @MinLength(1)
  DATABASE_URL: string;

  @IsString()
  @MinLength(1)
  JWT_SECRET: string;

  @IsString()
  @MinLength(1)
  INTERNAL_SECRET: string;
}

/**
 * `ConfigModule.forRoot({ validate })` hook: throws at bootstrap when a
 * required environment variable is missing or malformed.
 */
export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, { skipMissingProperties: false });
  if (errors.length > 0) {
    throw new Error(`Invalid environment configuration for communication-service: ${errors.toString()}`);
  }

  return validatedConfig;
}
