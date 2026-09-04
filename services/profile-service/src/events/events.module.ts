import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventsService } from './events.service';
import { EventPublisherService } from './event-publisher.service';
import { DomainEventOutbox } from './domain-event-outbox.entity';

/**
 * Depuis le 2026-09-04 : ce module possède aussi l'outbox `domain_events` et
 * le balayeur qui la publie sur Redis (`EventPublisherService`), en plus du
 * publieur consommé par le reste du service (`EventsService`). Voir
 * `DomainEventOutbox` et `EventPublisherService` pour le contexte complet.
 */
@Module({
  imports: [TypeOrmModule.forFeature([DomainEventOutbox])],
  providers: [EventsService, EventPublisherService],
  exports: [EventsService],
})
export class EventsModule {}
