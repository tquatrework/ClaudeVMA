import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { OpenActivitiesController } from './open-activities.controller';
import { OpenActivitiesService } from './open-activities.service';
import { OpenActivity } from './entities/open-activity.entity';
import { ActivityAcceptance } from './entities/activity-acceptance.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([OpenActivity, ActivityAcceptance]),
    JwtModule.register({}),
  ],
  controllers: [OpenActivitiesController],
  providers: [OpenActivitiesService],
  exports: [OpenActivitiesService],
})
export class OpenActivitiesModule {}
