import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

export type ContactRequestStatus = 'pending' | 'accepted' | 'declined';

/**
 * Directed contact request (requesterId -> targetId).
 *
 * docs/architecture/contacts-messagerie.md (2026-09-04), point 7 — "chaque refus est un
 * événement horodaté, journal append-only par paire dirigée". Rows are never deleted or
 * rewritten: this table IS the journal used to compute the refusal penalty (1-month cooldown
 * after a refusal, permanent block at the 3rd cumulative refusal for the same directed pair) —
 * no separate refusal-log table is needed, `status: 'declined'` rows already carry that history.
 */
@Entity('contact_requests')
@Index('idx_contact_requests_pending_pair', ['requesterId', 'targetId'], {
  unique: true,
  where: `status = 'pending'`,
})
@Index(['requesterId', 'targetId'])
export class ContactRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'requester_id' })
  requesterId: string;

  @Column({ name: 'target_id' })
  targetId: string;

  @Column({ type: 'varchar', default: 'pending' })
  status: ContactRequestStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'responded_at', type: 'timestamptz', nullable: true })
  respondedAt: Date | null;
}
