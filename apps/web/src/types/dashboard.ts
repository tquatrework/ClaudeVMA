/**
 * Types partagés — Dashboard et notifications
 * Source API : GET /notifications · GET /notifications/unread-count ·
 * POST /notifications/:id/read · GET /contacts · GET /dashboards/me
 */

/**
 * Types techniques connus émis par le flow « demande de professeur »
 * (dashboard-notification-service, système de notifications transversal,
 * arbitrage du 2026-08-14). `(string & {})` conserve l'auto-complétion sur les
 * valeurs connues tout en acceptant tout type futur ou hérité sans casser le
 * typage — voir `src/utils/notificationLabels.ts` pour la résolution en phrase
 * française.
 */
export type NotificationType =
  | 'teacher_request_created'
  | 'teacher_proposal_sent'
  | 'teacher_proposal_accepted'
  | 'teacher_proposal_declined'
  | 'teacher_proposal_not_selected'
  | 'teacher_proposal_expired'
  | 'teacher_assigned'
  | 'teacher_request_status_updated'
  // Chantier calendrier de disponibilités, point 3 (2026-08-19) : notification créée par
  // dashboard-notification-service quand une proposition de créneau de cours est envoyée
  // (docs/routes.md § dashboard-notification-service > "Consommateur d'événements").
  | 'course_slot_proposed'
  | (string & {})

/**
 * `metadata` porte des noms déjà résolus (`studentName`, `teacherName`, `proposerName`), jamais
 * d'UUID à afficher — règle du 2026-08-09. `requestId`/`proposalId`/`activityId` sont des
 * identifiants techniques réservés à un usage futur (lien profond), jamais affichés à l'écran.
 */
export interface NotificationMetadata {
  studentName?: string | null
  teacherName?: string | null
  requestId?: string
  proposalId?: string
  /** `course_slot_proposed` — nom du formateur/AP/RP à l'origine de la proposition de créneau. */
  proposerName?: string | null
  activityId?: string
  activityType?: string
  startTime?: string
}

export interface DashboardNotification {
  id: string
  userId: string
  type: NotificationType
  title: string
  message: string
  isRead: boolean
  metadata: NotificationMetadata | null
  createdAt: string
}

export interface DashboardContact {
  id: string
  displayName?: string
  role?: string
  email?: string
  status: string
  mandatory: boolean
}

export interface DashboardReminder {
  id: string
  title: string
  dueAt?: string
}
