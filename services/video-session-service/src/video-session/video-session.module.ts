import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VideoSessionController } from './video-session.controller';
import { VideoSessionService } from './video-session.service';
import { VideoRoom } from './entities/video-room.entity';

@Module({
  imports: [TypeOrmModule.forFeature([VideoRoom])],
  controllers: [VideoSessionController],
  providers: [VideoSessionService],
})
export class VideoSessionModule {}
