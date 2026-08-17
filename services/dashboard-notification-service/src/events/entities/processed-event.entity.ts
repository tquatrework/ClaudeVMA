import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Unique } from 'typeorm';

/**
 * Idempotency ledger for events consumed from the Redis stream
 * `visiomath:events`. Publication is not transactional on the producer
 * side (`XADD` then a separate `UPDATE published_at`, per
 * `docs/architecture.md` > "Systeme de notifications transversal", point 2):
 * a crash between the two can republish the same `eventId`. This table is
 * how the consumer deduplicates before creating a notification, never
 * relying on stream delivery being exactly-once.
 */
@Entity('processed_events')
@Unique('UQ_processed_events_event_id', ['eventId'])
export class ProcessedEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'event_id' })
  eventId: string;

  @Column({ name: 'event_name' })
  eventName: string;

  @CreateDateColumn({ name: 'processed_at' })
  processedAt: Date;
}
