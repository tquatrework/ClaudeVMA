import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CalendarEventsController } from './calendar-events.controller';
import { CalendarEventsService } from './calendar-events.service';
import { CalendarEvent } from './entities/calendar-event.entity';
import { EventInvitation } from './entities/event-invitation.entity';
import { CancellationRequest } from './entities/cancellation-request.entity';
import { ReminderRule } from './entities/reminder-rule.entity';
import { CalendarVisibilityGrant } from './entities/calendar-visibility-grant.entity';
import { EventsModule } from '../events/events.module';
import { SecurityModule } from '../security/security.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CalendarEvent,
      EventInvitation,
      CancellationRequest,
      ReminderRule,
      CalendarVisibilityGrant,
    ]),
    SecurityModule,
    EventsModule,
  ],
  controllers: [CalendarEventsController],
  providers: [CalendarEventsService],
  exports: [CalendarEventsService],
})
export class CalendarEventsModule {}
