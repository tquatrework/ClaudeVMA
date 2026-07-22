import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';

/**
 * Single source of truth for JWT configuration and authentication/authorization
 * guards across profile-service.
 *
 * Marked @Global() so that every feature module gets JwtService and the shared
 * guards without redeclaring JwtModule.registerAsync(...) locally — this used
 * to be repeated in profiles.module.ts, relations.module.ts and
 * parent-link-requests.module.ts (modules-convention: "JWT et les guards sont
 * configurés une seule fois dans un module de sécurité local au service").
 *
 * ConfigService.getOrThrow is used so that a missing JWT_SECRET fails fast at
 * boot instead of silently signing/verifying tokens with an empty secret.
 */
@Global()
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
  exports: [JwtModule, JwtAuthGuard, RolesGuard],
})
export class SecurityModule {}
