import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { DashboardPreference } from './entities/dashboard-preference.entity';
import { DashboardWidgetState } from './entities/dashboard-widget-state.entity';
import { NotificationSubscription } from './entities/notification-subscription.entity';
import { NotificationModule } from '../notification/notification.module';
import { SecurityModule } from '../common/security/security.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([DashboardPreference, DashboardWidgetState, NotificationSubscription]),
    SecurityModule,
    NotificationModule,
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
