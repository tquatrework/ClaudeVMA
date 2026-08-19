import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

/**
 * Boite d'envoi (outbox) des evenements metier de `calendar-service`.
 *
 * Avant cette entite, `EventsService.publish()` ecrivait UNE LIGNE DE LOG et
 * rien d'autre : aucun bus, aucun abonne. Contrepartie deja appliquee a
 * `teacher-request-service` le 2026-08-12 (« un evenement qui n'est qu'un
 * `logger.log` n'est pas un evenement »), reprise ici a l'identique pour le
 * chantier calendrier de disponibilites, point 3 (gap : `dashboard-
 * notification-service` doit pouvoir notifier une proposition de creneau de
 * cours).
 *
 * Schema et conventions de nommage copies fidelement de
 * `teacher-request-service/src/events/entities/domain-event.entity.ts` — meme
 * table, meme colonnes, meme flux Redis (`visiomath:events`, voir
 * `EventPublisher`) : un seul mecanisme d'outbox dans toute la plateforme,
 * pas un par service.
 */
@Entity('domain_events')
export class DomainEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Nom metier de l'evenement, ex. `ActivityScheduled`. */
  @Index()
  @Column({ name: 'event_name' })
  eventName: string;

  /** Type d'agregat concerne, ex. `ScheduledActivity`. */
  @Column({ name: 'aggregate_type' })
  aggregateType: string;

  /** Identifiant de l'agregat concerne. */
  @Index()
  @Column({ name: 'aggregate_id' })
  aggregateId: string;

  @Column({ type: 'jsonb' })
  payload: Record<string, unknown>;

  /** Correlation propagee depuis l'appel entrant (`x-correlation-id`). */
  @Column({ name: 'correlation_id', nullable: true })
  correlationId: string | null;

  @CreateDateColumn({ name: 'occurred_at' })
  occurredAt: Date;

  /** Nul tant que l'evenement n'a pas ete remis au bus. */
  @Index()
  @Column({ name: 'published_at', type: 'timestamp', nullable: true })
  publishedAt: Date | null;

  /** Nombre de tentatives de publication, pour diagnostic. */
  @Column({ name: 'publish_attempts', type: 'int', default: 0 })
  publishAttempts: number;
}
