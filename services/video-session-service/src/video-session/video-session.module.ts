import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { VideoSessionController } from './video-session.controller';
import { VideoSessionService } from './video-session.service';
import { VideoRoom } from './entities/video-room.entity';
import { VideoAccessToken } from './entities/video-access-token.entity';
import { AttendanceRecord } from './entities/attendance-record.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([VideoRoom, VideoAccessToken, AttendanceRecord]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '1h' },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [VideoSessionController],
  providers: [VideoSessionService],
  exports: [VideoSessionService],
})
export class VideoSessionModule {}
