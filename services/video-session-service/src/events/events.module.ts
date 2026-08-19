import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { EventsConsumerService } from './events-consumer.service';
import { ActivityProjection } from './entities/activity-projection.entity';
import { ProcessedEvent } from './entities/processed-event.entity';
import { VideoSessionModule } from '../video-session/video-session.module';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([ActivityProjection, ProcessedEvent]),
    VideoSessionModule,
  ],
  providers: [EventsConsumerService],
})
export class EventsModule {}
