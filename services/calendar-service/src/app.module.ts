import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CalendarsModule } from './calendars/calendars.module';
import { ActivitiesModule } from './activities/activities.module';
import { RemindersModule } from './reminders/reminders.module';
import { HealthModule } from './health/health.module';
import { CalendarEventsModule } from './calendar-events/calendar-events.module';
import { Calendar } from './calendars/entities/calendar.entity';
import { AvailabilitySlot } from './calendars/entities/availability-slot.entity';
import { PaymentScheduleEntry } from './calendars/entities/payment-schedule-entry.entity';
import { ScheduledActivity } from './activities/entities/scheduled-activity.entity';
import { Reminder } from './reminders/entities/reminder.entity';
import { CalendarEvent } from './calendar-events/entities/calendar-event.entity';
import { EventInvitation } from './calendar-events/entities/event-invitation.entity';
import { CancellationRequest } from './calendar-events/entities/cancellation-request.entity';
import { ReminderRule } from './calendar-events/entities/reminder-rule.entity';
import { CalendarVisibilityGrant } from './calendar-events/entities/calendar-visibility-grant.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('DATABASE_URL'),
        entities: [
          Calendar,
          AvailabilitySlot,
          PaymentScheduleEntry,
          ScheduledActivity,
          Reminder,
          CalendarEvent,
          EventInvitation,
          CancellationRequest,
          ReminderRule,
          CalendarVisibilityGrant,
        ],
        synchronize: config.get<string>('NODE_ENV') !== 'production',
      }),
      inject: [ConfigService],
    }),
    CalendarsModule,
    ActivitiesModule,
    RemindersModule,
    HealthModule,
    CalendarEventsModule,
  ],
})
export class AppModule {}
