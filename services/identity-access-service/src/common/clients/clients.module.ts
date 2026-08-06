import { Module } from '@nestjs/common';
import { ProfileServiceClient } from './profile-service.client';

/**
 * Regroupe les adaptateurs HTTP interservices typés consommés par
 * identity-access-service (services-convention: "les appels interservices
 * passent par des clients/adaptateurs typés"). ConfigService est disponible
 * ici via le ConfigModule global (voir app.module.ts).
 */
@Module({
  providers: [ProfileServiceClient],
  exports: [ProfileServiceClient],
})
export class ClientsModule {}
