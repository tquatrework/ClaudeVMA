import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { join } from 'path';
import { NotificationModule } from './notification/notification.module';
import { HealthModule } from './health/health.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { InternalModule } from './internal/internal.module';
import { EventsModule } from './events/events.module';
import { validateEnvironment } from './config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => {
        const isTestEnvironment = config.get<string>('NODE_ENV') === 'test';
        return {
          type: 'postgres' as const,
          url: config.getOrThrow<string>('DATABASE_URL'),
          autoLoadEntities: true,
          // Ephemeral test databases may rely on synchronize for schema setup;
          // every other environment must use migrations.
          synchronize: isTestEnvironment,
          migrations: [join(__dirname, 'migrations', '*{.ts,.js}')],
          // The pre-existing schema came from `synchronize`; migrations are
          // additive on top of it and must run at boot, same pattern as
          // teacher-request-service (src/app.module.ts there).
          migrationsRun: !isTestEnvironment,
        };
      },
      inject: [ConfigService],
    }),
    // Backs EventStreamReclaimService's @Interval — registered once, here,
    // at the application root.
    ScheduleModule.forRoot(),
    HealthModule,
    NotificationModule,
    DashboardModule,
    InternalModule,
    EventsModule,
  ],
})
export class AppModule {}
