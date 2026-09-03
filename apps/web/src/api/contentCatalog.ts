/**
 * Module API — content-catalog-service (Phase 12)
 * Commentaires, notations génériques sur un contenu pédagogique.
 * Toutes les requêtes passent par apiClient (base /api/v1).
 *
 * Les Exercices ont été retirés de ce module le 2026-08-29 (refonte en blocs typés) : voir
 * `src/api/exercises.ts` (content-catalog-service) et `src/api/exerciseAttempts.ts`
 * (learning-activity-service, réponses/tentatives/historique). L'ancien modèle plat
 * (`Exercise`, `ExerciseAnswer`, `ExerciseSolution`, demande de correction) ne correspond plus au
 * contrat serveur réel — voir `docs/architecture.md` > « Refonte des Exercices ».
 *
 * Les Évaluations sont retirées de ce module le 2026-09-02 (refonte notation manuelle/demande de
 * correction) : voir `src/api/evaluations.ts` (content-catalog-service), `src/api/evaluationAttempts.ts`
 * et `src/api/evaluationCorrections.ts` (learning-activity-service). L'ancien modèle plat
 * (`Evaluation.subject`/`solutionContent`, `POST /evaluations/:id/attempts`) ne correspond plus au
 * contrat serveur réel — voir `docs/architecture.md` > « Refonte des Evaluations ».
 *
 * Les Tutoriels sont retirés de ce module le 2026-09-03 (refonte vidéo/post) : voir
 * `src/api/tutorials.ts` (content-catalog-service). L'ancien modèle plat (`tutorialType`
 * académie/activité/news, `format` texte/mixte/vidéo, `textContent`/`imageUrl` scalaires) ne
 * correspond plus au contrat serveur réel — voir `docs/architecture.md` > « Refonte des
 * Tutos/Vidéos ».
 */

import apiClient from './client'

// ─── Types communs ────────────────────────────────────────────────────────────

export type ContentType = 'exercise' | 'evaluation' | 'tutorial'

export type DifficultyLevel = 'facile' | 'moyen' | 'difficile'

export type ContentStatus = 'draft' | 'pending_validation' | 'published' | 'rejected'

// ─── Commentaires et notations ────────────────────────────────────────────────

export interface ContentComment {
  id: string
  contentId: string
  authorId: string
  content: string
  createdAt: string
}

export interface CreateCommentPayload {
  content: string
}

export interface CreateRatingPayload {
  score: number
}

export interface ContentRating {
  id: string
  contentId: string
  authorId: string
  score: number
  createdAt: string
}

// ─── Liste paginée ────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[]
  meta: {
    total: number
    page: number
    pageSize: number
  }
}

// ─── API Commentaires et notations ───────────────────────────────────────────

/**
 * POST /contents/:id/comments
 * Ajoute un commentaire sur un contenu pédagogique.
 */
export async function createContentComment(
  contentId: string,
  payload: CreateCommentPayload,
): Promise<ContentComment> {
  const { data } = await apiClient.post<ContentComment>(
    `/contents/${contentId}/comments`,
    payload,
  )
  return data
}

/**
 * POST /contents/:id/ratings
 * Évalue un contenu pédagogique (score).
 */
export async function createContentRating(
  contentId: string,
  payload: CreateRatingPayload,
): Promise<ContentRating> {
  const { data } = await apiClient.post<ContentRating>(
    `/contents/${contentId}/ratings`,
    payload,
  )
  return data
}
