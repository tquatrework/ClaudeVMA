import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export enum NotificationType {
  REQUEST_ACCEPTED = 'request_accepted',
  REQUEST_DECLINED = 'request_declined',
  SESSION_REMINDER = 'session_reminder',
  NEW_MESSAGE = 'new_message',
  SESSION_CANCELLED = 'session_cancelled',
  PAYMENT_FAILED = 'payment_failed',
  TEACHER_REQUEST_CREATED = 'teacher_request_created',
  ACTIVITY_SCHEDULED = 'activity_scheduled',
  CONTENT_PENDING_VALIDATION = 'content_pending_validation',
  ACCOUNT_CREATED = 'account_created',
  SYSTEM = 'system',
}

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ type: 'enum', enum: NotificationType, default: NotificationType.SYSTEM })
  type: NotificationType;

  @Column()
  title: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ name: 'is_read', default: false })
  isRead: boolean;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
