import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

/**
 * Transactional outbox: a row is written in the same transaction as the business change it
 * describes, and a background loop (EventPublisherService) later `XADD`s it onto the shared
 * Redis stream `visiomath:events` and stamps `publishedAt`.
 *
 * Same pattern already built for teacher-request-service (arbitrage du 2026-08-12, "Suite
 * immediate — les notifications, etape 7") and consumed since by dashboard-notification-service
 * (2026-08-14) — replicated here rather than reinvented, so that
 * dashboard-notification-service (or any future consumer) can subscribe without special-casing
 * communication-service.
 */
@Entity('domain_events')
@Index(['publishedAt'])
export class DomainEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'event_name' })
  eventName: string;

  @Column({ name: 'aggregate_type' })
  aggregateType: string;

  @Column({ name: 'aggregate_id' })
  aggregateId: string;

  @Column({ name: 'correlation_id', nullable: true })
  correlationId: string | null;

  @Column({ type: 'jsonb' })
  payload: Record<string, unknown>;

  @CreateDateColumn({ name: 'occurred_at' })
  occurredAt: Date;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt: Date | null;
}
