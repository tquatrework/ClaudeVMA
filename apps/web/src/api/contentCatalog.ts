/**
 * Module API — content-catalog-service (Phase 12)
 * Exercices, évaluations, tutos-vidéos, réponses, corrections, commentaires.
 * Toutes les requêtes passent par apiClient (base /api/v1).
 */

import apiClient from './client'

// ─── Types communs ────────────────────────────────────────────────────────────

export type ContentType = 'exercise' | 'evaluation' | 'tutorial'

export type DifficultyLevel = 'facile' | 'moyen' | 'difficile'

export type ContentStatus = 'draft' | 'pending_validation' | 'published' | 'rejected'

export type CorrectionStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled'

// ─── Exercices ────────────────────────────────────────────────────────────────

export interface Exercise {
  id: string
  title: string
  description: string
  subject: string
  level: string
  difficultyLevel: DifficultyLevel
  status: ContentStatus
  authorId: string
  hasSolution: boolean
  createdAt: string
  updatedAt?: string
}

export interface CreateExercisePayload {
  title: string
  description: string
  subject: string
  level: string
  difficultyLevel: DifficultyLevel
  solutionContent: string
}

export interface ExerciseAnswer {
  id: string
  exerciseId: string
  studentId: string
  content: string
  submittedAt: string
  correctionStatus?: CorrectionStatus
}

export interface SubmitExerciseAnswerPayload {
  content: string
}

export interface ExerciseSolution {
  id: string
  exerciseId: string
  content: string
  createdAt: string
}

export interface CreateExerciseSolutionPayload {
  content: string
}

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

// ─── Demande de correction ────────────────────────────────────────────────────

export interface CorrectionRequest {
  id: string
  exerciseAnswerId: string
  studentId: string
  requestedAt: string
  correctionStatus: CorrectionStatus
}

export interface CreateCorrectionRequestPayload {
  message?: string
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

// ─── API Exercices ────────────────────────────────────────────────────────────

/**
 * GET /exercises
 * Liste les exercices publiés (ou tous pour RP/AP).
 */
export async function fetchExercises(params?: {
  subject?: string
  level?: string
  difficultyLevel?: DifficultyLevel
  status?: ContentStatus
}): Promise<Exercise[]> {
  const { data } = await apiClient.get<Exercise[] | PaginatedResponse<Exercise>>('/exercises', {
    params,
  })
  if (Array.isArray(data)) return data
  return (data as PaginatedResponse<Exercise>).data ?? []
}

/**
 * POST /exercises
 * Crée un exercice (formateur, AP, RP). Nécessite une solution.
 */
export async function createExercise(payload: CreateExercisePayload): Promise<Exercise> {
  const { data } = await apiClient.post<Exercise>('/exercises', payload)
  return data
}

/**
 * POST /exercises/:id/answers
 * L'élève soumet une réponse à un exercice.
 */
export async function submitExerciseAnswer(
  exerciseId: string,
  payload: SubmitExerciseAnswerPayload,
): Promise<ExerciseAnswer> {
  const { data } = await apiClient.post<ExerciseAnswer>(
    `/exercises/${exerciseId}/answers`,
    payload,
  )
  return data
}

/**
 * POST /exercises/:id/solutions
 * Publie la solution d'un exercice (formateur, RP, AP).
 */
export async function createExerciseSolution(
  exerciseId: string,
  payload: CreateExerciseSolutionPayload,
): Promise<ExerciseSolution> {
  const { data } = await apiClient.post<ExerciseSolution>(
    `/exercises/${exerciseId}/solutions`,
    payload,
  )
  return data
}

// ─── API Demande de correction ────────────────────────────────────────────────

/**
 * POST /exercise-answers/:id/correction-requests
 * L'élève demande une correction sur sa réponse soumise.
 */
export async function requestExerciseCorrection(
  answerId: string,
  payload: CreateCorrectionRequestPayload,
): Promise<CorrectionRequest> {
  const { data } = await apiClient.post<CorrectionRequest>(
    `/exercise-answers/${answerId}/correction-requests`,
    payload,
  )
  return data
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
