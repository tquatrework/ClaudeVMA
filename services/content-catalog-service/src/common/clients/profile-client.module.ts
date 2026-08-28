import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ProfileRelationsClient } from './profile-relations.client';

@Module({
  imports: [ConfigModule],
  providers: [ProfileRelationsClient],
  exports: [ProfileRelationsClient],
})
export class ProfileClientModule {}
