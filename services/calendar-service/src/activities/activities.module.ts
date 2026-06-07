import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ActivitiesController } from './activities.controller';
import { ActivitiesService } from './activities.service';
import { ScheduledActivity } from './entities/scheduled-activity.entity';
import { EventsModule } from '../events/events.module';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([ScheduledActivity]),
    JwtModule.register({}),
    EventsModule,
  ],
  controllers: [ActivitiesController],
  providers: [ActivitiesService, JwtAuthGuard, RolesGuard],
  exports: [ActivitiesService],
})
export class ActivitiesModule {}
