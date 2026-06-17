import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CalendarsModule } from './calendars/calendars.module';
import { ActivitiesModule } from './activities/activities.module';
import { RemindersModule } from './reminders/reminders.module';
import { HealthModule } from './health/health.module';
import { CalendarModule } from './calendar/calendar.module';
import { Calendar } from './calendars/entities/calendar.entity';
import { AvailabilitySlot } from './calendars/entities/availability-slot.entity';
import { PaymentScheduleEntry } from './calendars/entities/payment-schedule-entry.entity';
import { ScheduledActivity } from './activities/entities/scheduled-activity.entity';
import { Reminder } from './reminders/entities/reminder.entity';
import { CalendarSession } from './calendar/entities/calendar-session.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('DATABASE_URL'),
        entities: [Calendar, AvailabilitySlot, PaymentScheduleEntry, ScheduledActivity, Reminder, CalendarSession],
        synchronize: config.get<string>('NODE_ENV') !== 'production',
      }),
      inject: [ConfigService],
    }),
    CalendarsModule,
    ActivitiesModule,
    RemindersModule,
    HealthModule,
    CalendarModule,
  ],
})
export class AppModule {}
