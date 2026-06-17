import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { VideoSessionModule } from './video-session/video-session.module';
import { HealthModule } from './health/health.module';
import { InternalModule } from './internal/internal.module';
import { VideoRoom } from './video-session/entities/video-room.entity';
import { VideoAccessToken } from './video-session/entities/video-access-token.entity';
import { AttendanceRecord } from './video-session/entities/attendance-record.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('DATABASE_URL'),
        entities: [VideoRoom, VideoAccessToken, AttendanceRecord],
        synchronize: config.get<string>('NODE_ENV') !== 'production',
      }),
      inject: [ConfigService],
    }),
    VideoSessionModule,
    HealthModule,
    InternalModule,
  ],
})
export class AppModule {}
