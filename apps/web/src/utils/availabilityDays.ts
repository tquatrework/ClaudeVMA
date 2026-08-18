/**
 * availabilityDays.ts — convention `dayOfWeek` du calendrier de disponibilités.
 *
 * `dayOfWeek` va de 0 (dimanche) à 6 (samedi), alignée sur `Date.prototype.getDay()` et
 * `date-fns`. Convention confirmée par lecture directe de l'entité `AvailabilitySlot` côté
 * `calendar-service` avant ce chantier (voir le plan approuvé) — traitée comme acquise.
 *
 * Isolée dans ce seul fichier par prudence : si un écart apparaissait un jour contre la pile
 * réelle, la correction resterait bon marché.
 */

export interface AvailabilityDayOption {
  value: number
  label: string
}

/** Libellés français, indexés par `dayOfWeek` (0 = dimanche … 6 = samedi). */
const DAY_LABELS: readonly string[] = [
  'Dimanche',
  'Lundi',
  'Mardi',
  'Mercredi',
  'Jeudi',
  'Vendredi',
  'Samedi',
]

/** Ordre d'affichage voulu à l'écran : lundi → dimanche. */
export const DAY_DISPLAY_ORDER: readonly number[] = [1, 2, 3, 4, 5, 6, 0]

export const AVAILABILITY_DAY_OPTIONS: AvailabilityDayOption[] = DAY_DISPLAY_ORDER.map(
  (value) => ({ value, label: DAY_LABELS[value] }),
)

export function getDayLabel(dayOfWeek: number): string {
  return DAY_LABELS[dayOfWeek] ?? 'Jour inconnu'
}
