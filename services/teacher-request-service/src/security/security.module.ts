import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { JwtAuthGuard } from '../common/jwt.guard';
import { RolesGuard } from '../common/roles.guard';

/**
 * Local security module for teacher-request-service.
 * JWT verification and the auth/role guards are configured exactly once
 * here; any feature module that needs authentication imports SecurityModule
 * instead of re-registering JwtModule or redeclaring the guards.
 */
@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [JwtAuthGuard, RolesGuard],
  exports: [JwtAuthGuard, RolesGuard, JwtModule],
})
export class SecurityModule {}
