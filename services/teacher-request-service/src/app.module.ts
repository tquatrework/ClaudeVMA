import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';

import { AppConfigModule } from './config/config.module';
import { TeacherRequestModule } from './teacher-request/teacher-request.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    AppConfigModule,
    TypeOrmModule.forRootAsync({
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.getOrThrow<string>('DATABASE_URL'),
        autoLoadEntities: true,
        // Schema changes must go through migrations; synchronize is only
        // enabled for the ephemeral NODE_ENV=test database used by e2e tests.
        synchronize: config.get<string>('NODE_ENV') === 'test',
      }),
      inject: [ConfigService],
    }),
    TeacherRequestModule,
    HealthModule,
  ],
})
export class AppModule {}
