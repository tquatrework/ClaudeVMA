export type EventType = 'cours' | 'masterclass' | 'pedagogique' | 'financier' | 'rappel' | 'invitation'

export type InviteeStatus = 'pending' | 'accepted' | 'declined'

export type ReminderDelay = '1week' | '1day' | '1hour' | '15min' | 'none'

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
  inviteeIds?: string[]
  inviteeStatus?: InviteeStatus
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
