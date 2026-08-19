import { addDays, startOfDay } from 'date-fns'

/**
 * Fenêtre de la semaine courante (aujourd'hui 00:00 → +7 jours), en ISO 8601 avec fuseau —
 * même format que `startTime`/`endTime` des créneaux de disponibilité. Utilisée pour
 * pré-remplir `LinkedCalendarView` (grille par jour de semaine, indépendante de la date exacte
 * affichée) dans `ProposeCourseSlotDialog`.
 */
export function getCurrentWeekWindow(referenceDate: Date = new Date()): {
  from: string
  to: string
} {
  const from = startOfDay(referenceDate)
  const to = addDays(from, 7)
  return { from: from.toISOString(), to: to.toISOString() }
}
