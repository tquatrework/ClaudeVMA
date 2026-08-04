import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { AccountsModule } from './accounts/accounts.module';
import { ConsentsModule } from './consents/consents.module';
import { DelegationsModule } from './delegations/delegations.module';
import { EventsModule } from './events/events.module';
import { HealthModule } from './health/health.module';
import { InternalModule } from './internal/internal.module';
import { validateEnvironment } from './config/env.validation';

/**
 * Environnement considéré comme "test éphémère" au sens de la convention modules :
 * seul ce cas autorise la synchronisation automatique du schéma (base jetable, recréée
 * à chaque exécution). Tout autre environnement (development compris) doit passer par
 * les migrations TypeORM.
 */
const EPHEMERAL_TEST_NODE_ENV = 'test';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.getOrThrow<string>('DATABASE_URL'),
        autoLoadEntities: true,
        synchronize: config.get<string>('NODE_ENV') === EPHEMERAL_TEST_NODE_ENV,
        logging: config.get<string>('NODE_ENV') === 'development',
      }),
      inject: [ConfigService],
    }),
    AuthModule,
    AccountsModule,
    ConsentsModule,
    DelegationsModule,
    EventsModule,
    HealthModule,
    InternalModule,
  ],
})
export class AppModule {}
