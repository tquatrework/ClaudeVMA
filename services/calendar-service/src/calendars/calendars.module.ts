import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CalendarsController } from './calendars.controller';
import { CalendarsService } from './calendars.service';
import { Calendar } from './entities/calendar.entity';
import { AvailabilitySlot } from './entities/availability-slot.entity';
import { PaymentScheduleEntry } from './entities/payment-schedule-entry.entity';
import { EventsModule } from '../events/events.module';
import { SecurityModule } from '../security/security.module';
import { ActivitiesModule } from '../activities/activities.module';
import { ProfileRelationsClient } from '../common/clients/profile-relations.client';

@Module({
  imports: [
    TypeOrmModule.forFeature([Calendar, AvailabilitySlot, PaymentScheduleEntry]),
    SecurityModule,
    EventsModule,
    // Import de module Nest, PAS un appel HTTP : le busy/free dérive les
    // `busyBlocks` des activités du même service (arbitrage du plan, point 2 —
    // « même service, import de module Nest »).
    ActivitiesModule,
  ],
  controllers: [CalendarsController],
  providers: [CalendarsService, ProfileRelationsClient],
  exports: [CalendarsService],
})
export class CalendarsModule {}
