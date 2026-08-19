import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { VideoSessionModule } from './video-session/video-session.module';
import { HealthModule } from './health/health.module';
import { InternalModule } from './internal/internal.module';
import { EventsModule } from './events/events.module';
import { VideoRoom } from './video-session/entities/video-room.entity';
import { VideoAccessToken } from './video-session/entities/video-access-token.entity';
import { AttendanceRecord } from './video-session/entities/attendance-record.entity';
import { VideoRecording } from './video-session/entities/video-recording.entity';
import { RecordingComment } from './video-session/entities/recording-comment.entity';
import { CourseSummary } from './video-session/entities/course-summary.entity';
import { ActivityProjection } from './events/entities/activity-projection.entity';
import { ProcessedEvent } from './events/entities/processed-event.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('DATABASE_URL'),
        entities: [
          VideoRoom,
          VideoAccessToken,
          AttendanceRecord,
          VideoRecording,
          RecordingComment,
          CourseSummary,
          ActivityProjection,
          ProcessedEvent,
        ],
        synchronize: config.get<string>('NODE_ENV') !== 'production',
      }),
      inject: [ConfigService],
    }),
    VideoSessionModule,
    HealthModule,
    InternalModule,
    EventsModule,
  ],
})
export class AppModule {}
