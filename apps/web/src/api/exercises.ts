/**
 * Module API — Exercices, volet content-catalog-service.
 * Recherche, création, édition, lecture, validation et images d'un exercice.
 * Toutes les requêtes passent par apiClient (base /api/v1).
 *
 * Voir `docs/routes.md` > content-catalog-service > « Exercices — refonte du 2026-08-29 »
 * pour le contrat documenté, et `src/types/exercise.ts` pour les formes.
 */

import apiClient from './client'
import type {
  CreateExercisePayload,
  ExerciseSummary,
  ExerciseValidationDecision,
  ExerciseValidationHistoryEntry,
  PublicContentItem,
  PublicExerciseDetail,
} from '../types/exercise'

export type { ExerciseValidationDecision }

export interface ExerciseSearchResult {
  items: ExerciseSummary[]
  total: number
}

export interface SearchExercisesParams {
  level?: string
  difficulty?: string
  theme?: string
  authorId?: string
  tag?: string
  keyword?: string
  page?: number
  limit?: number
}

const DEFAULT_PAGE = 1
const DEFAULT_LIMIT = 20

/**
 * GET /exercises
 * Recherche paginée, filtrable par niveau/difficulté/thème/auteur/tag/mot-clé (titre). Un
 * exercice non validé reste invisible sauf à son auteur et aux AP/RP/TI.
 */
export async function searchExercises(
  params: SearchExercisesParams = {},
): Promise<ExerciseSearchResult> {
  const { data } = await apiClient.get<ExerciseSearchResult>('/exercises', {
    params: {
      page: params.page ?? DEFAULT_PAGE,
      limit: params.limit ?? DEFAULT_LIMIT,
      ...(params.level ? { level: params.level } : {}),
      ...(params.difficulty ? { difficulty: params.difficulty } : {}),
      ...(params.theme ? { theme: params.theme } : {}),
      ...(params.authorId ? { authorId: params.authorId } : {}),
      ...(params.tag ? { tag: params.tag } : {}),
      ...(params.keyword ? { keyword: params.keyword } : {}),
    },
  })
  return data
}

/**
 * GET /exercises/pending-validation
 * Liste des exercices créés par un professeur, en attente de validation AP/RP. Un AP ne voit
 * que les formateurs qu'il anime, le RP voit tout.
 */
export async function fetchPendingExercises(
  params: { page?: number; limit?: number } = {},
): Promise<ExerciseSearchResult> {
  const { data } = await apiClient.get<ExerciseSearchResult>('/exercises/pending-validation', {
    params: {
      page: params.page ?? DEFAULT_PAGE,
      limit: params.limit ?? DEFAULT_LIMIT,
    },
  })
  return data
}

/**
 * GET /exercises/:id
 * Détail complet — blocs et items, jamais le contenu d'une solution (`hasSolution: boolean`
 * uniquement sur un bloc `question`). `404` si absent ou non visible pour l'appelant.
 */
export async function fetchExercise(exerciseId: string): Promise<PublicExerciseDetail> {
  const { data } = await apiClient.get<PublicExerciseDetail>(`/exercises/${exerciseId}`)
  return data
}

/**
 * POST /exercises
 * Crée un exercice. Statut initial `pending_validation` (professeur) ou `validated` (AP/RP,
 * auto-validé). Les items de type `image` ne peuvent pas être créés ici — voir
 * `uploadExercisePartImage`/`uploadExerciseSolutionImage`, à appeler après création.
 */
export async function createExercise(
  payload: CreateExercisePayload,
): Promise<PublicExerciseDetail> {
  const { data } = await apiClient.post<PublicExerciseDetail>('/exercises', payload)
  return data
}

/**
 * PUT /exercises/:id
 * Remplace intégralement un exercice — réservé à l'auteur. Repasse en `pending_validation` si
 * l'auteur est formateur et que l'exercice était `validated`. **Supprime les images déjà
 * envoyées** (limite documentée côté serveur) : à renvoyer après l'édition si besoin.
 */
export async function updateExercise(
  exerciseId: string,
  payload: CreateExercisePayload,
): Promise<PublicExerciseDetail> {
  const { data } = await apiClient.put<PublicExerciseDetail>(
    `/exercises/${exerciseId}`,
    payload,
  )
  return data
}

/** DELETE /exercises/:id — retire un exercice (statut `REMOVED`). Auteur, RP ou TI. */
export async function deleteExercise(exerciseId: string): Promise<void> {
  await apiClient.delete(`/exercises/${exerciseId}`)
}

/**
 * GET /exercises/:exerciseId/images/:itemId
 * Octets d'une image de bloc (jamais une image de solution, servie exclusivement via
 * learning-activity-service).
 */
export async function fetchExercisePartImageBlob(
  exerciseId: string,
  itemId: string,
): Promise<Blob> {
  const { data } = await apiClient.get<Blob>(`/exercises/${exerciseId}/images/${itemId}`, {
    responseType: 'blob',
  })
  return data
}

/**
 * POST /exercises/:id/parts/:partId/images
 * Ajoute une image à un bloc (multipart, champ `file`, `caption?`). Réservé à l'auteur —
 * repasse l'exercice en `pending_validation` si l'auteur est formateur. `Content-Type`
 * neutralisé pour laisser le navigateur poser le `boundary` multipart.
 */
export async function uploadExercisePartImage(
  exerciseId: string,
  partId: string,
  file: File,
  caption?: string,
): Promise<PublicContentItem> {
  const formData = new FormData()
  formData.append('file', file)
  if (caption) formData.append('caption', caption)

  const { data } = await apiClient.post<PublicContentItem>(
    `/exercises/${exerciseId}/parts/${partId}/images`,
    formData,
    { headers: { 'Content-Type': undefined } },
  )
  return data
}

/**
 * POST /exercises/:id/parts/:partId/solution/images
 * Ajoute une image à la solution d'un bloc `question` (multipart, mêmes règles). Jamais servie
 * par une route publique de lecture — accessible uniquement via la médiation de
 * `learning-activity-service` une fois révélée.
 */
export async function uploadExerciseSolutionImage(
  exerciseId: string,
  partId: string,
  file: File,
  caption?: string,
): Promise<PublicContentItem> {
  const formData = new FormData()
  formData.append('file', file)
  if (caption) formData.append('caption', caption)

  const { data } = await apiClient.post<PublicContentItem>(
    `/exercises/${exerciseId}/parts/${partId}/solution/images`,
    formData,
    { headers: { 'Content-Type': undefined } },
  )
  return data
}

// ─── Validation — flux générique partagé avec le Quizz (ContentType.EXERCISE) ─────────────────

/**
 * GET /validations/exercise/:id/history
 * Historique chronologique des décisions de validation d'un exercice — ouvert à RP/AP et à
 * l'auteur du contenu (même mécanisme générique que pour le Quizz).
 */
export async function fetchExerciseValidationHistory(
  exerciseId: string,
): Promise<ExerciseValidationHistoryEntry[]> {
  const { data } = await apiClient.get<ExerciseValidationHistoryEntry[]>(
    `/validations/exercise/${exerciseId}/history`,
  )
  return data
}

/**
 * POST /validations/exercise/:id/decision
 * Réutilise le flux de validation générique déjà existant. Commentaire obligatoire en cas de
 * rejet. Vocabulaire réel attendu par le serveur : `'validated' | 'rejected'` (même contrat que
 * le Quizz — voir `docs/routes.md` § Quizz pour la confirmation historique de ce vocabulaire).
 */
export async function decideExerciseValidation(
  exerciseId: string,
  decision: ExerciseValidationDecision,
  comment?: string,
): Promise<void> {
  await apiClient.post(`/validations/exercise/${exerciseId}/decision`, { decision, comment })
}

/**
 * POST /validations/exercise/:id/request
 * Resoumission d'un exercice `rejected` à validation.
 */
export async function requestExerciseValidation(exerciseId: string): Promise<void> {
  await apiClient.post(`/validations/exercise/${exerciseId}/request`, {})
}
