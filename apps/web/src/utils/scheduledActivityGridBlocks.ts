/**
 * scheduledActivityGridBlocks.ts — traduction des activités planifiées (`CalendarActivityEntry`,
 * `GET /calendars/:ownerId`) vers la représentation attendue par `AvailabilityGrid` (grille
 * hebdomadaire, `dayOfWeek` + `HH:mm`) — même technique que `linkedCalendarBusyFree.ts` pour les
 * blocs `BUSY` du point 2 du chantier, réutilisée ici pour les propositions/confirmations de
 * créneau de cours (point 3, 2026-08-19). Fonctions pures, aucun appel réseau ni état React.
 *
 * **Filtrage par semaine calendaire réelle** (correction du 2026-08-20, point B) — même principe
 * que `calendarEventGridBlocks.ts` : `toScheduledActivityGridBlocks` ne garde que les activités
 * dont `startTime` tombe dans `[weekStart, weekStart + 7 jours)`, ce qui remplace l'ancienne
 * limite « la grille est un gabarit récurrent sans semaine affichée, deux activités du même jour
 * de semaine à des semaines différentes peuvent se chevaucher ». Une seule semaine réelle étant
 * affichée à la fois, ce chevauchement ne peut plus se produire. `dateLabel` reste affiché par
 * confirmation visuelle. **Limite héritée, non résolue ici** : les activités restent bornées côté
 * serveur à 2 semaines passées + 4 à venir (voir docs/routes.md § calendar-service) — naviguer
 * au-delà ne fera apparaître aucune activité, la page ne les ayant jamais reçues.
 */

import type { ActivityType, CalendarActivityEntry } from '../types/calendar'
import { extractTimeOfDayFromIso } from './availabilitySlotApiMapping'
import { extractDayOfWeekFromIso } from './linkedCalendarBusyFree'
import { addWeeksUtc, isWithinRange } from './calendarDisplayWeek'

export type ScheduledActivityGridBlockKind = 'PROPOSED' | 'CONFIRMED'

/** Bloc affichable par `AvailabilityGrid`, porteur de l'activité d'origine complète. */
export interface ScheduledActivityGridBlock {
  id: string
  dayOfWeek: number
  startTime: string
  endTime: string
  kind: ScheduledActivityGridBlockKind
  activity: CalendarActivityEntry
  /**
   * Date réelle du créneau, formatée en français court (ex. "10 sept.") — la grille étant un
   * gabarit hebdomadaire sans date, ce libellé lève l'ambiguïté en cas de semaines multiples.
   */
  dateLabel: string
}

/**
 * Nom neutre affiché quand `creatorName` est absent (dégradation serveur, `profile-service`
 * injoignable) — jamais un UUID ni un texte vide (arbitrage du 2026-08-09).
 */
export function getActivityCreatorFallbackLabel(type: ActivityType): string {
  return type === 'cours' ? 'Formateur' : 'Intervenant pédagogique'
}

function formatDateLabel(isoDateTime: string): string {
  const parsed = new Date(isoDateTime)
  if (Number.isNaN(parsed.getTime())) return ''
  return parsed.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

/**
 * Traduit une activité vers un bloc affichable par `AvailabilityGrid`. `null` si `startTime`
 * n'est pas exploitable, ou si le statut n'est ni `proposed` ni `confirmed` (garde défensive : le
 * serveur filtre déjà, mais un statut inattendu n'est jamais affiché comme s'il était l'un des
 * deux).
 */
export function toScheduledActivityGridBlock(
  activity: CalendarActivityEntry,
): ScheduledActivityGridBlock | null {
  if (activity.status !== 'proposed' && activity.status !== 'confirmed') return null

  const dayOfWeek = extractDayOfWeekFromIso(activity.startTime)
  const startTime = extractTimeOfDayFromIso(activity.startTime)
  if (dayOfWeek === null || startTime === null) return null

  const endDayOfWeek = extractDayOfWeekFromIso(activity.endTime)
  const rawEndTime = extractTimeOfDayFromIso(activity.endTime)
  const endTime = endDayOfWeek === dayOfWeek && rawEndTime !== null ? rawEndTime : '23:59'

  return {
    id: activity.id,
    dayOfWeek,
    startTime,
    endTime,
    kind: activity.status === 'proposed' ? 'PROPOSED' : 'CONFIRMED',
    activity,
    dateLabel: formatDateLabel(activity.startTime),
  }
}

/**
 * Traduit les activités dont `startTime` tombe dans la semaine calendaire affichée
 * `[weekStart, weekStart + 7 jours)`. Activités illisibles, hors statut ou hors semaine écartées.
 */
export function toScheduledActivityGridBlocks(
  activities: CalendarActivityEntry[],
  weekStart: Date,
): ScheduledActivityGridBlock[] {
  const weekEnd = addWeeksUtc(weekStart, 1)
  return activities
    .filter((activity) => isWithinRange(activity.startTime, weekStart, weekEnd))
    .map(toScheduledActivityGridBlock)
    .filter((block): block is ScheduledActivityGridBlock => block !== null)
}
