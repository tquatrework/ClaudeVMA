import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export interface DomainEventToPublish {
  id: string;
  eventType: string;
  payload: unknown;
  correlationId?: string | null;
}

/**
 * Publie un événement de domaine sur le flux Redis `visiomath:events` par
 * XADD — même transport que teacher-request-service
 * (docs/architecture.md > « Systeme de notifications transversal », point 1).
 * Ce service ne connaît jamais de groupe de consommateurs : c'est
 * dashboard-notification-service qui consomme via XREADGROUP.
 *
 * Le client Redis est créé en lazyConnect pour ne jamais bloquer le
 * démarrage de l'application si Redis est temporairement indisponible — la
 * connexion est tentée à la première publication, et toute erreur est
 * propagée à l'appelant (EventsService), qui la traite comme un échec
 * différé plutôt qu'un blocage de l'action métier.
 */
@Injectable()
export class EventPublisherService implements OnModuleDestroy {
  private readonly logger = new Logger(EventPublisherService.name);
  private readonly streamKey = 'visiomath:events';
  private client: Redis | null = null;

  constructor(private readonly configService: ConfigService) {
    const redisUrl = this.configService.get<string>('REDIS_URL');
    if (!redisUrl) {
      this.logger.warn('REDIS_URL non configuré : publication des événements désactivée');
      return;
    }

    this.client = new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 1 });
    this.client.on('error', (error) => {
      this.logger.error(`Erreur de connexion Redis : ${error.message}`);
    });
  }

  async publish(event: DomainEventToPublish): Promise<void> {
    if (!this.client) {
      throw new Error('Redis non configuré (REDIS_URL absent) : publication impossible');
    }

    await this.client.xadd(
      this.streamKey,
      '*',
      'eventId',
      event.id,
      'eventType',
      event.eventType,
      'payload',
      JSON.stringify(event.payload),
      'correlationId',
      event.correlationId ?? '',
    );
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      await this.client.quit().catch(() => undefined);
    }
  }
}
