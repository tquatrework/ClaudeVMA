/**
 * Point unique de correspondance type technique → libellé français, pour les
 * notifications de `dashboard-notification-service` (système de notifications
 * transversal, arbitrage du 2026-08-14).
 *
 * Même modèle que `utils/teacherRequestLabels.ts` : les noms techniques restent
 * en anglais côté API, la traduction se fait en un seul endroit côté front
 * (règle de langue du 2026-08-09).
 *
 * `metadata` porte des noms déjà résolus par le serveur (`studentName`,
 * `teacherName`), jamais un UUID (arbitrage du 2026-08-09) : quand un nom
 * manque, on affiche un texte neutre en français plutôt que l'identifiant
 * technique.
 */

import type { DashboardNotification, NotificationMetadata } from '../types/dashboard'
import type { UserRole } from '../types/user'

const FALLBACK_STUDENT = 'un élève'
const FALLBACK_TEACHER = 'un formateur'
const FALLBACK_TEXT = 'Nouvelle notification'

function studentLabel(metadata: NotificationMetadata | null | undefined): string {
  return metadata?.studentName?.trim() || FALLBACK_STUDENT
}

function teacherLabel(metadata: NotificationMetadata | null | undefined): string {
  return metadata?.teacherName?.trim() || FALLBACK_TEACHER
}

/** Rôles pour lesquels une relation élève↔formateur place la personne côté formateur. */
const TEACHER_SIDE_ROLES: UserRole[] = ['formateur', 'animateur_pedagogique']

type NotificationLabelBuilder = (
  metadata: NotificationMetadata | null,
  currentRole?: UserRole,
) => string

/**
 * Dictionnaire type technique → phrase française, pour les 8 types émis par le
 * flow « demande de professeur ». Un type absent de ce dictionnaire (type hérité
 * ou futur) retombe sur `title`/`message` du serveur — voir
 * `getNotificationDisplayText` ci-dessous.
 */
const NOTIFICATION_LABEL_BUILDERS: Record<string, NotificationLabelBuilder> = {
  teacher_request_created: (metadata) => `Nouvelle demande de professeur pour ${studentLabel(metadata)}`,

  teacher_proposal_sent: (metadata) => `Nouvelle proposition de professeur pour ${studentLabel(metadata)}`,

  teacher_proposal_accepted: (metadata) =>
    `${teacherLabel(metadata)} a accepté la proposition pour ${studentLabel(metadata)}`,

  teacher_proposal_declined: (metadata) =>
    `${teacherLabel(metadata)} a refusé la proposition pour ${studentLabel(metadata)}`,

  teacher_proposal_not_selected: (metadata) =>
    `${teacherLabel(metadata)} n'a pas été retenu pour ${studentLabel(metadata)}`,

  teacher_proposal_expired: (metadata) =>
    `La proposition envoyée à ${teacherLabel(metadata)} pour ${studentLabel(metadata)} est restée sans réponse`,

  // Formulation distincte côté formateur (« vous ») et côté élève/parent (« un professeur »),
  // arbitrage du 2026-08-14 : « utilise userId/rôle courant si besoin ».
  teacher_assigned: (metadata, currentRole) =>
    currentRole && TEACHER_SIDE_ROLES.includes(currentRole)
      ? `Vous êtes désormais le professeur de ${studentLabel(metadata)}`
      : `Un professeur a été trouvé pour ${studentLabel(metadata)}`,

  teacher_request_status_updated: (metadata) =>
    `Le statut de la demande de professeur de ${studentLabel(metadata)} a changé`,
}

/**
 * Résout le texte affiché pour une notification : dictionnaire type+metadata
 * si le type est connu, sinon repli sur `title`/`message` du serveur (types
 * hérités ou futurs non couverts ici).
 */
export function getNotificationDisplayText(
  notification: Pick<DashboardNotification, 'type' | 'metadata' | 'title' | 'message'>,
  currentRole?: UserRole,
): string {
  const builder = NOTIFICATION_LABEL_BUILDERS[notification.type]
  if (builder) {
    return builder(notification.metadata ?? null, currentRole)
  }
  return notification.title?.trim() || notification.message?.trim() || FALLBACK_TEXT
}
