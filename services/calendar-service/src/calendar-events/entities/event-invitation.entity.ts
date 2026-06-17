import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { CalendarEvent } from './calendar-event.entity';

export enum InvitationStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  DECLINED = 'declined',
}

/**
 * An invitation sent to a user for a CalendarEvent.
 * Status transitions: pending → accepted | declined.
 * A declined invitation removes the event from the invitee's calendar.
 */
@Entity('event_invitations')
export class EventInvitation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => CalendarEvent, (event) => event.invitations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'event_id' })
  event: CalendarEvent;

  @Column({ name: 'event_id' })
  eventId: string;

  /** User invited to the event */
  @Column({ name: 'invitee_id' })
  inviteeId: string;

  @Column({ type: 'varchar', default: InvitationStatus.PENDING })
  status: InvitationStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
