import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { CalendarEventsController } from './calendar-events.controller';
import { CalendarEventsService } from './calendar-events.service';
import { CalendarEvent } from './entities/calendar-event.entity';
import { EventInvitation } from './entities/event-invitation.entity';
import { CancellationRequest } from './entities/cancellation-request.entity';
import { ReminderRule } from './entities/reminder-rule.entity';
import { CalendarVisibilityGrant } from './entities/calendar-visibility-grant.entity';
import { EventsModule } from '../events/events.module';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CalendarEvent,
      EventInvitation,
      CancellationRequest,
      ReminderRule,
      CalendarVisibilityGrant,
    ]),
    JwtModule.register({}),
    EventsModule,
  ],
  controllers: [CalendarEventsController],
  providers: [CalendarEventsService, JwtAuthGuard, RolesGuard],
  exports: [CalendarEventsService],
})
export class CalendarEventsModule {}
