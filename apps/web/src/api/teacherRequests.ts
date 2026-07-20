/**
 * Module API — demandes professeur (teacher-request-service)
 * Toutes les requêtes passent par apiClient (base /api/v1).
 *
 * Écart signalé (non documenté dans docs/routes.md, comportement runtime préservé
 * tel quel — voir rapport de migration du lot) :
 * - GET/PATCH /profiles/:teacherId/validation (utilisé par TeacherValidationPanel ;
 *   seul `POST /profiles/:teacherId/ap-status` est documenté pour profile-service).
 */

import apiClient from './client'
import type {
  CreateTeacherRequestPayload,
  TeacherRequestDetail,
  TeacherRequestSummary,
  UpdateTeacherRequestStatusPayload,
} from '../types/teacherRequests'
import type {
  TeacherValidationStatus,
  UpdateTeacherValidationPayload,
} from '../types/profile'

// ─── Demandes professeur ────────────────────────────────────────────────────────

/**
 * GET /teacher-requests
 * Retourne la forme brute de la réponse : certains appelants reçoivent un tableau,
 * d'autres une enveloppe `{ data: [...] }` — la normalisation reste à la charge du
 * hook appelant, qui reproduit le comportement historique propre à chaque page.
 */
export async function fetchTeacherRequests(): Promise<
  TeacherRequestSummary[] | { data: TeacherRequestSummary[] }
> {
  const { data } = await apiClient.get<TeacherRequestSummary[] | { data: TeacherRequestSummary[] }>(
    '/teacher-requests',
  )
  return data
}

/**
 * POST /teacher-requests
 * Crée une demande professeur.
 */
export async function createTeacherRequest(
  payload: CreateTeacherRequestPayload,
): Promise<TeacherRequestSummary> {
  const { data } = await apiClient.post<TeacherRequestSummary>('/teacher-requests', payload)
  return data
}

/**
 * GET /teacher-requests/:id
 * Lit le détail d'une demande professeur.
 */
export async function fetchTeacherRequest(requestId: string): Promise<TeacherRequestDetail> {
  const { data } = await apiClient.get<TeacherRequestDetail>(`/teacher-requests/${requestId}`)
  return data
}

/**
 * PATCH /teacher-requests/:id/status
 * Change le statut d'une demande (actions RP, annulation client).
 */
export async function updateTeacherRequestStatus(
  requestId: string,
  payload: UpdateTeacherRequestStatusPayload,
): Promise<TeacherRequestDetail> {
  const { data } = await apiClient.patch<TeacherRequestDetail>(
    `/teacher-requests/${requestId}/status`,
    payload,
  )
  return data
}

/**
 * DELETE /teacher-requests/:id
 * Supprime définitivement une demande professeur.
 */
export async function deleteTeacherRequest(requestId: string): Promise<void> {
  await apiClient.delete(`/teacher-requests/${requestId}`)
}

/**
 * GET /requests — Compter les demandes en attente pour RpDashboardPage.
 *
 * Écart signalé (non documenté dans docs/routes.md, comportement runtime préservé tel quel) :
 * RpDashboardPage appelle historiquement `/requests`, alors que le reste de ce module
 * (fetchTeacherRequests ci-dessus) appelle `/teacher-requests`. Reproduit à l'identique —
 * non corrigé dans ce lot structurel.
 */
export async function fetchTeacherRequestsForDashboard(): Promise<
  TeacherRequestSummary[] | { data: TeacherRequestSummary[] }
> {
  const { data } = await apiClient.get<TeacherRequestSummary[] | { data: TeacherRequestSummary[] }>(
    '/requests',
  )
  return data
}

// ─── Validation formateur (TeacherValidationPanel) ──────────────────────────────

/**
 * GET /profiles/:teacherId/validation
 */
export async function fetchTeacherValidationStatus(
  teacherId: string,
): Promise<TeacherValidationStatus> {
  const { data } = await apiClient.get<TeacherValidationStatus>(`/profiles/${teacherId}/validation`)
  return data
}

/**
 * PATCH /profiles/:teacherId/validation
 * Transition de statut (prise en charge, validation, rejet).
 */
export async function updateTeacherValidationStatus(
  teacherId: string,
  payload: UpdateTeacherValidationPayload,
): Promise<TeacherValidationStatus> {
  const { data } = await apiClient.patch<TeacherValidationStatus>(
    `/profiles/${teacherId}/validation`,
    payload,
  )
  return data
}
