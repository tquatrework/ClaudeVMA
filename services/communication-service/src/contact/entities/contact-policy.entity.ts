import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export type ContactStatus = 'active' | 'precontact';
export type ContactVisibility = 'visible' | 'hidden';

/**
 * Records authorized contact relationships for a given user.
 * COM-BR-010: contacts are computed from business relations (profile-service), not freely entered.
 * COM-BR-004: a parent may contact only linked students, their PP, temporary teachers during
 *             the authorized window, and administrators.
 */
@Entity('contact_policies')
@Index(['userId', 'contactId'], { unique: true })
export class ContactPolicy {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** The user who is allowed to initiate contact */
  @Column({ name: 'user_id' })
  userId: string;

  /** The user who can be contacted */
  @Column({ name: 'contact_id' })
  contactId: string;

  /**
   * Optional expiry for time-limited contact windows.
   * COM-BR-004 / COM-FB-001: parent cannot contact a temporary teacher outside the window.
   */
  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt: Date;

  /** Source relation type for audit purposes (e.g. "teacher-student", "parent-student") */
  @Column({ name: 'relation_type', nullable: true })
  relationType: string;

  @Column({ default: true })
  active: boolean;

  /**
   * Contact lifecycle status.
   * - 'precontact': contact has been authorized by the system but not yet confirmed by the user.
   * - 'active': contact is fully usable for messaging.
   */
  @Column({
    type: 'varchar',
    name: 'status',
    default: 'active',
  })
  status: ContactStatus;

  /**
   * Whether this contact can be removed by the user.
   * Mandatory contacts (e.g. administrators, assigned teachers) cannot be deleted.
   */
  @Column({ name: 'mandatory', default: false })
  mandatory: boolean;

  /**
   * User-defined display preference for this contact.
   * Hidden contacts remain authorized but are filtered from the default list view.
   */
  @Column({
    type: 'varchar',
    name: 'visibility',
    default: 'visible',
  })
  visibility: ContactVisibility;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
