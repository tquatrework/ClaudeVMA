/**
 * Point unique de correspondance statut technique → libellé français, pour l'Évaluation.
 * Même modèle que `quizLabels.ts`/`exerciseLabels.ts` (règle de langue du 2026-08-09).
 */

import type { EvaluationStatus } from '../types/evaluation'
import type {
  EvaluationAttemptStatus,
  EvaluationCorrectionStatus,
} from '../types/evaluationAttempt'

export const EVALUATION_STATUS_LABELS: Record<EvaluationStatus, string> = {
  pending_validation: 'En attente de validation',
  validated: 'Validée',
  rejected: 'Refusée',
}

export const EVALUATION_STATUS_BADGE_CLASSES: Record<EvaluationStatus, string> = {
  pending_validation: 'bg-orange-100 text-orange-700',
  validated: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
}

export const EVALUATION_ATTEMPT_STATUS_LABELS: Record<EvaluationAttemptStatus, string> = {
  in_progress: 'En cours',
  completed: 'Terminée',
  abandoned: 'Abandonnée',
}

export const EVALUATION_ATTEMPT_STATUS_BADGE_CLASSES: Record<EvaluationAttemptStatus, string> = {
  in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  abandoned: 'bg-gray-100 text-gray-500',
}

export const EVALUATION_CORRECTION_STATUS_LABELS: Record<EvaluationCorrectionStatus, string> = {
  pending: 'En attente d’un correcteur',
  accepted: 'Prise en charge',
  corrected: 'Corrigée',
  all_declined: 'Aucun professeur disponible',
}

export const EVALUATION_CORRECTION_STATUS_BADGE_CLASSES: Record<EvaluationCorrectionStatus, string> = {
  pending: 'bg-orange-100 text-orange-700',
  accepted: 'bg-blue-100 text-blue-700',
  corrected: 'bg-green-100 text-green-700',
  all_declined: 'bg-red-100 text-red-700',
}

/**
 * Normalise `score`, potentiellement renvoyé en chaîne décimale (sérialisation Postgres côté
 * serveur) — même prudence que `toQuizScore` dans `quizLabels.ts`. `null` reste `null` (pas encore
 * corrigée), à ne jamais confondre avec `0`.
 */
export function toEvaluationCorrectionScore(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null
  const parsed = typeof value === 'string' ? Number.parseFloat(value) : value
  return Number.isFinite(parsed) ? parsed : null
}

export function formatEvaluationCorrectionScore(value: number | string | null | undefined): string {
  const parsed = toEvaluationCorrectionScore(value)
  return parsed === null ? '—' : Number.isInteger(parsed) ? String(parsed) : parsed.toFixed(2)
}

/** « Évaluation sans titre » — filet de sécurité si un titre venait à manquer un jour. */
export function getEvaluationDisplayTitle(title: string | null | undefined): string {
  const trimmed = title?.trim()
  return trimmed ? trimmed : 'Évaluation sans titre'
}
