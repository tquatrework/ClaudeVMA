/**
 * Module API — Demandes de correction d'Évaluation, volet learning-activity-service.
 * File d'attente (professeur/RP), acceptation/refus, correction (score + commentaire), détail.
 * Toutes les requêtes passent par apiClient (base /api/v1).
 *
 * Voir `docs/routes.md` > learning-activity-service > « Demandes de correction » pour le contrat
 * documenté, et `src/types/evaluationAttempt.ts` pour les formes. La correction ne compare
 * **jamais** à la solution officielle de l'Exercice (arbitrage du 2026-09-01, point 6) : le
 * correcteur ne lit que la réponse soumise par l'élève (`attemptAnswers`, jointe uniquement par
 * `fetchEvaluationCorrectionDetail`).
 */

import apiClient from './client'
import type { EvaluationCorrectionRequest } from '../types/evaluationAttempt'

/**
 * GET /evaluation-corrections/pending
 * Professeur : demandes `pending` où il est lié à l'élève et n'a pas encore refusé.
 * RP : toutes les demandes `pending` et `all_declined` (état actionnable).
 */
export async function fetchPendingEvaluationCorrections(): Promise<EvaluationCorrectionRequest[]> {
  const { data } = await apiClient.get<EvaluationCorrectionRequest[]>('/evaluation-corrections/pending')
  return data
}

/** GET /evaluation-corrections/mine — demandes acceptées et/ou corrigées par l'appelant. */
export async function fetchMyEvaluationCorrections(): Promise<EvaluationCorrectionRequest[]> {
  const { data } = await apiClient.get<EvaluationCorrectionRequest[]>('/evaluation-corrections/mine')
  return data
}

/**
 * GET /evaluation-corrections/:id
 * Détail — `attemptAnswers` (réponses de l'élève) jointes uniquement pour l'élève propriétaire,
 * un professeur lié, le professeur ayant accepté, ou le RP.
 */
export async function fetchEvaluationCorrectionDetail(
  correctionRequestId: string,
): Promise<EvaluationCorrectionRequest> {
  const { data } = await apiClient.get<EvaluationCorrectionRequest>(
    `/evaluation-corrections/${correctionRequestId}`,
  )
  return data
}

/**
 * POST /evaluation-corrections/:id/accept
 * Premier arrivé premier servi. Le RP peut accepter en override d'escalade, y compris depuis
 * `all_declined`.
 */
export async function acceptEvaluationCorrection(
  correctionRequestId: string,
): Promise<EvaluationCorrectionRequest> {
  const { data } = await apiClient.post<EvaluationCorrectionRequest>(
    `/evaluation-corrections/${correctionRequestId}/accept`,
    {},
  )
  return data
}

/** POST /evaluation-corrections/:id/decline — refus individuel (professeur lié uniquement). */
export async function declineEvaluationCorrection(
  correctionRequestId: string,
): Promise<EvaluationCorrectionRequest> {
  const { data } = await apiClient.post<EvaluationCorrectionRequest>(
    `/evaluation-corrections/${correctionRequestId}/decline`,
    {},
  )
  return data
}

/**
 * POST /evaluation-corrections/:id/correct
 * Score et/ou commentaire, réservé à celui qui a accepté (professeur ou RP). Refusé (400) si ni
 * score ni commentaire.
 */
export async function correctEvaluationCorrection(
  correctionRequestId: string,
  payload: { score?: number; comment?: string },
): Promise<EvaluationCorrectionRequest> {
  const { data } = await apiClient.post<EvaluationCorrectionRequest>(
    `/evaluation-corrections/${correctionRequestId}/correct`,
    payload,
  )
  return data
}
