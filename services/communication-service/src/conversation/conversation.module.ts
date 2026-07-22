import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Conversation } from './entities/conversation.entity';
import { Message } from './entities/message.entity';
import { ConversationController } from './conversation.controller';
import { MessageController } from './message.controller';
import { ConversationService } from './conversation.service';
import { ContactModule } from '../contact/contact.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Conversation, Message]),
    ContactModule,
  ],
  controllers: [ConversationController, MessageController],
  providers: [ConversationService],
  exports: [ConversationService],
})
export class ConversationModule {}
