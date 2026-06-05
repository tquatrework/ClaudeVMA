import { Module } from '@nestjs/common';
import { CallbackController } from './callback.controller';
import { EventModule } from '../event/event.module';

@Module({
  imports: [EventModule],
  controllers: [CallbackController],
})
export class CallbackModule {}
