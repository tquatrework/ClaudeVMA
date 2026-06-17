import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { CalendarEvent } from './calendar-event.entity';

export enum CancellationStatus {
  /** Cancellation within 48h of event — requires approval */
  PENDING_APPROVAL = 'pending_approval',
  /** Cancellation more than 48h before event — automatically applied */
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

/**
 * A request to cancel a CalendarEvent.
 * Business rule: if cancellation is requested less than 48h before the event,
 * the status is PENDING_APPROVAL and requires explicit approval.
 * Otherwise it is automatically APPROVED.
 */
@Entity('cancellation_requests')
export class CancellationRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => CalendarEvent, (event) => event.cancellationRequests, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'event_id' })
  event: CalendarEvent;

  @Column({ name: 'event_id' })
  eventId: string;

  /** User requesting the cancellation */
  @Column({ name: 'requester_id' })
  requesterId: string;

  @Column({ type: 'varchar', default: CancellationStatus.PENDING_APPROVAL })
  status: CancellationStatus;

  @Column({ nullable: true, type: 'text' })
  reason: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
