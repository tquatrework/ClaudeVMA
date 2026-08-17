import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from '../notification/entities/notification.entity';
import { ProcessedEvent } from './entities/processed-event.entity';
import { ProfileServiceClient } from './profile-service.client';
import { EventProcessorService } from './event-processor.service';
import { EventStreamConsumerService } from './event-stream-consumer.service';
import { EventStreamReclaimService } from './event-stream-reclaim.service';
import { ClientsModule } from '../common/clients/clients.module';

/**
 * Wires the Redis event consumer described in docs/architecture.md >
 * "Systeme de notifications transversal". Not part of NotificationModule
 * on purpose: it writes directly to the `Notification` repository inside
 * its own `DataSource.transaction` (atomic with the idempotency ledger),
 * a different concern from NotificationModule's HTTP-facing CRUD use
 * cases.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Notification, ProcessedEvent]), ClientsModule],
  providers: [ProfileServiceClient, EventProcessorService, EventStreamConsumerService, EventStreamReclaimService],
})
export class EventsModule {}
