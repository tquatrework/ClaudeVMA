import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { HealthModule } from './health/health.module';
import { ProfilesModule } from './profiles/profiles.module';
import { RelationsModule } from './relations/relations.module';
import { EventsModule } from './events/events.module';
import { InternalModule } from './internal/internal.module';
import { ParentLinkRequestsModule } from './parent-link-requests/parent-link-requests.module';
import { SecurityModule } from './security/security.module';
import { AppConfigModule } from './config/config.module';

@Module({
  imports: [
    // Valide l'environnement au demarrage : le service refuse de demarrer si
    // DATABASE_URL, JWT_SECRET ou INTERNAL_SECRET manque ou est vide.
    AppConfigModule,
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.getOrThrow<string>('DATABASE_URL'),
        autoLoadEntities: true,
        synchronize: false,
      }),
      inject: [ConfigService],
    }),
    SecurityModule,
    EventsModule,
    ProfilesModule,
    RelationsModule,
    ParentLinkRequestsModule,
    HealthModule,
    InternalModule,
  ],
})
export class AppModule {}
