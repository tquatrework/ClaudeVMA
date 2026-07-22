import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';

/**
 * Single point of JWT/guard configuration for the whole service.
 *
 * Feature modules must import this module instead of registering their own
 * `JwtModule` or declaring `JwtAuthGuard`/`RolesGuard` as local providers
 * (modules-convention: "JWT et les guards sont configurés une seule fois
 * dans un module de sécurité local au service").
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
