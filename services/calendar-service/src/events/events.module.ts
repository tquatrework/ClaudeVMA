import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DomainEvent } from './entities/domain-event.entity';
import { EventsService } from './events.service';
import { EventPublisher } from './event-publisher.service';

@Module({
  imports: [TypeOrmModule.forFeature([DomainEvent])],
  providers: [EventsService, EventPublisher],
  exports: [EventsService, EventPublisher, TypeOrmModule],
})
export class EventsModule {}
