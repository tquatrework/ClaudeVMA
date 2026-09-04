import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { join } from 'path';
import { ConversationModule } from './conversation/conversation.module';
import { ContactModule } from './contact/contact.module';
import { IncidentModule } from './incident/incident.module';
import { HealthModule } from './health/health.module';
import { SecurityModule } from './security/security.module';
import { validateEnv } from './config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.getOrThrow<string>('DATABASE_URL'),
        autoLoadEntities: true,
        synchronize: false,
        migrations: [join(__dirname, 'migrations/*.{ts,js}')],
        migrationsRun: true,
      }),
      inject: [ConfigService],
    }),
    SecurityModule,
    ConversationModule,
    ContactModule,
    IncidentModule,
    HealthModule,
  ],
})
export class AppModule {}
