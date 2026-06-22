/**
 * Module API — community-path-service (Phase 14)
 * Forums, modération, parcours, inscriptions, progression et certificats.
 * Toutes les requêtes passent par apiClient (base /api/v1).
 */

import apiClient from './client'

// ─── Types — Forums ───────────────────────────────────────────────────────────

export type ForumStatus = 'draft' | 'pending_validation' | 'published' | 'closed'

export interface Forum {
  id: string
  title: string
  description: string
  authorId: string
  status: ForumStatus
  createdAt: string
  updatedAt?: string
  commentCount?: number
}

export interface CreateForumPayload {
  title: string
  description: string
}

export interface ForumComment {
  id: string
  forumId: string
  authorId: string
  content: string
  createdAt: string
}

export interface CreateForumCommentPayload {
  content: string
}

export interface ForumExclusion {
  id: string
  forumId: string
  excludedUserId: string
  reason?: string
  createdAt: string
}

export interface CreateForumExclusionPayload {
  excludedUserId: string
  reason?: string
}

// ─── Types — Parcours ─────────────────────────────────────────────────────────

export type PathStatus = 'draft' | 'pending_validation' | 'published' | 'archived'

export interface LearningPath {
  id: string
  title: string
  description: string
  authorId: string
  status: PathStatus
  stepCount?: number
  createdAt: string
  updatedAt?: string
}

export interface CreatePathPayload {
  title: string
  description: string
}

export interface PathValidationPayload {
  approved: boolean
  comment?: string
}

// ─── Types — Inscriptions et progression ─────────────────────────────────────

export type EnrollmentStatus = 'active' | 'completed' | 'cancelled'

export interface PathEnrollment {
  id: string
  pathId: string
  studentId: string
  status: EnrollmentStatus
  progressPercent: number
  enrolledAt: string
  completedAt?: string
  certificateUrl?: string
}

export interface CreateEnrollmentPayload {
  studentId?: string
}

export interface UpdateProgressPayload {
  progressPercent: number
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

// ─── API Forums ───────────────────────────────────────────────────────────────

/**
 * GET /forums
 * Liste les forums (publiés pour tous, tous les statuts pour AP/RP).
 */
export async function fetchForums(params?: {
  status?: ForumStatus
}): Promise<Forum[]> {
  const { data } = await apiClient.get<Forum[] | PaginatedResponse<Forum>>('/forums', { params })
  if (Array.isArray(data)) return data
  return (data as PaginatedResponse<Forum>).data ?? []
}

/**
 * POST /forums
 * Crée un forum (AP). La publication nécessite validation RP.
 */
export async function createForum(payload: CreateForumPayload): Promise<Forum> {
  const { data } = await apiClient.post<Forum>('/forums', payload)
  return data
}

/**
 * POST /forums/:id/comments
 * Ajoute un commentaire dans un forum.
 */
export async function createForumComment(
  forumId: string,
  payload: CreateForumCommentPayload,
): Promise<ForumComment> {
  const { data } = await apiClient.post<ForumComment>(`/forums/${forumId}/comments`, payload)
  return data
}

/**
 * POST /forums/:id/exclusions
 * Exclut un membre d'un forum (modération AP/RP).
 */
export async function createForumExclusion(
  forumId: string,
  payload: CreateForumExclusionPayload,
): Promise<ForumExclusion> {
  const { data } = await apiClient.post<ForumExclusion>(`/forums/${forumId}/exclusions`, payload)
  return data
}

// ─── API Parcours ─────────────────────────────────────────────────────────────

/**
 * GET /paths
 * Liste les parcours disponibles.
 */
export async function fetchPaths(params?: {
  status?: PathStatus
}): Promise<LearningPath[]> {
  const { data } = await apiClient.get<LearningPath[] | PaginatedResponse<LearningPath>>(
    '/paths',
    { params },
  )
  if (Array.isArray(data)) return data
  return (data as PaginatedResponse<LearningPath>).data ?? []
}

/**
 * POST /paths
 * Crée un parcours (AP, RP).
 */
export async function createPath(payload: CreatePathPayload): Promise<LearningPath> {
  const { data } = await apiClient.post<LearningPath>('/paths', payload)
  return data
}

/**
 * POST /paths/:id/validate
 * Le RP valide ou rejette un parcours AP.
 */
export async function validatePath(
  pathId: string,
  payload: PathValidationPayload,
): Promise<LearningPath> {
  const { data } = await apiClient.post<LearningPath>(`/paths/${pathId}/validate`, payload)
  return data
}

// ─── API Inscriptions ─────────────────────────────────────────────────────────

/**
 * POST /paths/:id/enrollments
 * Inscrit l'élève courant à un parcours.
 */
export async function enrollInPath(
  pathId: string,
  payload: CreateEnrollmentPayload = {},
): Promise<PathEnrollment> {
  const { data } = await apiClient.post<PathEnrollment>(`/paths/${pathId}/enrollments`, payload)
  return data
}

/**
 * PATCH /path-enrollments/:id/progress
 * Met à jour la progression d'une inscription.
 */
export async function updateEnrollmentProgress(
  enrollmentId: string,
  payload: UpdateProgressPayload,
): Promise<PathEnrollment> {
  const { data } = await apiClient.patch<PathEnrollment>(
    `/path-enrollments/${enrollmentId}/progress`,
    payload,
  )
  return data
}
