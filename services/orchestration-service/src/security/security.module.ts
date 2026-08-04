import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from './jwt-auth.guard';

/**
 * Module de sécurité unique du service : configure JwtModule une seule fois
 * (secret obligatoire via ConfigService.getOrThrow, jamais de secret vide ou
 * par défaut) et fournit le JwtAuthGuard partagé par tous les contrôleurs
 * protégés. Marqué @Global() pour éviter toute reconfiguration locale de
 * JwtModule dans les modules métier (command, event, workflow, ...).
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
  providers: [JwtAuthGuard],
  exports: [JwtModule, JwtAuthGuard],
})
export class SecurityModule {}
