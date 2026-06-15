import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { CalendarsController } from './calendars.controller';
import { CalendarsService } from './calendars.service';
import { Calendar } from './entities/calendar.entity';
import { AvailabilitySlot } from './entities/availability-slot.entity';
import { PaymentScheduleEntry } from './entities/payment-schedule-entry.entity';
import { EventsModule } from '../events/events.module';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([Calendar, AvailabilitySlot, PaymentScheduleEntry]),
    JwtModule.register({}),
    EventsModule,
  ],
  controllers: [CalendarsController],
  providers: [CalendarsService, JwtAuthGuard, RolesGuard],
  exports: [CalendarsService],
})
export class CalendarsModule {}
