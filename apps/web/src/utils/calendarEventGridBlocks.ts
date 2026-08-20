/**
 * calendarEventGridBlocks.ts — traduction des événements de calendrier (`CalendarEvent`,
 * `GET /calendars/:ownerId/events`) vers la représentation attendue par `AvailabilityGrid` (grille
 * hebdomadaire, `dayOfWeek` + `HH:mm`) — même technique que `scheduledActivityGridBlocks.ts` et
 * `linkedCalendarBusyFree.ts`, réutilisée ici pour la troisième source fusionnée sur la grille
 * (chantier calendrier vue unifiée, point 1). Fonctions pures, aucun appel réseau ni état React.
 *
 * **Filtrage par semaine calendaire réelle** (correction du 2026-08-20, point B) : la grille
 * affiche désormais une semaine calendaire précise, navigable, et non plus un gabarit hebdomadaire
 * récurrent sans date. `toCalendarEventGridBlocks` ne garde donc que les événements dont `startAt`
 * tombe réellement dans `[weekStart, weekStart + 7 jours)` — ce qui élimine du même coup l'ancienne
 * limite documentée ici (deux événements du même jour de semaine à des semaines différentes
 * pouvaient se chevaucher visuellement) : une seule semaine réelle est affichée à la fois, il n'y a
 * donc plus jamais deux occurrences possibles dans la même case. `dateLabel` reste affiché sur
 * chaque bloc, il redevient simplement une confirmation visuelle plutôt qu'un désambiguïsateur
 * indispensable.
 *
 * `GET /calendars/:ownerId/events` ne borne pas la réponse dans le temps côté serveur
 * (contrairement à `activities`, bornées à 2 semaines passées + 4 à venir, voir docs/routes.md §
 * calendar-service) : la page charge donc la liste complète une fois (règle du 2026-08-10), et
 * chaque navigation de semaine ne fait que refiltrer localement cette même liste, sans nouvel
 * appel réseau.
 */

import type { CalendarEvent } from '../components/calendar/calendarTypes'
import { extractTimeOfDayFromIso } from './availabilitySlotApiMapping'
import { extractDayOfWeekFromIso } from './linkedCalendarBusyFree'
import { addWeeksUtc, isWithinRange } from './calendarDisplayWeek'

/**
 * `EVENT_PENDING` distingue une invitation encore en attente de réponse
 * (`event.viewerInvitationStatus === 'pending'`) — couleur dédiée dans `AvailabilityGrid`, bug
 * réel corrigé le 2026-08-20 (voir `docs/routes.md` § calendar-service, et `CalendarUnifiedView`
 * pour le retrait d'`InvitationBanner`, qui ne pouvait jamais afficher une invitation réelle).
 * `accepted`/`declined`/propre événement restent `EVENT`, apparence normale.
 */
export type CalendarEventGridBlockKind = 'EVENT' | 'EVENT_PENDING'

/** Bloc affichable par `AvailabilityGrid`, porteur de l'événement d'origine complet. */
export interface CalendarEventGridBlock {
  id: string
  dayOfWeek: number
  startTime: string
  endTime: string
  kind: CalendarEventGridBlockKind
  event: CalendarEvent
  /** Date réelle de l'événement, formatée en français court (ex. "10 sept."). */
  dateLabel: string
}

function formatDateLabel(isoDateTime: string): string {
  const parsed = new Date(isoDateTime)
  if (Number.isNaN(parsed.getTime())) return ''
  return parsed.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' })
}

/**
 * Traduit un événement vers un bloc affichable par `AvailabilityGrid`. `null` si `startAt` n'est
 * pas exploitable. Ne filtre plus par fenêtre : c'est `toCalendarEventGridBlocks` qui restreint à
 * la semaine affichée, avant traduction.
 */
export function toCalendarEventGridBlock(event: CalendarEvent): CalendarEventGridBlock | null {
  const dayOfWeek = extractDayOfWeekFromIso(event.startAt)
  const startTime = extractTimeOfDayFromIso(event.startAt)
  if (dayOfWeek === null || startTime === null) return null

  const endDayOfWeek = extractDayOfWeekFromIso(event.endAt)
  const rawEndTime = extractTimeOfDayFromIso(event.endAt)
  const endTime = endDayOfWeek === dayOfWeek && rawEndTime !== null ? rawEndTime : '23:59'

  const kind: CalendarEventGridBlockKind =
    event.viewerInvitationStatus === 'pending' ? 'EVENT_PENDING' : 'EVENT'

  return {
    id: event.id,
    dayOfWeek,
    startTime,
    endTime,
    kind,
    event,
    dateLabel: formatDateLabel(event.startAt),
  }
}

/**
 * Traduit les événements dont `startAt` tombe dans la semaine calendaire affichée
 * `[weekStart, weekStart + 7 jours)`. Événements illisibles ou hors semaine écartés.
 */
export function toCalendarEventGridBlocks(
  events: CalendarEvent[],
  weekStart: Date,
): CalendarEventGridBlock[] {
  const weekEnd = addWeeksUtc(weekStart, 1)
  return events
    .filter((event) => isWithinRange(event.startAt, weekStart, weekEnd))
    .map(toCalendarEventGridBlock)
    .filter((block): block is CalendarEventGridBlock => block !== null)
}
