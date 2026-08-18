import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActivitiesController } from './activities.controller';
import { ActivitiesService } from './activities.service';
import { ScheduledActivity } from './entities/scheduled-activity.entity';
import { EventsModule } from '../events/events.module';
import { SecurityModule } from '../security/security.module';
import { ProfileRelationsClient } from '../common/clients/profile-relations.client';

@Module({
  imports: [
    TypeOrmModule.forFeature([ScheduledActivity]),
    SecurityModule,
    EventsModule,
  ],
  controllers: [ActivitiesController],
  // ProfileRelationsClient : vérification du lien métier avec le destinataire
  // à la création (chantier calendrier de disponibilités, point 3). Instance
  // propre à ce module (pas de dépendance vers CalendarsModule, qui importe
  // au contraire ActivitiesModule) — ConfigService, sa seule dépendance, est
  // global (`ConfigModule.forRoot({ isGlobal: true })`, voir app.module.ts).
  providers: [ActivitiesService, ProfileRelationsClient],
  exports: [ActivitiesService],
})
export class ActivitiesModule {}
