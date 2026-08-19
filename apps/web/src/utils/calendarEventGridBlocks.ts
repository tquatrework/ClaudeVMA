/**
 * calendarEventGridBlocks.ts — traduction des événements de calendrier (`CalendarEvent`,
 * `GET /calendars/:ownerId/events`) vers la représentation attendue par `AvailabilityGrid` (grille
 * hebdomadaire, `dayOfWeek` + `HH:mm`) — même technique que `scheduledActivityGridBlocks.ts` et
 * `linkedCalendarBusyFree.ts`, réutilisée ici pour la troisième source fusionnée sur la grille
 * (chantier calendrier vue unifiée, point 1). Fonctions pures, aucun appel réseau ni état React.
 *
 * **Limite assumée**, identique à celle déjà documentée dans `scheduledActivityGridBlocks.ts` :
 * la grille est un gabarit hebdomadaire récurrent, sans année ni semaine affichée. Deux
 * événements tombant sur le même jour de semaine à des semaines réelles différentes peuvent se
 * chevaucher visuellement dans la même cellule ; `dateLabel` affiche la date réelle sur chaque
 * bloc pour limiter la confusion.
 *
 * **Fenêtre d'affichage** : `GET /calendars/:ownerId/events` ne borne pas la réponse dans le
 * temps (contrairement à `activities`, bornées côté serveur à 2 semaines passées + 4 à venir,
 * voir docs/routes.md § calendar-service). Pour rester lisible sur un gabarit hebdomadaire, la
 * même fenêtre est appliquée ici, côté client, par pure cohérence visuelle avec les deux autres
 * sources fusionnées sur la grille — ce n'est pas une troncature de données côté serveur, les
 * événements hors fenêtre restent dans `events`, seul leur affichage sur cette grille est filtré.
 */

import type { CalendarEvent } from '../components/calendar/calendarTypes'
import { extractTimeOfDayFromIso } from './availabilitySlotApiMapping'
import { extractDayOfWeekFromIso } from './linkedCalendarBusyFree'

export type CalendarEventGridBlockKind = 'EVENT'

/** Bloc affichable par `AvailabilityGrid`, porteur de l'événement d'origine complet. */
export interface CalendarEventGridBlock {
  id: string
  dayOfWeek: number
  startTime: string
  endTime: string
  kind: CalendarEventGridBlockKind
  event: CalendarEvent
  /** Date réelle de l'événement, formatée en français court (ex. "10 sept.") — même rôle que sur
   * `ScheduledActivityGridBlock.dateLabel`. */
  dateLabel: string
}

const WINDOW_PAST_DAYS = 14
const WINDOW_FUTURE_DAYS = 28

function isWithinDisplayWindow(isoDateTime: string, referenceDate: Date): boolean {
  const parsed = new Date(isoDateTime)
  if (Number.isNaN(parsed.getTime())) return false
  const past = new Date(referenceDate)
  past.setDate(past.getDate() - WINDOW_PAST_DAYS)
  const future = new Date(referenceDate)
  future.setDate(future.getDate() + WINDOW_FUTURE_DAYS)
  return parsed >= past && parsed <= future
}

function formatDateLabel(isoDateTime: string): string {
  const parsed = new Date(isoDateTime)
  if (Number.isNaN(parsed.getTime())) return ''
  return parsed.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

/**
 * Traduit un événement vers un bloc affichable par `AvailabilityGrid`. `null` si `startAt` n'est
 * pas exploitable, ou si l'événement tombe hors de la fenêtre d'affichage (voir en-tête).
 */
export function toCalendarEventGridBlock(
  event: CalendarEvent,
  referenceDate: Date = new Date(),
): CalendarEventGridBlock | null {
  if (!isWithinDisplayWindow(event.startAt, referenceDate)) return null

  const dayOfWeek = extractDayOfWeekFromIso(event.startAt)
  const startTime = extractTimeOfDayFromIso(event.startAt)
  if (dayOfWeek === null || startTime === null) return null

  const endDayOfWeek = extractDayOfWeekFromIso(event.endAt)
  const rawEndTime = extractTimeOfDayFromIso(event.endAt)
  const endTime = endDayOfWeek === dayOfWeek && rawEndTime !== null ? rawEndTime : '23:59'

  return {
    id: event.id,
    dayOfWeek,
    startTime,
    endTime,
    kind: 'EVENT',
    event,
    dateLabel: formatDateLabel(event.startAt),
  }
}

/** Traduit une liste d'événements. Événements illisibles ou hors fenêtre écartés. */
export function toCalendarEventGridBlocks(
  events: CalendarEvent[],
  referenceDate: Date = new Date(),
): CalendarEventGridBlock[] {
  return events
    .map((event) => toCalendarEventGridBlock(event, referenceDate))
    .filter((block): block is CalendarEventGridBlock => block !== null)
}
