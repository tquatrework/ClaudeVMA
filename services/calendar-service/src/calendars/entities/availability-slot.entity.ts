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
 * Whether a slot represents a window the owner is available in, or
 * explicitly unavailable in (e.g. a blocked-out period).
 * Added 2026-08-18 (calendrier de disponibilités, point 1) — every slot
 * created before this field existed represented an availability window,
 * hence the AVAILABLE default applied by the migration.
 */
export enum SlotKind {
  AVAILABLE = 'available',
  UNAVAILABLE = 'unavailable',
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

  /**
   * End date of the recurrence (inclusive instant). Null means the
   * recurrence has no end date — the pre-existing behaviour, preserved.
   * Only meaningful when `recurrence` is WEEKLY or BIWEEKLY.
   */
  @Column({ name: 'recurrence_end_date', type: 'timestamptz', nullable: true })
  recurrenceEndDate: Date | null;

  @Column({
    type: 'varchar',
    default: SlotKind.AVAILABLE,
  })
  kind: SlotKind;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
