import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { join } from 'path';

import { AppConfigModule } from './config/config.module';
import { TeacherRequestModule } from './teacher-request/teacher-request.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    AppConfigModule,
    TypeOrmModule.forRootAsync({
      useFactory: (config: ConfigService) => {
        const isTestEnvironment = config.get<string>('NODE_ENV') === 'test';
        return {
          type: 'postgres' as const,
          url: config.getOrThrow<string>('DATABASE_URL'),
          autoLoadEntities: true,
          // Schema changes must go through migrations; synchronize is only
          // enabled for the ephemeral NODE_ENV=test database used by e2e tests.
          synchronize: isTestEnvironment,
          migrations: [join(__dirname, 'migrations', '*{.ts,.js}')],
          // Les tables historiques viennent d'un ancien `synchronize` : les
          // migrations sont additives et doivent tourner au demarrage, sinon
          // une colonne ajoutee ici n'existerait jamais en production.
          migrationsRun: !isTestEnvironment,
        };
      },
      inject: [ConfigService],
    }),
    TeacherRequestModule,
    HealthModule,
  ],
})
export class AppModule {}
