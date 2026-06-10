import { Module } from '@nestjs/common';
import { InternalController } from './internal.controller';
import { DashboardModule } from '../dashboard/dashboard.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [DashboardModule, NotificationModule],
  controllers: [InternalController],
})
export class InternalModule {}
