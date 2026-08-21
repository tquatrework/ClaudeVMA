import { Entity, PrimaryColumn, Column, CreateDateColumn } from 'typeorm';

/**
 * Ledger d'idempotence par eventId (docs/routes.md > "Consommateur d'événements
 * — flux Redis visiomath:events") — même mécanisme que dashboard-notification-service
 * et video-session-service. La publication n'étant pas transactionnelle avec la
 * mise à jour de `published_at` côté producteur, un crash entre les deux peut
 * republier le même `eventId` : ce ledger empêche le double traitement.
 */
@Entity('processed_events')
export class ProcessedEvent {
  /** eventId porté par le flux Redis (champ `eventId` de l'enveloppe XADD) */
  @PrimaryColumn({ name: 'event_id' })
  eventId: string;

  @Column({ name: 'event_type' })
  eventType: string;

  @CreateDateColumn({ name: 'processed_at' })
  processedAt: Date;
}
