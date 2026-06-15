import { Module } from '@nestjs/common';
import { InternalController } from './internal.controller';
import { InternalSecretGuard } from './internal-secret.guard';
import { VideoSessionModule } from '../video-session/video-session.module';

@Module({
  imports: [VideoSessionModule],
  controllers: [InternalController],
  providers: [InternalSecretGuard],
})
export class InternalModule {}
