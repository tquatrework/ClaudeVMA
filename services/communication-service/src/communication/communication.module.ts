// Deprecated: replaced by src/conversation/conversation.module.ts
// This module is no longer imported by AppModule.
import { Module } from '@nestjs/common';
import { CommunicationService } from './communication.service';

@Module({
  providers: [CommunicationService],
})
export class CommunicationModule {}
