import { Entity, PrimaryColumn, Column, CreateDateColumn } from 'typeorm';

/**
 * ProcessedEvent — dedup ledger for the `visiomath:events` Redis stream consumer.
 *
 * Publication on calendar-service's side is not transactional with marking the
 * outbox row as published (`XADD` then `UPDATE published_at` in two steps,
 * documented in docs/routes.md > calendar-service): a crash between the two
 * republishes the same `eventId` at restart. Idempotence is therefore the
 * consumer's responsibility (same rule already applied to
 * dashboard-notification-service, docs/architecture.md, arbitrage 2026-08-14,
 * point 2). `eventId` is the primary key: a second insert attempt for an
 * already-processed event fails on the unique constraint and the event is
 * skipped without side effects.
 */
@Entity('processed_events')
export class ProcessedEvent {
  @PrimaryColumn({ name: 'event_id' })
  eventId: string;

  @Column({ name: 'event_name' })
  eventName: string;

  @CreateDateColumn({ name: 'processed_at' })
  processedAt: Date;
}
