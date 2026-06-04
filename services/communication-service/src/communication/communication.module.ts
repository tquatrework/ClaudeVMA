import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommunicationController } from './communication.controller';
import { CommunicationService } from './communication.service';
import { Message } from './entities/message.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Message])],
  controllers: [CommunicationController],
  providers: [CommunicationService],
})
export class CommunicationModule {}
