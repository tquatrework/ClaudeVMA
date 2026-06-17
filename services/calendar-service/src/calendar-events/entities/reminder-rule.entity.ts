import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { CalendarEvent } from './calendar-event.entity';

export enum ReminderDelay {
  ONE_WEEK = '1week',
  ONE_DAY = '1day',
  ONE_HOUR = '1hour',
  FIFTEEN_MIN = '15min',
  NONE = 'none',
}

/**
 * A reminder rule attached to a CalendarEvent for a specific user.
 * Specifies when to trigger a notification before the event.
 */
@Entity('reminder_rules')
export class ReminderRule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => CalendarEvent, (event) => event.reminderRules, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'event_id' })
  event: CalendarEvent;

  @Column({ name: 'event_id' })
  eventId: string;

  /** User this reminder rule applies to */
  @Column({ name: 'owner_id' })
  ownerId: string;

  @Column({ type: 'varchar', default: ReminderDelay.ONE_HOUR })
  delay: ReminderDelay;

  @Column({ name: 'is_sent', default: false })
  isSent: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
