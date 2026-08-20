/**
 * calendarQuarterHour.ts — fonctions pures de conversion entre un index de quart d'heure et une
 * heure `HH:mm`, pour la sélection à la souris au quart d'heure près (correction du 2026-08-20,
 * point C). La grille ne trace aucune ligne visuelle supplémentaire à chaque quart d'heure — seule
 * la cible d'interaction (clic, glisser) est subdivisée, voir `AvailabilityGrid`.
 */

export const QUARTER_HOUR_MINUTES = 15
export const QUARTERS_PER_HOUR = 60 / QUARTER_HOUR_MINUTES

function pad2(value: number): string {
  return value.toString().padStart(2, '0')
}

/** Formate une heure + un quart (0..3) en `HH:mm`, ex. `formatQuarterTime(9, 1)` → `"09:15"`. */
export function formatQuarterTime(hour: number, quarterInHour: number): string {
  const minutes = quarterInHour * QUARTER_HOUR_MINUTES
  return `${pad2(hour)}:${pad2(minutes)}`
}

/**
 * Index absolu de quart d'heure depuis le début de la grille (`gridStartHour`), ex. avec
 * `gridStartHour=7` : 07:00 → 0, 07:15 → 1, 08:00 → 4.
 */
export function absoluteQuarterIndex(hour: number, quarterInHour: number, gridStartHour: number): number {
  return (hour - gridStartHour) * QUARTERS_PER_HOUR + quarterInHour
}

/** Convertit un index absolu de quart d'heure en `HH:mm`, à partir de `gridStartHour`. */
export function quarterIndexToTime(absoluteIndex: number, gridStartHour: number): string {
  const totalMinutes = absoluteIndex * QUARTER_HOUR_MINUTES
  const hour = gridStartHour + Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${pad2(hour)}:${pad2(minutes)}`
}
