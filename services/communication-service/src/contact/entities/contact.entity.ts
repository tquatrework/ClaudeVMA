import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

export type ContactStatus = 'active' | 'broken';
export type ContactOrigin = 'default' | 'request';

/**
 * A bidirectional Contact between two users.
 *
 * docs/architecture/contacts-messagerie.md (2026-09-04), point 5 — "le contact est toujours
 * bidirectionnel" : exactly one row represents the relationship between `userAId` and
 * `userBId` (canonically ordered, see ContactService.canonicalPair), never two asymmetric rows
 * for the same pair.
 *
 * Non-destructive lifecycle (point 6) — breaking a contact never deletes the row, it flips
 * `status` to 'broken' and records `brokenAt`/`brokenBy`. Only one ACTIVE row may exist per pair
 * at a time (partial unique index below) — same convention already used by profile-service for
 * the finance-owner-student / teacher-student relations: a broken contact can be re-requested
 * later, which creates a brand new row rather than resurrecting the old one, so the old row
 * remains as proof the contact existed, then ended, and when.
 */
@Entity('contacts')
@Index('idx_contacts_active_pair', ['userAId', 'userBId'], {
  unique: true,
  where: `status = 'active'`,
})
@Index(['userAId'])
@Index(['userBId'])
export class Contact {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Canonically the smaller of the two userIds (string comparison) — see canonicalPair(). */
  @Column({ name: 'user_a_id' })
  userAId: string;

  /** Canonically the larger of the two userIds. */
  @Column({ name: 'user_b_id' })
  userBId: string;

  @Column({ type: 'varchar', default: 'active' })
  status: ContactStatus;

  /**
   * How this contact came to be: derived automatically from a profile-service business
   * relation without any request ('default', point 4), or accepted through the manual
   * contact-request flow ('request', points 2-3).
   */
  @Column({ type: 'varchar' })
  origin: ContactOrigin;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'broken_at', type: 'timestamptz', nullable: true })
  brokenAt: Date | null;

  /** userId of whichever of the two parties broke the contact. */
  @Column({ name: 'broken_by', nullable: true })
  brokenBy: string | null;
}
