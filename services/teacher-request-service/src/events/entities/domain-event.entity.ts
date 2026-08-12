import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

/**
 * Boite d'envoi (outbox) des evenements metier.
 *
 * Contrepartie non negociable de l'arbitrage du 2026-08-12, point 7 : un
 * evenement qui n'est qu'un `logger.log` n'est pas un evenement. Chaque
 * evenement est ecrit ICI, dans la MEME transaction que le changement d'etat
 * qui le produit — un evenement ne peut donc jamais mentir sur l'etat de la
 * base, ni disparaitre parce que le bus etait indisponible.
 *
 * La publication vers le bus est un second temps, rejouable : tant que
 * `publishedAt` est nul, l'evenement sera represente. Un abonne
 * (dashboard-notification-service) se branche sans qu'aucune ligne du workflow
 * ne bouge.
 */
@Entity('domain_events')
export class DomainEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Nom metier de l'evenement, ex. `TeacherRequestCreated`. */
  @Index()
  @Column({ name: 'event_name' })
  eventName: string;

  /** Type d'agregat concerne, ex. `TeacherRequest`. */
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
