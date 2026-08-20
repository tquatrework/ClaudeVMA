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
import { EVENT_TYPE_LABELS, type EventType } from '../components/calendar/calendarTypes'
import { formatEventDate } from './dateFormat'

const FALLBACK_STUDENT = 'un élève'
const FALLBACK_TEACHER = 'un formateur'
const FALLBACK_PROPOSER = 'un intervenant'
const FALLBACK_INVITER = "Quelqu'un"
const FALLBACK_TEXT = 'Nouvelle notification'

function studentLabel(metadata: NotificationMetadata | null | undefined): string {
  return metadata?.studentName?.trim() || FALLBACK_STUDENT
}

function teacherLabel(metadata: NotificationMetadata | null | undefined): string {
  return metadata?.teacherName?.trim() || FALLBACK_TEACHER
}

function proposerLabel(metadata: NotificationMetadata | null | undefined): string {
  return metadata?.proposerName?.trim() || FALLBACK_PROPOSER
}

function inviterLabel(metadata: NotificationMetadata | null | undefined): string {
  return metadata?.creatorName?.trim() || FALLBACK_INVITER
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

  // Deux libellés distincts pour un formateur non retenu, arbitrage du 2026-08-17 : le
  // destinataire de ces deux types est toujours le formateur concerné (arbitrage du
  // 2026-08-14, point 8), d'où le « vous » — pas de vérification de rôle nécessaire ici,
  // contrairement à `teacher_assigned` ci-dessus dont les destinataires diffèrent.
  teacher_proposal_not_selected: (metadata) =>
    `Un autre professeur a été retenu pour ${studentLabel(metadata)}`,

  teacher_proposal_expired: (metadata) => `Vous n'avez pas été retenu pour ${studentLabel(metadata)}`,

  // Formulation distincte côté formateur (« vous ») et côté élève/parent (« un professeur »),
  // arbitrage du 2026-08-14 : « utilise userId/rôle courant si besoin ».
  teacher_assigned: (metadata, currentRole) =>
    currentRole && TEACHER_SIDE_ROLES.includes(currentRole)
      ? `Vous êtes désormais le professeur de ${studentLabel(metadata)}`
      : `Un professeur a été trouvé pour ${studentLabel(metadata)}`,

  teacher_request_status_updated: (metadata) =>
    `Le statut de la demande de professeur de ${studentLabel(metadata)} a changé`,

  // Chantier calendrier de disponibilités, point 3 (2026-08-19). Libellé exact retenu par
  // l'utilisateur : « Proposition de cours ajoutée par {proposerName} ».
  course_slot_proposed: (metadata) => `Proposition de cours ajoutée par ${proposerLabel(metadata)}`,

  // Ajustement du 2026-08-20 : le libellé reprenait jusqu'ici le titre saisi par le créateur de
  // l'événement (« … vous a invité à « {titre} » »). Sur demande explicite de l'utilisateur, le
  // titre — facultatif et parfois trompeur — n'est plus repris ; le libellé indique désormais le
  // **type d'événement** (traduit via `EVENT_TYPE_LABELS`, seul point de traduction
  // technique→français de ce type — `components/calendar/calendarTypes.ts`) et l'**heure**
  // (`formatEventDate`, même formatage que les cartes d'événement du calendrier — `EventCard`,
  // `dateFormat.ts`). Le nom du créateur reste en tête, structure inchangée par ailleurs.
  event_invitation_received: (metadata) => {
    const inviter = inviterLabel(metadata)
    const eventType = metadata?.eventType as EventType | undefined
    const eventTypeLabel = eventType ? EVENT_TYPE_LABELS[eventType] ?? eventType : null
    const startAt = metadata?.startAt
    const whenLabel = startAt ? formatEventDate(startAt) : null

    const typePart = eventTypeLabel ? ` « ${eventTypeLabel} »` : ''
    const whenPart = whenLabel ? ` le ${whenLabel}` : ''
    return `${inviter} vous a invité à un événement${typePart}${whenPart}`
  },
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

/**
 * Point unique de correspondance type technique → route de destination.
 *
 * Avant ce mapping, cliquer sur une notification ne faisait que la marquer
 * lue : rien n'emmenait l'utilisateur vers l'écran concerné. Un formateur
 * recevant `teacher_proposal_sent` n'avait donc aucun chemin direct vers sa
 * boîte de réception (`/teacher-requests`), alors que l'écran existe et y
 * répond déjà par les actions accepter/refuser — trou de navigation, pas de
 * trou fonctionnel.
 *
 * Les 8 types émis par le flow « demande de professeur » convergent tous vers
 * `/teacher-requests` : c'est le seul hub de ce flow, quel que soit le rôle
 * (boîte de réception formateur, liste de demandes élève/parent/RP).
 * Un type absent de cette table (hérité ou futur) ne navigue nulle part —
 * mieux vaut ne rien faire que d'emmener l'utilisateur au mauvais endroit.
 *
 * `course_slot_proposed` (chantier calendrier de disponibilités, point 3, 2026-08-19) suit le
 * même principe : la proposition de créneau est désormais visible et actionnable directement
 * dans la grille unifiée de `/calendar` (`CalendarUnifiedView`), jamais dans
 * un écran séparé — même défaut de découvrabilité déjà corrigé pour le flow demande de
 * professeur le 2026-08-17, appliqué ici.
 *
 * `event_invitation_received` (bug réel corrigé le 2026-08-20) suit le même principe : une
 * invitation à un événement de calendrier s'accepte/refuse directement dans la grille unifiée
 * (bloc `EVENT_PENDING`, voir `CalendarUnifiedView`/`EventDetailDialog`), jamais dans un écran
 * séparé.
 */
const NOTIFICATION_TARGET_PATHS: Record<string, string> = {
  teacher_request_created: '/teacher-requests',
  teacher_proposal_sent: '/teacher-requests',
  teacher_proposal_accepted: '/teacher-requests',
  teacher_proposal_declined: '/teacher-requests',
  teacher_proposal_not_selected: '/teacher-requests',
  teacher_proposal_expired: '/teacher-requests',
  teacher_assigned: '/teacher-requests',
  teacher_request_status_updated: '/teacher-requests',
  course_slot_proposed: '/calendar',
  event_invitation_received: '/calendar',
}

/** Route vers laquelle naviguer au clic sur une notification, ou `null` si aucune n'est définie. */
export function getNotificationTargetPath(type: DashboardNotification['type']): string | null {
  return NOTIFICATION_TARGET_PATHS[type] ?? null
}
