/**
 * Module API — community-path-service (Phase 14)
 * Parcours, inscriptions, progression et certificats.
 * Toutes les requêtes passent par apiClient (base /api/v1).
 *
 * Les Forums (même microservice) vivent désormais dans `src/api/forums.ts`, extrait le 2026-09-04
 * lors de la refonte du contrat Forums — deux surfaces indépendantes, chacune son fichier, même
 * principe que `tutorials.ts`/`exercises.ts` plutôt qu'un `contentCatalog.ts` fourre-tout.
 */

import apiClient from './client'

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
