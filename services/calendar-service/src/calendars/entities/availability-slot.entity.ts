import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Calendar } from './calendar.entity';

export enum SlotRecurrence {
  NONE = 'none',
  WEEKLY = 'weekly',
  BIWEEKLY = 'biweekly',
}

/**
 * A time window during which the owner is available (CAL-BR-001, CAL-BR-002).
 */
@Entity('availability_slots')
export class AvailabilitySlot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Calendar, (calendar) => calendar.availabilitySlots, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'calendar_id' })
  calendar: Calendar;

  @Column({ name: 'calendar_id' })
  calendarId: string;

  /** Day of week (0=Sunday … 6=Saturday) for recurring slots, null for one-off */
  @Column({ name: 'day_of_week', nullable: true, type: 'int' })
  dayOfWeek: number | null;

  @Column({ name: 'start_time', type: 'timestamptz' })
  startTime: Date;

  @Column({ name: 'end_time', type: 'timestamptz' })
  endTime: Date;

  @Column({
    type: 'varchar',
    default: SlotRecurrence.NONE,
  })
  recurrence: SlotRecurrence;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
