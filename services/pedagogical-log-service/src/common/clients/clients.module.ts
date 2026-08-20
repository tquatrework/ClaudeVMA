import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ProfileRelationsClient } from './profile-relations.client';
import { DashboardNotificationClient } from './dashboard-notification.client';

@Module({
  imports: [ConfigModule],
  providers: [ProfileRelationsClient, DashboardNotificationClient],
  exports: [ProfileRelationsClient, DashboardNotificationClient],
})
export class ClientsModule {}
