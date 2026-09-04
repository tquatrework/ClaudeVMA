import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DomainEvent } from './entities/domain-event.entity';
import { ProcessedEvent } from './entities/processed-event.entity';
import { EventPublisherService } from './event-publisher.service';
import { RedisClientProvider } from './redis-client.provider';

/**
 * Pure infrastructure: the transactional outbox (DomainEvent), the consumer dedup table
 * (ProcessedEvent), the shared Redis connection, and the background publisher. Deliberately
 * knows nothing about Contact/ContactRequest — the relation-event *consumer* (which does know
 * about them) lives in ContactModule, which imports this module, to avoid a circular
 * dependency.
 */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([DomainEvent, ProcessedEvent])],
  providers: [RedisClientProvider, EventPublisherService],
  exports: [TypeOrmModule, RedisClientProvider, EventPublisherService],
})
export class EventsModule {}
