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
  // Ajouté le 2026-08-19 pour le point 3 du chantier "calendrier de
  // disponibilités lié à la visio" (proposer/accepter/refuser un créneau
  // de cours) — consommé depuis l'événement `ActivityScheduled` déjà
  // publié par calendar-service, uniquement quand celui-ci porte un
  // `recipientId` unique (1 proposeur -> 1 destinataire). Distinct de
  // `ACTIVITY_SCHEDULED` ci-dessus (déjà présent dans cet enum mais resté
  // inutilisé depuis sa création) : ce nouveau type porte une sémantique
  // métier précise (« proposition de créneau »), pas une simple
  // planification d'activité générique. Voir EventProcessorService.
  COURSE_SLOT_PROPOSED = 'course_slot_proposed',
  // Ajouté le 2026-08-20 : un utilisateur invité à un CalendarEvent
  // (`POST /calendars/:ownerId/events`, `inviteeIds`) ne recevait jusqu'ici
  // aucune notification — bug réel signalé en conditions réelles, corrigé
  // côté visibilité calendrier le même jour côté calendar-service. Consommé
  // depuis `CalendarEventCreated`, un destinataire par élément
  // `payload.inviteeIds`. Voir EventProcessorService.
  EVENT_INVITATION_RECEIVED = 'event_invitation_received',
  // Ajoutés le 2026-09-02 pour le flow de correction manuelle d'une
  // tentative d'Évaluation (`docs/architecture.md`, « Refonte des
  // Evaluations : notation manuelle, demande de correction, notifications »,
  // arbitrage du 2026-09-01), consommés depuis les 5 événements publiés par
  // learning-activity-service sur `visiomath:events`
  // (`docs/routes.md` > learning-activity-service > « Événements émis »).
  // Voir EventProcessorService.
  EVALUATION_CORRECTION_REQUESTED = 'evaluation_correction_requested',
  EVALUATION_CORRECTION_ACCEPTED = 'evaluation_correction_accepted',
  EVALUATION_CORRECTION_DECLINED = 'evaluation_correction_declined',
  EVALUATION_CORRECTION_ALL_DECLINED = 'evaluation_correction_all_declined',
  EVALUATION_CORRECTED = 'evaluation_corrected',
  // Ajoutés le 2026-09-04 pour la fonctionnalité Contacts de
  // communication-service (`docs/architecture/contacts-messagerie.md`,
  // point 9), consommés depuis les 3 événements réels publiés sur
  // `visiomath:events`. Payload confirmé empiriquement (aucune demande de
  // contact réelle n'existait encore en production au moment de cette
  // session) via un aller-retour réel demande/accepte/refuse contre la
  // pile déployée, plutôt que supposé par analogie — voir
  // EventProcessorService et docs/services/dashboard-notification-service.md.
  CONTACT_REQUEST_RECEIVED = 'contact_request_received',
  CONTACT_REQUEST_ACCEPTED = 'contact_request_accepted',
  CONTACT_REQUEST_DECLINED = 'contact_request_declined',
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
