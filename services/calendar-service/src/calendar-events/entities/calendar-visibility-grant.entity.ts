import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

/**
 * A visibility grant created by a RP allowing a grantee user to read
 * another user's calendar.
 */
@Entity('calendar_visibility_grants')
export class CalendarVisibilityGrant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** The calendar owner whose calendar is being shared */
  @Column({ name: 'owner_id' })
  ownerId: string;

  /** The user being granted read access to ownerId's calendar */
  @Column({ name: 'grantee_id' })
  granteeId: string;

  /** RP who created this grant */
  @Column({ name: 'granted_by' })
  grantedBy: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
