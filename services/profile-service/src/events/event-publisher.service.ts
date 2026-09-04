import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import Redis from 'ioredis';
import { DomainEventOutbox } from './domain-event-outbox.entity';

/** Stream Redis partagé par tout le projet (arbitrage du 2026-08-14). */
export const DOMAIN_EVENTS_STREAM_KEY = 'visiomath:events';

const FLUSH_INTERVAL_MS = 2000;
const BATCH_SIZE = 50;

/**
 * Balaie périodiquement `domain_events` et publie chaque ligne non publiée
 * par `XADD` sur le stream Redis `visiomath:events`, sur le modèle déjà
 * construit pour `teacher-request-service` (arbitrage du 2026-08-14).
 *
 * PAS DE BLOCAGE AU DÉMARRAGE SI REDIS EST INDISPONIBLE. Bug réel corrigé le
 * 2026-09-04 côté `communication-service` (voir son rapport de session) :
 * une indisponibilité Redis bloquait indéfiniment `onModuleInit`. Ici,
 * `onModuleInit` ne fait qu'ouvrir la connexion (non bloquant côté ioredis
 * par défaut) et démarrer le minuteur ; toute erreur de connexion est
 * journalisée et n'empêche jamais le service de répondre aux requêtes HTTP —
 * seule la publication des événements reste en attente, rattrapée dès que
 * Redis redevient joignable.
 *
 * `REDIS_URL` ABSENT : dégradation explicite. Le service continue de
 * fonctionner (les tests e2e/unitaires n'ont pas de Redis) ; les lignes
 * d'outbox s'accumulent simplement, non publiées, jusqu'à ce que `REDIS_URL`
 * soit configuré — jamais une erreur au démarrage pour une variable
 * optionnelle par nature dans ces environnements.
 */
@Injectable()
export class EventPublisherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventPublisherService.name);
  private redis: Redis | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private flushing = false;

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(DomainEventOutbox)
    private readonly outboxRepo: Repository<DomainEventOutbox>,
  ) {}

  onModuleInit(): void {
    const redisUrl = this.config.get<string>('REDIS_URL');
    if (!redisUrl) {
      this.logger.warn(
        'REDIS_URL non configuré : les événements de domaine sont écrits dans "domain_events" ' +
          'mais ne seront jamais publiés sur le bus tant que cette variable est absente.',
      );
      return;
    }

    // `maxRetriesPerRequest: null` + gestion explicite de `error` : une
    // coupure Redis ne doit jamais faire planter le processus ni bloquer son
    // démarrage — même correctif que celui trouvé le 2026-09-04 côté
    // `communication-service`.
    this.redis = new Redis(redisUrl, { maxRetriesPerRequest: null, lazyConnect: false });
    this.redis.on('error', (err) => {
      this.logger.error(`Connexion Redis en erreur : ${err.message}`);
    });

    this.timer = setInterval(() => {
      this.flush().catch((err) => {
        this.logger.error(`Échec du balayage de l'outbox d'événements : ${(err as Error).message}`);
      });
    }, FLUSH_INTERVAL_MS);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.redis) {
      // Fermeture explicite : sans elle, la connexion Redis ouverte empêche
      // le processus Node de se terminer proprement (même bug trouvé et
      // corrigé le 2026-09-04 côté `communication-service`).
      await this.redis.quit().catch(() => undefined);
      this.redis = null;
    }
  }

  /**
   * Balaie les lignes non publiées, les publie par ordre de création, et
   * marque chacune publiée dès que le `XADD` correspondant réussit.
   *
   * S'ARRÊTE AU PREMIER ÉCHEC du cycle : un échec de `XADD` signale
   * généralement une indisponibilité Redis plutôt qu'un problème propre à
   * cette ligne — continuer à essayer les lignes suivantes du même lot
   * échouerait de la même façon et n'apporterait rien. Le prochain balayage
   * (2 secondes plus tard) reprend là où celui-ci s'est arrêté.
   */
  private async flush(): Promise<void> {
    if (!this.redis || this.flushing) return;
    this.flushing = true;
    try {
      const pending = await this.outboxRepo.find({
        where: { publishedAt: IsNull() },
        order: { createdAt: 'ASC' },
        take: BATCH_SIZE,
      });

      for (const row of pending) {
        try {
          await this.redis.xadd(
            DOMAIN_EVENTS_STREAM_KEY,
            '*',
            'eventId',
            row.id,
            'type',
            row.type,
            'occurredAt',
            row.occurredAt.toISOString(),
            'payload',
            JSON.stringify(row.payload),
          );
        } catch (err) {
          this.logger.error(
            `Échec de publication de l'événement ${row.id} (${row.type}) sur Redis : ` +
              `${(err as Error).message}. Ligne laissée non publiée, retentative au prochain ` +
              'balayage.',
          );
          return;
        }

        row.publishedAt = new Date();
        await this.outboxRepo.save(row);
      }
    } finally {
      this.flushing = false;
    }
  }
}
