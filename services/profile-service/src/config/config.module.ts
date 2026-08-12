import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { validateEnv } from './env.validation';

/**
 * Single point of environment configuration for the service.
 * Validates required variables (DATABASE_URL, JWT_SECRET, INTERNAL_SECRET)
 * once at bootstrap. Registered as global so every module can inject
 * ConfigService without re-importing ConfigModule.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
  ],
  exports: [ConfigModule],
})
export class AppConfigModule {}
