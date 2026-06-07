import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { RemindersController } from './reminders.controller';
import { RemindersService } from './reminders.service';
import { Reminder } from './entities/reminder.entity';
import { EventsModule } from '../events/events.module';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([Reminder]),
    JwtModule.register({}),
    EventsModule,
  ],
  controllers: [RemindersController],
  providers: [RemindersService, JwtAuthGuard, RolesGuard],
  exports: [RemindersService],
})
export class RemindersModule {}
