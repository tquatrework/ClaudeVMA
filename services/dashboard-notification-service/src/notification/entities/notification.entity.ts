import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

/**
 * Known notification types. Backed by a plain `varchar` column (see the
 * migration `NotificationEventsConsumer`), not a Postgres native enum —
 * this is a deliberate technical decision (2026-08-14): a Postgres enum
 * can only grow via `ALTER TYPE ... ADD VALUE`, which cannot run inside a
 * transaction and cannot remove a value. As more services adopt the same
 * outbox + `XADD` pattern on `visiomath:events`, this list will keep
 * growing — a `varchar` column plus this TypeScript enum (used for
 * application-level validation on `class-validator` DTOs) is far cheaper
 * to extend than a native enum, at the cost of losing a database-level
 * constraint we did not rely on anyway (validation already happens in
 * the application layer via `@IsEnum`).
 */
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
  // Ajoutés le 2026-08-14 pour le flow de demande de professeur consommé
  // depuis le flux Redis `visiomath:events` — voir EventProcessorService.
  TEACHER_PROPOSAL_SENT = 'teacher_proposal_sent',
  TEACHER_PROPOSAL_ACCEPTED = 'teacher_proposal_accepted',
  TEACHER_PROPOSAL_DECLINED = 'teacher_proposal_declined',
  TEACHER_PROPOSAL_NOT_SELECTED = 'teacher_proposal_not_selected',
  TEACHER_PROPOSAL_EXPIRED = 'teacher_proposal_expired',
  TEACHER_ASSIGNED = 'teacher_assigned',
  TEACHER_REQUEST_STATUS_UPDATED = 'teacher_request_status_updated',
}

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ type: 'varchar', length: 64, default: NotificationType.SYSTEM })
  type: NotificationType;

  // Nullable since 2026-08-14: notifications created from the Redis event
  // consumer never invent a French sentence server-side (single point of
  // technical-to-French translation stays on the front, per the
  // 2026-08-09 language rule). `metadata` is the source of truth for
  // those notifications; `title`/`message` remain populated for
  // notifications created through `POST /internal/notify` (orchestrator).
  @Column({ nullable: true })
  title: string | null;

  @Column({ type: 'text', nullable: true })
  message: string | null;

  @Column({ name: 'is_read', default: false })
  isRead: boolean;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
