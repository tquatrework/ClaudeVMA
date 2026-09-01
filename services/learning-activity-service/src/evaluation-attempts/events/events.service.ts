import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { DomainEvent } from '../entities/domain-event.entity';
import { EventPublisherService } from './event-publisher.service';

const RETRY_INTERVAL_MS = 15_000;
const RETRY_BATCH_SIZE = 50;

/**
 * Écrit chaque événement dans l'outbox transactionnel (`domain_events`) AVANT
 * toute tentative de publication — garantit qu'aucun événement métier n'est
 * perdu même si Redis est indisponible au moment de l'action. Un
 * publisher de repli (setInterval) republie périodiquement les lignes non
 * publiées, avec le même contrat *at-least-once* que teacher-request-service
 * (docs/architecture.md > « Systeme de notifications transversal »,
 * points 1-2) : `dashboard-notification-service` doit dédupliquer par
 * `eventId`, jamais supposer une livraison unique.
 *
 * `emit()` ne fait jamais échouer l'action métier appelante : une erreur de
 * publication immédiate est journalisée et laissée au cycle de rattrapage,
 * jamais propagée en exception (créer une demande de correction doit
 * réussir même si Redis est en panne).
 */
@Injectable()
export class EventsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventsService.name);
  private retryHandle: NodeJS.Timeout | null = null;

  constructor(
    @InjectRepository(DomainEvent)
    private readonly domainEventRepository: Repository<DomainEvent>,
    private readonly publisher: EventPublisherService,
  ) {}

  onModuleInit(): void {
    this.retryHandle = setInterval(() => {
      this.publishUnpublished().catch((error) => {
        this.logger.error(`Échec du cycle de republication des événements en attente: ${error}`);
      });
    }, RETRY_INTERVAL_MS);
  }

  onModuleDestroy(): void {
    if (this.retryHandle) {
      clearInterval(this.retryHandle);
    }
  }

  async emit(
    eventType: string,
    payload: Record<string, unknown>,
    correlationId?: string,
  ): Promise<void> {
    const event = await this.domainEventRepository.save(
      this.domainEventRepository.create({
        eventType,
        payload,
        correlationId: correlationId ?? null,
        publishedAt: null,
      }),
    );

    try {
      await this.publisher.publish({
        id: event.id,
        eventType: event.eventType,
        payload: event.payload,
        correlationId: event.correlationId,
      });
      event.publishedAt = new Date();
      await this.domainEventRepository.save(event);
    } catch (error) {
      this.logger.error(
        `Échec de publication immédiate de l'événement ${eventType} (${event.id}), ` +
          `nouvelle tentative différée par le cycle de rattrapage: ${error}`,
      );
    }
  }

  private async publishUnpublished(): Promise<void> {
    const pending = await this.domainEventRepository.find({
      where: { publishedAt: IsNull() },
      order: { createdAt: 'ASC' },
      take: RETRY_BATCH_SIZE,
    });

    for (const event of pending) {
      try {
        await this.publisher.publish({
          id: event.id,
          eventType: event.eventType,
          payload: event.payload,
          correlationId: event.correlationId,
        });
        event.publishedAt = new Date();
        await this.domainEventRepository.save(event);
      } catch (error) {
        this.logger.error(
          `Échec de republication de l'événement ${event.eventType} (${event.id}): ${error}`,
        );
        // Redis est probablement indisponible : inutile d'insister sur le
        // reste du lot dans ce même cycle, on retentera au prochain tick.
        break;
      }
    }
  }
}
