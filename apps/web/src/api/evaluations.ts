/**
 * Module API — Évaluations, volet content-catalog-service.
 * Recherche, création, lecture et validation d'une évaluation (suite ordonnée d'Exercices déjà
 * existants). Toutes les requêtes passent par apiClient (base /api/v1).
 *
 * Voir `docs/routes.md` > content-catalog-service > « Évaluations » pour le contrat documenté, et
 * `src/types/evaluation.ts` pour les formes.
 *
 * Deux gaps confirmés contre `.claude/reports/content-catalog-service-evaluations-2026-09-01.md`
 * (PR #195) — jamais comblés par une URL inventée, compensés ici par une lecture plus large que le
 * strict besoin, filtrée côté client :
 * - **Pas de `PUT /evaluations/:id`** : aucune fonction d'édition dans ce module, contrairement à
 *   `updateExercise`/`updateQuiz`. Une évaluation `rejected` se resoumet telle quelle
 *   (`requestEvaluationValidation`), elle ne se modifie pas.
 * - **Pas de `GET /evaluations/pending-validation`** : `fetchPendingEvaluations` réutilise
 *   `searchEvaluations` (qui renvoie tous statuts confondus pour formateur/AP/RP, confirmé par le
 *   rapport ci-dessus) et filtre `status === 'pending_validation'` côté client. Le filtrage réel
 *   par relation `animator_of_teacher` reste appliqué côté serveur au moment de la décision
 *   (`POST /validations/evaluation/:id/decision`), pas ici.
 */

import apiClient from './client'
import type {
  CreateEvaluationPayload,
  Evaluation,
  EvaluationValidationDecision,
  EvaluationValidationHistoryEntry,
} from '../types/evaluation'

export type { EvaluationValidationDecision }

export interface EvaluationSearchResult {
  items: Evaluation[]
  total: number
}

export interface SearchEvaluationsParams {
  level?: string
  difficulty?: string
  theme?: string
  tag?: string
  keyword?: string
  page?: number
  limit?: number
}

const DEFAULT_PAGE = 1
const DEFAULT_LIMIT = 20
/** Plafond utilisé pour les lectures « toutes les évaluations de l'appelant » (mine/validation),
 * en l'absence de route serveur dédiée — même valeur que `useMyExercises`/`useMyQuizzes`. */
const WIDE_LIMIT = 100

/**
 * GET /evaluations
 * Recherche paginée, filtrable par niveau/difficulté/thème/tag/mot-clé (titre). Élèves et parents
 * ne voient que les évaluations `validated` ; les autres rôles voient tous les statuts.
 */
export async function searchEvaluations(
  params: SearchEvaluationsParams = {},
): Promise<EvaluationSearchResult> {
  const { data } = await apiClient.get<EvaluationSearchResult>('/evaluations', {
    params: {
      page: params.page ?? DEFAULT_PAGE,
      limit: params.limit ?? DEFAULT_LIMIT,
      ...(params.level ? { level: params.level } : {}),
      ...(params.difficulty ? { difficulty: params.difficulty } : {}),
      ...(params.theme ? { theme: params.theme } : {}),
      ...(params.tag ? { tag: params.tag } : {}),
      ...(params.keyword ? { keyword: params.keyword } : {}),
    },
  })
  return data
}

/**
 * GET /evaluations/:id
 * Détail complet, avec la liste ordonnée d'Exercices (`exerciseItems`, ids uniquement — jamais
 * leur contenu ici). `404` si absent. Ne filtre pas par statut/auteur (écart pré-existant, non
 * corrigé par le chantier du 2026-09-01, signalé dans le rapport `content-catalog-service`).
 */
export async function fetchEvaluation(evaluationId: string): Promise<Evaluation> {
  const { data } = await apiClient.get<Evaluation>(`/evaluations/${evaluationId}`)
  return data
}

/**
 * POST /evaluations
 * Crée une évaluation à partir d'exercices déjà existants. Statut initial `pending_validation`
 * (formateur) ou `validated` (AP/RP, auto-validé). `durationSeconds` obligatoire (> 0).
 */
export async function createEvaluation(payload: CreateEvaluationPayload): Promise<Evaluation> {
  const { data } = await apiClient.post<Evaluation>('/evaluations', payload)
  return data
}

/** DELETE /evaluations/:id — retire une évaluation (statut `REMOVED`). Auteur, RP ou TI. */
export async function deleteEvaluation(evaluationId: string): Promise<void> {
  await apiClient.delete(`/evaluations/${evaluationId}`)
}

/**
 * « Mes évaluations » : pas de filtre `authorId`/`mine` documenté pour `GET /evaluations`
 * (contrairement à Quizz/Exercice) — lit une page large (tous statuts, confirmé par le rapport
 * `content-catalog-service`) et filtre par auteur côté client. Peut manquer des évaluations
 * au-delà de `WIDE_LIMIT` sur un catalogue très fourni — limitation connue, même famille que les
 * autres lectures « larges » de ce projet.
 */
export async function fetchMyEvaluations(authorId: string): Promise<Evaluation[]> {
  const result = await searchEvaluations({ limit: WIDE_LIMIT })
  return result.items.filter((evaluation) => evaluation.authorId === authorId)
}

/**
 * File de validation — voir le gap documenté en tête de fichier. Filtre `status ===
 * 'pending_validation'` côté client sur une lecture large ; le scoping réel par relation
 * `animator_of_teacher` reste appliqué côté serveur à la décision.
 */
export async function fetchPendingEvaluations(): Promise<Evaluation[]> {
  const result = await searchEvaluations({ limit: WIDE_LIMIT })
  return result.items.filter((evaluation) => evaluation.status === 'pending_validation')
}

// ─── Validation — flux générique partagé avec Exercice/Quizz/Tutoriel ─────────────────

/**
 * GET /validations/evaluation/:id/history
 * Non documentée séparément pour l'Évaluation dans `docs/routes.md` (voir `types/evaluation.ts`) —
 * appelée par analogie avec le flux générique partagé. Les appelants tolèrent un échec (mêmes
 * précautions que `useMyExercises`/`useMyQuizzes`, repli `rejectionCommentStatus: 'unavailable'`).
 */
export async function fetchEvaluationValidationHistory(
  evaluationId: string,
): Promise<EvaluationValidationHistoryEntry[]> {
  const { data } = await apiClient.get<EvaluationValidationHistoryEntry[]>(
    `/validations/evaluation/${evaluationId}/history`,
  )
  return data
}

/**
 * POST /validations/evaluation/:id/decision
 * Commentaire obligatoire en cas de rejet. AP scopé par la relation `animator_of_teacher`, RP
 * illimité (arbitrage du 2026-09-01).
 */
export async function decideEvaluationValidation(
  evaluationId: string,
  decision: EvaluationValidationDecision,
  comment?: string,
): Promise<void> {
  await apiClient.post(`/validations/evaluation/${evaluationId}/decision`, { decision, comment })
}

/** POST /validations/evaluation/:id/request — resoumission d'une évaluation `rejected`. */
export async function requestEvaluationValidation(evaluationId: string): Promise<void> {
  await apiClient.post(`/validations/evaluation/${evaluationId}/request`, {})
}
