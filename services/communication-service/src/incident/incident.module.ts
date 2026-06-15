import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IncidentThread } from './entities/incident-thread.entity';
import { IncidentController } from './incident.controller';
import { IncidentService } from './incident.service';
import { ConversationModule } from '../conversation/conversation.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([IncidentThread]),
    ConversationModule,
  ],
  controllers: [IncidentController],
  providers: [IncidentService],
})
export class IncidentModule {}
