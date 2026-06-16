import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { EventInvitation } from './event-invitation.entity';
import { CancellationRequest } from './cancellation-request.entity';
import { ReminderRule } from './reminder-rule.entity';

export enum EventType {
  COURS = 'cours',
  MASTERCLASS = 'masterclass',
  PEDAGOGIQUE = 'pedagogique',
  FINANCIER = 'financier',
  RAPPEL = 'rappel',
  INVITATION = 'invitation',
}

export enum CalendarEventStatus {
  ACTIVE = 'active',
  CANCELLED = 'cancelled',
}

/**
 * A calendar event in the VisioMath central calendar.
 * Supports multi-domain aggregation: cours, masterclass, pedagogique, financier, rappel, invitation.
 */
@Entity('calendar_events')
export class CalendarEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Calendar (ownerId) this event belongs to */
  @Column({ name: 'owner_id' })
  ownerId: string;

  @Column()
  title: string;

  @Column({ name: 'event_type', type: 'varchar' })
  eventType: EventType;

  @Column({ name: 'creator_id' })
  creatorId: string;

  @Column({ name: 'creator_role' })
  creatorRole: string;

  @Column({ name: 'start_time', type: 'timestamptz' })
  startTime: Date;

  @Column({ name: 'end_time', type: 'timestamptz' })
  endTime: Date;

  @Column({ type: 'varchar', default: CalendarEventStatus.ACTIVE })
  status: CalendarEventStatus;

  @Column({ nullable: true, type: 'text' })
  description: string | null;

  /** Optional link to an external entity (e.g., activity ID, payment ID) */
  @Column({ name: 'target_ref', nullable: true, type: 'text' })
  targetRef: string | null;

  @OneToMany(() => EventInvitation, (invitation) => invitation.event, { cascade: true, eager: false })
  invitations: EventInvitation[];

  @OneToMany(() => CancellationRequest, (request) => request.event, { cascade: true, eager: false })
  cancellationRequests: CancellationRequest[];

  @OneToMany(() => ReminderRule, (rule) => rule.event, { cascade: true, eager: false })
  reminderRules: ReminderRule[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
