import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NotificationModule } from './notification/notification.module';
import { HealthModule } from './health/health.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { InternalModule } from './internal/internal.module';
import { Notification } from './notification/entities/notification.entity';
import { DashboardPreference } from './dashboard/entities/dashboard-preference.entity';
import { DashboardWidgetState } from './dashboard/entities/dashboard-widget-state.entity';
import { NotificationSubscription } from './dashboard/entities/notification-subscription.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('DATABASE_URL'),
        entities: [Notification, DashboardPreference, DashboardWidgetState, NotificationSubscription],
        synchronize: config.get<string>('NODE_ENV') !== 'production',
      }),
      inject: [ConfigService],
    }),
    HealthModule,
    NotificationModule,
    DashboardModule,
    InternalModule,
  ],
})
export class AppModule {}
