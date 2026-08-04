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
