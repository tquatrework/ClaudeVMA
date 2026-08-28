/**
 * Module API — Quizz, volet content-catalog-service.
 * Création, définition, recherche, lecture et validation d'un quizz.
 * Toutes les requêtes passent par apiClient (base /api/v1).
 *
 * Voir `docs/routes.md` > content-catalog-service > « Quizz » pour le contrat documenté, et
 * `src/types/quiz.ts` pour les formes vérifiées contre la pile réelle le 2026-08-28.
 */

import apiClient from './client'
import type { CreateQuizPayload, PublicQuizDetail, QuizSummary } from '../types/quiz'

export interface QuizSearchResult {
  items: QuizSummary[]
  total: number
}

export interface SearchQuizzesParams {
  tag?: string
  keyword?: string
  page?: number
  limit?: number
}

const DEFAULT_PAGE = 1
const DEFAULT_LIMIT = 20

/**
 * GET /quizzes
 * Recherche paginée, filtrable par tag et mot-clé (titre). Un quizz non validé reste invisible
 * sauf à son auteur et aux AP/RP/TI.
 */
export async function searchQuizzes(params: SearchQuizzesParams = {}): Promise<QuizSearchResult> {
  const { data } = await apiClient.get<QuizSearchResult>('/quizzes', {
    params: {
      page: params.page ?? DEFAULT_PAGE,
      limit: params.limit ?? DEFAULT_LIMIT,
      ...(params.tag ? { tag: params.tag } : {}),
      ...(params.keyword ? { keyword: params.keyword } : {}),
    },
  })
  return data
}

/**
 * GET /quizzes/pending-validation
 * Liste des quizz créés par un professeur, en attente de validation AP/RP.
 *
 * `page`/`limit` sont **toujours envoyés explicitement** : constaté contre la pile réelle le
 * 2026-08-28, cette route lève une erreur serveur (500) si ces paramètres sont omis (le service
 * calcule `skip` sans valeur par défaut) — contournement côté front en attendant le correctif
 * backend, plutôt que de reproduire l'échec observé.
 */
export async function fetchPendingQuizzes(
  params: { page?: number; limit?: number } = {},
): Promise<QuizSearchResult> {
  const { data } = await apiClient.get<QuizSearchResult>('/quizzes/pending-validation', {
    params: {
      page: params.page ?? DEFAULT_PAGE,
      limit: params.limit ?? DEFAULT_LIMIT,
    },
  })
  return data
}

/**
 * GET /quizzes/:id
 * Détail avec questions et choix — jamais la solution. `404` si absent ou non visible pour
 * l'appelant (masquage classique du projet, pas de distinction avec un id inexistant).
 */
export async function fetchQuiz(quizId: string): Promise<PublicQuizDetail> {
  const { data } = await apiClient.get<PublicQuizDetail>(`/quizzes/${quizId}`)
  return data
}

/**
 * POST /quizzes
 * Crée un quizz avec ses questions. Statut initial `pending_validation` (professeur) ou
 * `validated` (AP/RP, auto-validé).
 */
export async function createQuiz(payload: CreateQuizPayload): Promise<PublicQuizDetail> {
  const { data } = await apiClient.post<PublicQuizDetail>('/quizzes', payload)
  return data
}

export type QuizValidationDecision = 'approve' | 'reject'

/**
 * POST /validations/quiz/:id/decision
 * Réutilise le flux de validation générique déjà existant (`ContentType.QUIZ`). Commentaire
 * obligatoire en cas de rejet.
 */
export async function decideQuizValidation(
  quizId: string,
  decision: QuizValidationDecision,
  comment?: string,
): Promise<void> {
  await apiClient.post(`/validations/quiz/${quizId}/decision`, { decision, comment })
}

/**
 * POST /validations/quiz/:id/request
 * Resoumission d'un quizz `rejected` à validation.
 */
export async function requestQuizValidation(quizId: string): Promise<void> {
  await apiClient.post(`/validations/quiz/${quizId}/request`, {})
}
