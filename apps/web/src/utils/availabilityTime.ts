/**
 * availabilityTime.ts — fonctions pures de validation/positionnement pour la grille de
 * disponibilités. Aucun appel réseau ici, aucun état React.
 */

import { areIntervalsOverlapping, isBefore, parse } from 'date-fns'

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/

/** La plage de la grille affichée : 07:00 à 22:00. */
export const GRID_START_HOUR = 7
export const GRID_END_HOUR = 22

/** Une date de référence arbitraire, utilisée uniquement pour comparer des heures entre elles. */
const REFERENCE_DATE = new Date(2000, 0, 1)

function parseTimeOfDay(time: string): Date | null {
  if (!TIME_PATTERN.test(time)) return null
  return parse(time, 'HH:mm', REFERENCE_DATE)
}

/** Une chaîne `HH:mm` est-elle une heure valide (00:00 à 23:59) ? */
export function isValidTimeString(time: string): boolean {
  return TIME_PATTERN.test(time)
}

/** `startTime` est-il strictement avant `endTime` ? Renvoie `false` si l'une des deux est invalide. */
export function isStartBeforeEnd(startTime: string, endTime: string): boolean {
  const start = parseTimeOfDay(startTime)
  const end = parseTimeOfDay(endTime)
  if (!start || !end) return false
  return isBefore(start, end)
}

export interface TimeRange {
  dayOfWeek: number
  startTime: string
  endTime: string
}

/**
 * Deux créneaux du même jour se chevauchent-ils ? Comparaison purement locale (client), la
 * vérité finale reste le serveur — sert uniquement à avertir l'utilisateur avant l'envoi.
 */
export function doRangesOverlap(a: TimeRange, b: TimeRange): boolean {
  if (a.dayOfWeek !== b.dayOfWeek) return false
  const startA = parseTimeOfDay(a.startTime)
  const endA = parseTimeOfDay(a.endTime)
  const startB = parseTimeOfDay(b.startTime)
  const endB = parseTimeOfDay(b.endTime)
  if (!startA || !endA || !startB || !endB) return false
  return areIntervalsOverlapping(
    { start: startA, end: endA },
    { start: startB, end: endB },
    { inclusive: false },
  )
}

/** Convertit une heure `HH:mm` en minutes depuis minuit. Renvoie `null` si invalide. */
export function timeToMinutes(time: string): number | null {
  const parsed = parseTimeOfDay(time)
  if (!parsed) return null
  return parsed.getHours() * 60 + parsed.getMinutes()
}

/**
 * Position verticale (en pourcentage) d'un créneau dans la grille 07:00–22:00, pour un
 * positionnement `top`/`height` en CSS. Les bornes hors plage sont écrêtées à [0, 100].
 */
export function computeVerticalPosition(
  startTime: string,
  endTime: string,
): { topPercent: number; heightPercent: number } {
  const gridStartMinutes = GRID_START_HOUR * 60
  const gridEndMinutes = GRID_END_HOUR * 60
  const gridTotalMinutes = gridEndMinutes - gridStartMinutes

  const startMinutes = timeToMinutes(startTime) ?? gridStartMinutes
  const endMinutes = timeToMinutes(endTime) ?? gridStartMinutes

  const clampedStart = Math.min(Math.max(startMinutes, gridStartMinutes), gridEndMinutes)
  const clampedEnd = Math.min(Math.max(endMinutes, gridStartMinutes), gridEndMinutes)

  const topPercent = ((clampedStart - gridStartMinutes) / gridTotalMinutes) * 100
  const heightPercent = Math.max(
    ((clampedEnd - clampedStart) / gridTotalMinutes) * 100,
    0,
  )

  return { topPercent, heightPercent }
}

/** Formate une plage horaire pour l'affichage, ex. "09:00 – 12:00". */
export function formatTimeRangeLabel(startTime: string, endTime: string): string {
  return `${startTime} – ${endTime}`
}
