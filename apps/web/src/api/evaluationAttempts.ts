/**
 * Module API — Tentatives d'Évaluation, volet learning-activity-service.
 * Démarrage chronométré, réponses, clôture, demande de correction et historique.
 * Toutes les requêtes passent par apiClient (base /api/v1).
 *
 * Voir `docs/routes.md` > learning-activity-service > « Tentatives d'Évaluation » pour le contrat
 * documenté, et `src/types/evaluationAttempt.ts` pour les formes (avec la réserve sur le nom exact
 * du corps de `submitEvaluationAttemptAnswer`, déduit par analogie avec `exercise-attempts`).
 */

import apiClient from './client'
import type { EvaluationAttemptAnswerItem, EvaluationAttemptView } from '../types/evaluationAttempt'
import type { EvaluationCorrectionRequest } from '../types/evaluationAttempt'

/**
 * POST /evaluation-attempts
 * Démarre une tentative — l'Évaluation doit être `validated` (400 sinon). Fige `deadlineAt` et la
 * liste des exercices au démarrage.
 */
export async function startEvaluationAttempt(evaluationId: string): Promise<EvaluationAttemptView> {
  const { data } = await apiClient.post<EvaluationAttemptView>('/evaluation-attempts', {
    evaluationId,
  })
  return data
}

/**
 * POST /evaluation-attempts/:id/answers
 * Soumet/remplace la réponse à un bloc question d'un Exercice de l'Évaluation. Refusé (400) après
 * l'échéance, si la tentative est déjà close, ou si l'Exercice ne fait pas partie de l'Évaluation.
 * Idempotent par `(exerciseId, partId)`.
 */
export async function submitEvaluationAttemptAnswer(
  attemptId: string,
  exerciseId: string,
  partId: string,
  content: EvaluationAttemptAnswerItem[],
): Promise<EvaluationAttemptView> {
  const { data } = await apiClient.post<EvaluationAttemptView>(
    `/evaluation-attempts/${attemptId}/answers`,
    { exerciseId, partId, content },
  )
  return data
}

/**
 * POST /evaluation-attempts/:id/submit
 * « Enregistrer sa réponse » : clôture la tentative sans déclencher de correction. Autorisé même
 * après l'échéance.
 */
export async function submitEvaluationAttempt(attemptId: string): Promise<EvaluationAttemptView> {
  const { data } = await apiClient.post<EvaluationAttemptView>(
    `/evaluation-attempts/${attemptId}/submit`,
    {},
  )
  return data
}

/**
 * POST /evaluation-attempts/:id/request-correction
 * Nécessite une tentative déjà close. Peut être appelée immédiatement après `submit`, ou plus tard
 * depuis l'historique (deux actions distinctes, non couplées — arbitrage du 2026-09-01).
 */
export async function requestEvaluationCorrection(
  attemptId: string,
): Promise<EvaluationCorrectionRequest> {
  const { data } = await apiClient.post<EvaluationCorrectionRequest>(
    `/evaluation-attempts/${attemptId}/request-correction`,
    {},
  )
  return data
}

/** GET /evaluation-attempts/history — tentatives de l'appelant, passées et en cours. */
export async function fetchEvaluationAttemptHistory(): Promise<EvaluationAttemptView[]> {
  const { data } = await apiClient.get<EvaluationAttemptView[]>('/evaluation-attempts/history')
  return data
}

/** GET /evaluation-attempts/:id — état d'une tentative (propriétaire uniquement, 404 sinon). */
export async function fetchEvaluationAttempt(attemptId: string): Promise<EvaluationAttemptView> {
  const { data } = await apiClient.get<EvaluationAttemptView>(`/evaluation-attempts/${attemptId}`)
  return data
}
