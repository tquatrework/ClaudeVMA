import { Module } from '@nestjs/common';
import { InternalController } from './internal.controller';
import { ArchiveModule } from '../archive/archive.module';

@Module({
  imports: [ArchiveModule],
  controllers: [InternalController],
})
export class InternalModule {}
