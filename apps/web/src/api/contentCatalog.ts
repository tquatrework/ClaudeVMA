/**
 * Module API — content-catalog-service (Phase 12)
 * Évaluations, tutos-vidéos, commentaires, notations.
 * Toutes les requêtes passent par apiClient (base /api/v1).
 *
 * Les Exercices ont été retirés de ce module le 2026-08-29 (refonte en blocs typés) : voir
 * `src/api/exercises.ts` (content-catalog-service) et `src/api/exerciseAttempts.ts`
 * (learning-activity-service, réponses/tentatives/historique). L'ancien modèle plat
 * (`Exercise`, `ExerciseAnswer`, `ExerciseSolution`, demande de correction) ne correspond plus au
 * contrat serveur réel — voir `docs/architecture.md` > « Refonte des Exercices ».
 */

import apiClient from './client'

// ─── Types communs ────────────────────────────────────────────────────────────

export type ContentType = 'exercise' | 'evaluation' | 'tutorial'

export type DifficultyLevel = 'facile' | 'moyen' | 'difficile'

export type ContentStatus = 'draft' | 'pending_validation' | 'published' | 'rejected'

// ─── Évaluations ─────────────────────────────────────────────────────────────

export interface Evaluation {
  id: string
  title: string
  description: string
  subject: string
  level: string
  difficultyLevel: DifficultyLevel
  status: ContentStatus
  authorId: string
  durationMinutes?: number
  hasSolution: boolean
  createdAt: string
  updatedAt?: string
}

export interface CreateEvaluationPayload {
  title: string
  description: string
  subject: string
  level: string
  difficultyLevel: DifficultyLevel
  solutionContent: string
  durationMinutes?: number
}

export interface EvaluationAttempt {
  id: string
  evaluationId: string
  studentId: string
  answers: string
  startedAt: string
  completedAt?: string
  score?: number
  isSolutionUnlocked: boolean
}

export interface StartEvaluationAttemptPayload {
  answers?: string
}

// ─── Tutoriels ────────────────────────────────────────────────────────────────

export interface Tutorial {
  id: string
  title: string
  description: string
  subject: string
  level: string
  videoUrl?: string
  status: ContentStatus
  authorId: string
  createdAt: string
  updatedAt?: string
}

export interface CreateTutorialPayload {
  title: string
  description: string
  subject: string
  level: string
  videoUrl?: string
}

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

// ─── API Évaluations ──────────────────────────────────────────────────────────

/**
 * GET /evaluations
 * Liste les évaluations publiées (ou toutes pour RP/AP).
 */
export async function fetchEvaluations(params?: {
  subject?: string
  level?: string
  status?: ContentStatus
}): Promise<Evaluation[]> {
  const { data } = await apiClient.get<Evaluation[] | PaginatedResponse<Evaluation>>(
    '/evaluations',
    { params },
  )
  if (Array.isArray(data)) return data
  return (data as PaginatedResponse<Evaluation>).data ?? []
}

/**
 * POST /evaluations
 * Crée une évaluation (formateur, AP, RP). Nécessite une solution.
 */
export async function createEvaluation(payload: CreateEvaluationPayload): Promise<Evaluation> {
  const { data } = await apiClient.post<Evaluation>('/evaluations', payload)
  return data
}

/**
 * POST /evaluations/:id/attempts
 * L'élève démarre ou soumet une tentative d'évaluation.
 */
export async function startEvaluationAttempt(
  evaluationId: string,
  payload: StartEvaluationAttemptPayload,
): Promise<EvaluationAttempt> {
  const { data } = await apiClient.post<EvaluationAttempt>(
    `/evaluations/${evaluationId}/attempts`,
    payload,
  )
  return data
}

// ─── API Tutoriels ────────────────────────────────────────────────────────────

/**
 * GET /tutorials
 * Liste les tutoriels publiés (ou tous pour RP/AP).
 */
export async function fetchTutorials(params?: {
  subject?: string
  level?: string
  status?: ContentStatus
}): Promise<Tutorial[]> {
  const { data } = await apiClient.get<Tutorial[] | PaginatedResponse<Tutorial>>('/tutorials', {
    params,
  })
  if (Array.isArray(data)) return data
  return (data as PaginatedResponse<Tutorial>).data ?? []
}

/**
 * POST /tutorials
 * Crée un tutoriel vidéo (formateur, AP, RP).
 */
export async function createTutorial(payload: CreateTutorialPayload): Promise<Tutorial> {
  const { data } = await apiClient.post<Tutorial>('/tutorials', payload)
  return data
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
