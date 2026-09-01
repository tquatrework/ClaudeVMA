import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

/**
 * Outbox transactionnel des événements de domaine émis par ce service —
 * même mécanisme que teacher-request-service (docs/architecture.md >
 * « Systeme de notifications transversal », point 1) : une ligne est écrite
 * ici avant toute tentative de publication sur le flux Redis
 * `visiomath:events` (XADD), pour garantir qu'aucun événement n'est perdu si
 * Redis est injoignable au moment de l'action métier — un
 * publisher de repli republie périodiquement les lignes non publiées
 * (`publishedAt IS NULL`).
 *
 * La publication n'est pas transactionnelle avec l'écriture métier ni avec
 * la mise à jour de `publishedAt` (XADD puis UPDATE en deux temps, comme
 * teacher-request-service) : `dashboard-notification-service` doit donc
 * dédupliquer par `id` (eventId), jamais supposer une livraison unique.
 */
@Entity('domain_events')
export class DomainEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  eventType: string;

  @Column({ type: 'jsonb' })
  payload: Record<string, unknown>;

  @Column({ nullable: true })
  correlationId: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @Index()
  @Column({ type: 'timestamptz', nullable: true })
  publishedAt: Date | null;
}
