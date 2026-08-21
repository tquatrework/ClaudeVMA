/**
 * Point unique de correspondance technique → libellé français pour le cahier de
 * texte (`pedagogical-log-service`), refonte du 2026-08-20.
 *
 * Même modèle que `utils/teacherRequestLabels.ts` / `utils/notificationLabels.ts` :
 * noms techniques en anglais côté API, traduction en un seul endroit côté front
 * (règle de langue du 2026-08-09).
 *
 * Le libellé de `parent_formateur` porte volontairement le suffixe « (+RP) » —
 * demande explicite de l'utilisateur (2026-08-20) : les rôles administratifs
 * (RP/AP/TI) gardent un accès de lecture même sur les catégories qui ne les
 * nomment pas explicitement dans le libellé.
 */

import type { LogVisibility } from '../api/pedagogicalLog'

export const LOG_VISIBILITY_LABELS: Record<LogVisibility, string> = {
  eleve_parent_formateur: 'Élève + Parent + Formateur (+RP)',
  parent_formateur: 'Parent + Formateur (+RP) — sans l\'élève',
  formateur_rp: 'Formateur + RP uniquement',
  special: 'Page spéciale',
}

/** Options proposées au formateur dans le sélecteur de catégorie (spéciale exclue, réservée au RP). */
export const SELECTABLE_LOG_VISIBILITIES: readonly Exclude<LogVisibility, 'special'>[] = [
  'eleve_parent_formateur',
  'parent_formateur',
  'formateur_rp',
]

export function getLogVisibilityLabel(visibility: LogVisibility): string {
  return LOG_VISIBILITY_LABELS[visibility] ?? visibility
}
