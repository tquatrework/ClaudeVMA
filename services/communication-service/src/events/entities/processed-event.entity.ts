import { Entity, PrimaryColumn, CreateDateColumn } from 'typeorm';

/**
 * Dedup table for the Redis stream consumer.
 *
 * `XADD` on the producer side is not transactional with its own domain write (see DomainEvent),
 * so a crash can republish the same `eventId` after a restart. dashboard-notification-service
 * already follows this exact discipline (2026-08-14) — deduplicate by `eventId` *before* acting
 * on an event, never assume at-most-once delivery from the stream itself.
 */
@Entity('processed_events')
export class ProcessedEvent {
  /** The `eventId` field carried by the stream entry (not our own primary key elsewhere). */
  @PrimaryColumn({ name: 'event_id' })
  eventId: string;

  @CreateDateColumn({ name: 'processed_at' })
  processedAt: Date;
}
