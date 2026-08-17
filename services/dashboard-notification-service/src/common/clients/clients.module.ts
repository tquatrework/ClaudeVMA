import { Module } from '@nestjs/common';
import { IdentityAccessServiceClient } from './identity-access-service.client';

/**
 * Shared outbound clients to other services' internal APIs, usable by any
 * feature module (NotificationModule for the role fan-out on
 * `POST /internal/notify`, EventsModule for the role fan-out on
 * role-targeted domain events). Kept separate from
 * `events/profile-service.client.ts`, which is scoped to the Redis event
 * consumer and not exported outside `EventsModule`.
 */
@Module({
  providers: [IdentityAccessServiceClient],
  exports: [IdentityAccessServiceClient],
})
export class ClientsModule {}
