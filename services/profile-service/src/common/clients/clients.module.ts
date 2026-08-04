import { Module } from '@nestjs/common';
import { IdentityAccessClient } from './identity-access.client';
import { DashboardNotificationClient } from './dashboard-notification.client';

/**
 * Groups the typed interservice HTTP adapters consumed by profile-service
 * features (services-convention: "les appels interservices passent par des
 * clients/adaptateurs typés"). ConfigService is available here via the
 * global ConfigModule (see app.module.ts).
 */
@Module({
  providers: [IdentityAccessClient, DashboardNotificationClient],
  exports: [IdentityAccessClient, DashboardNotificationClient],
})
export class ClientsModule {}
