import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CalendarController } from './calendar.controller';
import { CalendarService } from './calendar.service';
import { CalendarSession } from './entities/calendar-session.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CalendarSession])],
  controllers: [CalendarController],
  providers: [CalendarService],
})
export class CalendarModule {}
