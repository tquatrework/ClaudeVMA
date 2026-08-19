import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ProfileClientService } from './profile-client.service';

@Module({
  imports: [ConfigModule],
  providers: [ProfileClientService],
  exports: [ProfileClientService],
})
export class ProfileModule {}
