/**
 * calendarDisplayWeek.ts — fonctions pures pour la semaine calendaire réellement affichée par
 * `CalendarUnifiedView` (correction du 2026-08-20, point B : « Dates réelles sur la grille »).
 *
 * Décision d'architecture retenue (documentée dans le rapport de session) : la grille cesse
 * d'être un pur gabarit hebdomadaire récurrent pour devenir la vue d'**une semaine calendaire
 * précise**, navigable. Les créneaux de disponibilité (`AvailabilitySlot`, récurrents par
 * `dayOfWeek`) continuent d'être projetés sur chaque semaine affichée — ce fichier fournit les
 * dates réelles nécessaires à cette projection (`CalendarDisplayDay.date`) et au filtrage optionnel
 * par `recurrenceEndDate`. Les événements/activités, qui portent déjà de vraies dates, sont
 * filtrés ici par appartenance stricte à la semaine affichée (`isWithinRange`), remplaçant
 * l'ancienne fenêtre approximative ±14/+28 jours autour d'« aujourd'hui ».
 *
 * Toutes les dates sont manipulées en **UTC**, jamais dans le fuseau du navigateur — même
 * convention que `availabilitySlotApiMapping.ts` et `linkedCalendarBusyFree.ts`, pour qu'un
 * aller-retour envoi → relecture reproduise l'heure affichée sans dérive de fuseau.
 */

import { AVAILABILITY_DAY_OPTIONS } from './availabilityDays'

/** Un jour réel affiché sur la grille, avec son `dayOfWeek` (convention `getUTCDay()`) et sa date. */
export interface CalendarDisplayDay {
  dayOfWeek: number
  /** Minuit UTC de ce jour réel. */
  date: Date
}

export interface CalendarDisplayWeek {
  /** Lundi 00:00 UTC de la semaine affichée. */
  weekStart: Date
  /** Lundi 00:00 UTC de la semaine suivante — borne exclusive. */
  weekEnd: Date
  /** 7 jours, dans l'ordre d'affichage lundi → dimanche, avec leur date réelle. */
  days: CalendarDisplayDay[]
}

function toUtcMidnight(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

function addDaysUtc(date: Date, days: number): Date {
  const result = new Date(date)
  result.setUTCDate(result.getUTCDate() + days)
  return result
}

/** Lundi 00:00 UTC de la semaine (au sens `getUTCDay()`, 0 dimanche … 6 samedi) contenant `date`. */
export function getMondayOfWeek(date: Date): Date {
  const midnight = toUtcMidnight(date)
  const offsetFromMonday = (midnight.getUTCDay() + 6) % 7
  return addDaysUtc(midnight, -offsetFromMonday)
}

/** Décale une date (attendue à minuit UTC) d'un nombre entier de semaines. */
export function addWeeksUtc(date: Date, weeks: number): Date {
  return addDaysUtc(date, weeks * 7)
}

/** La semaine calendaire réelle contenant `referenceDate`, lundi → dimanche. */
export function getDisplayWeek(referenceDate: Date = new Date()): CalendarDisplayWeek {
  const weekStart = getMondayOfWeek(referenceDate)
  const weekEnd = addDaysUtc(weekStart, 7)
  const days: CalendarDisplayDay[] = AVAILABILITY_DAY_OPTIONS.map((day, index) => ({
    dayOfWeek: day.value,
    date: addDaysUtc(weekStart, index),
  }))
  return { weekStart, weekEnd, days }
}

/**
 * Combine un jour réel (minuit UTC) et une heure `HH:mm` en une date ISO 8601 complète — utilisé
 * pour résoudre la date exacte d'un événement créé par clic/glisser sur la grille (correction du
 * 2026-08-20, point D), une fois la semaine affichée connue. Remplace, pour les événements réels,
 * l'ancienne résolution « prochaine occurrence de ce jour de semaine depuis aujourd'hui »
 * (`buildIsoDateTimeForDay`) — qui reste correcte pour les créneaux de disponibilité récurrents
 * (le serveur n'y regarde que le jour de semaine et l'heure), mais aurait résolu la mauvaise date
 * dès qu'on navigue vers une semaine différente de la semaine courante.
 */
export function combineDateAndTime(date: Date, time: string): string {
  const [hours, minutes] = time.split(':').map(Number)
  const combined = new Date(date)
  combined.setUTCHours(hours, minutes, 0, 0)
  return combined.toISOString()
}

/** `isoDateTime` tombe-t-il dans `[start, end)` ? Faux si la chaîne est illisible. */
export function isWithinRange(isoDateTime: string, start: Date, end: Date): boolean {
  const parsed = new Date(isoDateTime)
  if (Number.isNaN(parsed.getTime())) return false
  return parsed >= start && parsed < end
}

/** Date courte JJ/MM (UTC), ex. "18/08" — affichée sous le nom du jour dans l'en-tête de grille. */
export function formatDisplayDayDate(date: Date): string {
  const day = date.getUTCDate().toString().padStart(2, '0')
  const month = (date.getUTCMonth() + 1).toString().padStart(2, '0')
  return `${day}/${month}`
}

/**
 * Libellé de la semaine affichée au-dessus de la grille, ex. « Semaine du 18 au 24 août 2026 »,
 * ou « Semaine du 28 juillet au 3 août 2026 » quand elle chevauche deux mois.
 */
export function formatWeekRangeLabel(weekStart: Date): string {
  const weekEndInclusive = addDaysUtc(weekStart, 6)
  const startMonth = weekStart.toLocaleDateString('fr-FR', { month: 'long', timeZone: 'UTC' })
  const endMonth = weekEndInclusive.toLocaleDateString('fr-FR', { month: 'long', timeZone: 'UTC' })
  const year = weekEndInclusive.getUTCFullYear()

  if (startMonth === endMonth) {
    return `Semaine du ${weekStart.getUTCDate()} au ${weekEndInclusive.getUTCDate()} ${endMonth} ${year}`
  }
  return `Semaine du ${weekStart.getUTCDate()} ${startMonth} au ${weekEndInclusive.getUTCDate()} ${endMonth} ${year}`
}

/**
 * Un créneau de disponibilité récurrent est-il encore pertinent pour ce jour réel affiché ?
 * `NONE` (une seule fois) et l'absence de `recurrenceEndDate` sont toujours affichés — seule une
 * récurrence `WEEKLY`/`BIWEEKLY` bornée peut être masquée, quand la date réelle du jour affiché
 * dépasse la date de fin de récurrence.
 */
export function isRecurrenceStillActiveOnDate(
  recurrence: string,
  recurrenceEndDate: string | null,
  dayDate: Date,
): boolean {
  if (recurrence === 'NONE' || !recurrenceEndDate) return true
  const end = new Date(recurrenceEndDate)
  if (Number.isNaN(end.getTime())) return true
  return dayDate.getTime() <= end.getTime()
}
