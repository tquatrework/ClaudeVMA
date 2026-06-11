import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum IncidentStatus {
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  RESOLVED = 'resolved',
  CLOSED = 'closed',
}

/**
 * An incident thread opened by TI (COM-RA-006).
 * It creates a conversation marked as incident=true and tracks the incident lifecycle.
 */
@Entity('incident_threads')
export class IncidentThread {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** The conversation backing this incident thread */
  @Column({ name: 'conversation_id' })
  conversationId: string;

  /** TI user who opened the incident */
  @Column({ name: 'opened_by' })
  openedBy: string;

  /** Target user affected by the incident */
  @Column({ name: 'target_user_id' })
  targetUserId: string;

  @Column({ type: 'text' })
  description: string;

  @Column({
    type: 'enum',
    enum: IncidentStatus,
    default: IncidentStatus.OPEN,
  })
  status: IncidentStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
