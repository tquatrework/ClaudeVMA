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
  // Bug réel corrigé le 2026-08-20 (invitation d'événement invisible pour l'invité) :
  // notification créée quand `CalendarEventCreated` porte au moins un invité
  // (docs/routes.md § dashboard-notification-service > "Consommateur d'événements").
  | 'event_invitation_received'
  // Chantier « Refonte des Évaluations », flow de demande de correction (2026-09-01/02) :
  // docs/routes.md § learning-activity-service > « Événements émis », consommés par
  // dashboard-notification-service (.claude/reports/dashboard-notification-service-evaluations-2026-09-02.md).
  | 'evaluation_correction_requested'
  | 'evaluation_correction_accepted'
  | 'evaluation_correction_declined'
  | 'evaluation_correction_all_declined'
  | 'evaluation_corrected'
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
  /** `event_invitation_received` — nom du créateur de l'événement de calendrier auquel le
   * destinataire est invité (jamais un UUID). */
  creatorName?: string | null
  /** `event_invitation_received` — identifiant de l'événement (`CalendarEvent`), réservé à un
   * usage futur de lien profond, jamais affiché à l'écran. */
  eventId?: string
  /** `event_invitation_received` — type de l'événement (`cours`, `rappel`, …). */
  eventType?: string
  /** `event_invitation_received` — titre de l'événement, `null` si l'événement n'en a pas
   * (le titre est réellement optionnel côté serveur, voir `docs/routes.md`). */
  title?: string | null
  /** `event_invitation_received` — horodatage ISO de l'événement (`payload.startTime`). */
  startAt?: string
  /** Demande de correction d'Évaluation — identifiants réservés à un usage futur de lien
   * profond (`GET /evaluation-corrections/:id`), jamais affichés à l'écran. */
  correctionRequestId?: string
  attemptId?: string
  evaluationId?: string
  /** `evaluation_correction_all_declined` — motif de l'escalade au RP : soit tous les
   * professeurs liés ont refusé, soit l'élève n'a aucun professeur lié. */
  reason?: 'all_linked_teachers_declined' | 'no_linked_teacher' | (string & {})
  /** `evaluation_corrected` — note attribuée par le correcteur, potentiellement négative
   * (pénalités) ou décimale ; formater avec `formatQuizScore` plutôt qu'afficher brut. */
  score?: number | string | null
  /** `evaluation_corrected` — commentaire du correcteur, optionnel. */
  comment?: string | null
  /** Demande de contact (`contact_request_received`/`accepted`/`declined`) — noms déjà
   * résolus par dashboard-notification-service, jamais un UUID. `requestId` (déjà déclaré
   * plus haut) est réutilisé, réservé à un usage futur de lien profond. */
  requesterId?: string
  requesterName?: string | null
  targetId?: string
  targetName?: string | null
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

/**
 * Contact actif affiché dans une carte de tableau de bord ("Contacts importants").
 * `id` sert à naviguer vers la messagerie (bouton "Écrire") — jamais affiché comme
 * libellé. `counterpartId` est l'identifiant de la personne, nécessaire pour
 * démarrer une conversation (`useMessages.startConversationWith`).
 *
 * Réaligné le 2026-09-05 sur le modèle Contact réel de communication-service
 * (docs/architecture/contacts-messagerie.md, 2026-09-04) : `role`/`email`/`mandatory`
 * n'existent plus côté serveur, retirés.
 */
export interface DashboardContact {
  id: string
  counterpartId: string
  displayName: string
}

export interface DashboardReminder {
  id: string
  title: string
  dueAt?: string
}
