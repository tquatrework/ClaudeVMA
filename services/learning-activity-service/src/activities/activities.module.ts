import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ActivitiesController } from './activities.controller';
import { OpenActivitiesModule } from '../open-activities/open-activities.module';

@Module({
  imports: [
    OpenActivitiesModule,
    JwtModule.register({}),
  ],
  controllers: [ActivitiesController],
})
export class ActivitiesModule {}
