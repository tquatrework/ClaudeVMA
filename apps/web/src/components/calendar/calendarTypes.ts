export type EventType = 'cours' | 'masterclass' | 'pedagogique' | 'financier' | 'rappel' | 'invitation'

export type InviteeStatus = 'pending' | 'accepted' | 'declined'

export type ReminderDelay = '1week' | '1day' | '1hour' | '15min' | 'none'

/**
 * Invitation d'un événement à un invité précis — bloc `invitations` de
 * `GET /calendars/:ownerId/events` (`docs/routes.md` § calendar-service). Pour un événement où le
 * titulaire du GET est seulement invité (pas créateur), ce tableau ne porte que sa propre
 * invitation (protection de vie privée côté serveur).
 */
export interface EventInvitation {
  id: string
  eventId: string
  inviteeId: string
  status: InviteeStatus
  createdAt: string
  updatedAt: string
}

export interface CalendarEvent {
  id: string
  /**
   * Réellement optionnel côté serveur (`docs/routes.md` § calendar-service, corrigé le
   * 2026-08-20) — un événement sans titre est stocké et relu avec `title: null`, jamais un texte
   * fabriqué côté serveur. L'affichage d'un repli (« Sans titre ») est un sujet front, jamais
   * serveur : voir `EventCard`/`EventGridBlockLabel`.
   */
  title?: string | null
  startAt: string
  endAt: string
  eventType: EventType
  description?: string
  status?: string
  /**
   * Créateur de l'événement — **jamais** l'`ownerId` du chemin de la requête pour un événement où
   * le titulaire du GET est seulement invité (`docs/routes.md`). Sert à déterminer si le lecteur
   * peut supprimer l'événement (bouton "Supprimer", réservé au créateur côté front).
   */
  ownerId?: string
  invitations?: EventInvitation[]
  /**
   * Statut de l'invitation du titulaire du GET sur CET événement — `pending` | `accepted` |
   * `declined`, ou `null`/absent s'il n'est pas invité (son propre événement, ou un accès par
   * rôle privilégié sans y être lui-même invité).
   *
   * **Bug réel corrigé le 2026-08-20** : `GET /calendars/:ownerId/events` ne renvoyait jusqu'ici
   * que les événements dont l'appelant était créateur, jamais ceux où il est seulement invité —
   * un invité n'avait donc *aucun* moyen de voir, accepter ou refuser une invitation. Ce champ
   * est nouveau côté serveur ; les anciens champs `inviteeIds`/`inviteeStatus` que ce type portait
   * ne correspondaient à aucune donnée jamais renvoyée par calendar-service (`inviteeStatus` en
   * particulier n'a jamais existé côté serveur — `InvitationBanner`, qui s'y appuyait, ne pouvait
   * donc jamais s'afficher pour une invitation réelle ; composant retiré le même jour, voir
   * `CalendarUnifiedView`).
   */
  viewerInvitationStatus?: InviteeStatus | null
}

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  cours: 'Cours',
  masterclass: 'Masterclass',
  pedagogique: 'Pédagogique',
  financier: 'Financier',
  rappel: 'Rappel',
  invitation: 'Invitation',
}

export const EVENT_TYPE_COLORS: Record<EventType, string> = {
  cours: 'bg-indigo-100 text-indigo-700',
  masterclass: 'bg-violet-100 text-violet-700',
  pedagogique: 'bg-green-100 text-green-700',
  financier: 'bg-amber-100 text-amber-700',
  rappel: 'bg-gray-100 text-gray-600',
  invitation: 'bg-blue-100 text-blue-600',
}

export type UserRoleForCalendar =
  | 'eleve'
  | 'parent_financeur'
  | 'formateur'
  | 'animateur_pedagogique'
  | 'responsable_pedagogique'
  | 'technicien_informatique'
  | 'administrateur_financier'

export const ALLOWED_EVENT_TYPES_BY_ROLE: Record<string, EventType[]> = {
  eleve: ['rappel'],
  parent_financeur: [],
  formateur: ['cours', 'masterclass', 'pedagogique', 'rappel'],
  animateur_pedagogique: ['pedagogique', 'rappel'],
  responsable_pedagogique: ['cours', 'masterclass', 'pedagogique', 'financier', 'rappel', 'invitation'],
  technicien_informatique: ['cours', 'masterclass', 'pedagogique', 'financier', 'rappel', 'invitation'],
  administrateur_financier: ['financier', 'rappel'],
}
