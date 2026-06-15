import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

export enum PaymentEntryStatus {
  PENDING = 'pending',
  PAID = 'paid',
  OVERDUE = 'overdue',
  CANCELLED = 'cancelled',
}

/**
 * Financial schedule entry visible (read-only) to PARENT_FINANCEUR (CAL-BR-003).
 * Created/updated by finance-credit-service; calendar-service exposes it read-only.
 */
@Entity('payment_schedule_entries')
export class PaymentScheduleEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Owner is a PARENT_FINANCEUR */
  @Column({ name: 'owner_id' })
  ownerId: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ name: 'due_date', type: 'timestamptz' })
  dueDate: Date;

  @Column({ type: 'varchar', default: PaymentEntryStatus.PENDING })
  status: PaymentEntryStatus;

  @Column({ nullable: true, type: 'text' })
  label: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
