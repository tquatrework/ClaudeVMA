/**
 * Point unique de correspondance statut/catégorie technique → libellé français, pour l'Exercice.
 * Même modèle que `quizLabels.ts` (règle de langue du 2026-08-09).
 */

import type { ExerciseAttemptStatus, ExercisePartCategory, ExerciseStatus } from '../types/exercise'

export const EXERCISE_STATUS_LABELS: Record<ExerciseStatus, string> = {
  pending_validation: 'En attente de validation',
  validated: 'Validé',
  rejected: 'Refusé',
}

export const EXERCISE_STATUS_BADGE_CLASSES: Record<ExerciseStatus, string> = {
  pending_validation: 'bg-orange-100 text-orange-700',
  validated: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
}

export const EXERCISE_PART_CATEGORY_LABELS: Record<ExercisePartCategory, string> = {
  statement: 'Énoncé',
  question: 'Question',
}

export const EXERCISE_ATTEMPT_STATUS_LABELS: Record<ExerciseAttemptStatus, string> = {
  in_progress: 'En cours',
  done: 'Terminé',
}

export const EXERCISE_ATTEMPT_STATUS_BADGE_CLASSES: Record<ExerciseAttemptStatus, string> = {
  in_progress: 'bg-blue-100 text-blue-700',
  done: 'bg-green-100 text-green-700',
}

/** « Exercice sans titre » — le titre est optionnel côté serveur. */
export function getExerciseDisplayTitle(title: string | null | undefined): string {
  const trimmed = title?.trim()
  return trimmed ? trimmed : 'Exercice sans titre'
}
