import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

/**
 * A reminder attached to a user profile or a scheduled activity (CAL-BR-004).
 */
@Entity('reminders')
export class Reminder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** User this reminder is for */
  @Column({ name: 'owner_id' })
  ownerId: string;

  @Column({ name: 'owner_role' })
  ownerRole: string;

  /** Optional link to a ScheduledActivity */
  @Column({ name: 'activity_id', nullable: true })
  activityId: string | null;

  @Column()
  message: string;

  @Column({ name: 'remind_at', type: 'timestamptz' })
  remindAt: Date;

  @Column({ name: 'is_sent', default: false })
  isSent: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
