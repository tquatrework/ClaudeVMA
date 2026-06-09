import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CalendarModule } from './calendar/calendar.module';
import { CalendarsModule } from './calendars/calendars.module';
import { ActivitiesModule } from './activities/activities.module';
import { RemindersModule } from './reminders/reminders.module';
import { HealthModule } from './health/health.module';
import { CalendarSession } from './calendar/entities/calendar-session.entity';
import { Calendar } from './calendars/entities/calendar.entity';
import { AvailabilitySlot } from './calendars/entities/availability-slot.entity';
import { PaymentScheduleEntry } from './calendars/entities/payment-schedule-entry.entity';
import { ScheduledActivity } from './activities/entities/scheduled-activity.entity';
import { Reminder } from './reminders/entities/reminder.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('DATABASE_URL'),
        entities: [CalendarSession, Calendar, AvailabilitySlot, PaymentScheduleEntry, ScheduledActivity, Reminder],
        synchronize: config.get<string>('NODE_ENV') !== 'production',
      }),
      inject: [ConfigService],
    }),
    CalendarModule,
    CalendarsModule,
    ActivitiesModule,
    RemindersModule,
    HealthModule,
  ],
})
export class AppModule {}
