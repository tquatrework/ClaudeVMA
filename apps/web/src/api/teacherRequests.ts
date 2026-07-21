/**
 * Module API — demandes professeur (teacher-request-service)
 * Toutes les requêtes passent par apiClient (base /api/v1).
 *
 * Écarts signalés (non documentés dans docs/routes.md, comportements runtime préservés
 * tel quels — voir rapport de migration du lot) :
 * - GET/PATCH /profiles/:teacherId/validation (utilisé par TeacherValidationPanel ;
 *   seul `POST /profiles/:teacherId/ap-status` est documenté pour profile-service).
 * - POST /teacher-requests/pp-change (ChangePrincipalTeacherDialog).
 * - POST /teacher-collaborations/:id/stop-request (StopCollaborationRequestForm) —
 *   `teacher-collaborations` n'apparaît nulle part dans docs/routes.md.
 * - POST /teacher-requests/:id/proposals, POST /proposals/:id/accept|decline,
 *   POST /teacher-requests/:id/select (TeacherCandidatesView, TeacherRequestInbox) —
 *   seules les routes `/requests` (CRUD de base) sont documentées pour
 *   teacher-request-service ; candidats/propositions/sélection en sont absents.
 */

import apiClient from './client'
import type { TeacherCandidate } from '../components/teacher-requests/TeacherCandidatesView'
import type {
  CreateTeacherRequestPayload,
  PpChangeRequestPayload,
  PpChangeResponse,
  SpecificTeacherRequestCreated,
  SpecificTeacherRequestPayload,
  StopCollaborationPayload,
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

// ─── Changement de professeur principal (ChangePrincipalTeacherDialog) ─────────

/**
 * POST /teacher-requests/pp-change
 */
export async function createPpChangeRequest(
  payload: PpChangeRequestPayload,
): Promise<PpChangeResponse> {
  const { data } = await apiClient.post<PpChangeResponse>('/teacher-requests/pp-change', payload)
  return data
}

// ─── Demande professeur spécifique (SpecificTeacherRequestForm) ────────────────

/**
 * POST /teacher-requests
 * Variante « sujet/niveau/filière » de SpecificTeacherRequestForm — même route que
 * createTeacherRequest ci-dessus, mais payload/réponse de forme différente.
 */
export async function createSpecificTeacherRequest(
  payload: SpecificTeacherRequestPayload,
): Promise<SpecificTeacherRequestCreated> {
  const { data } = await apiClient.post<SpecificTeacherRequestCreated>('/teacher-requests', payload)
  return data
}

// ─── Arrêt de collaboration (StopCollaborationRequestForm) ─────────────────────

/**
 * POST /teacher-collaborations/:id/stop-request
 */
export async function requestCollaborationStop(
  collaborationId: string,
  payload: StopCollaborationPayload,
): Promise<void> {
  await apiClient.post(`/teacher-collaborations/${collaborationId}/stop-request`, payload)
}

// ─── Candidats / propositions (TeacherCandidatesView, TeacherRequestInbox) ─────

/**
 * POST /teacher-requests/:id/proposals
 * Ajoute un candidat formateur à une demande (RP). Retourne `data.candidates` tel
 * quel (potentiellement `undefined`) — l'appelant reproduit le fallback historique
 * `data.candidates ?? candidates`.
 */
export async function addTeacherCandidate(
  requestId: string,
  teacherId: string,
): Promise<TeacherCandidate[] | undefined> {
  const { data } = await apiClient.post<{ candidates: TeacherCandidate[] }>(
    `/teacher-requests/${requestId}/proposals`,
    { teacherId },
  )
  return data.candidates
}

/**
 * POST /proposals/:id/accept ou POST /proposals/:id/decline
 * Réponse du formateur à une proposition, ou réponse d'inbox — même route sous-jacente.
 */
export async function respondToTeacherProposal(
  proposalId: string,
  responseStatus: 'accepted' | 'declined',
): Promise<void> {
  const action = responseStatus === 'accepted' ? 'accept' : 'decline'
  await apiClient.post(`/proposals/${proposalId}/${action}`, {})
}

/**
 * POST /teacher-requests/:id/select
 * Sélection d'un candidat par le client (élève/parent) — clôture la demande.
 */
export async function selectTeacherCandidate(
  requestId: string,
  proposalId: string,
): Promise<string> {
  const { data } = await apiClient.post<{ status: string }>(`/teacher-requests/${requestId}/select`, {
    proposalId,
  })
  return data.status
}
