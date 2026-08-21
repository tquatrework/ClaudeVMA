import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { ActivityProjection } from './entities/activity-projection.entity';
import { ProcessedEvent } from './entities/processed-event.entity';
import { PedagogicalLog } from '../pedagogical-log/entities/pedagogical-log.entity';
import { EventProcessorService } from './event-processor.service';
import { EventStreamConsumerService } from './event-stream-consumer.service';
import { EventStreamReclaimService } from './event-stream-reclaim.service';

/**
 * Consommation du flux Redis `visiomath:events` — point 5 de la refonte du
 * cahier de texte (2026-08-20) : création automatique d'une entrée à la
 * confirmation d'une activité de type `cours`.
 */
@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([ActivityProjection, ProcessedEvent, PedagogicalLog]),
  ],
  providers: [EventProcessorService, EventStreamConsumerService, EventStreamReclaimService],
  exports: [EventProcessorService],
})
export class EventsModule {}
