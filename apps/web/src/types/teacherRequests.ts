/**
 * Types partagés — Demandes professeur (teacher-request-service)
 * Partagés entre TeacherRequestPage, TeacherRequestsPage et TeacherRequestDetailPage.
 */

import type { TeacherCandidate } from '../components/teacher-requests/TeacherCandidatesView'

export type TeacherRequestStatus =
  | 'pending'
  | 'accepted'
  | 'declined'
  | 'cancelled'
  | 'candidates_selected'

/**
 * Forme résumée utilisée par les listes (TeacherRequestPage, TeacherRequestsPage).
 */
export interface TeacherRequestSummary {
  id: string
  status: TeacherRequestStatus
  createdAt: string
  description?: string
  studentId?: string
  studentName?: string
  /** Nombre de candidats formateur déjà proposés — utilisé par RpTeacherSearchWorkspace. */
  candidatesCount?: number
}

/**
 * Forme détaillée utilisée par TeacherRequestDetailPage — `status` reste `string` (plutôt
 * que `TeacherRequestStatus`) pour reproduire le typage large préexistant de cette page.
 */
export interface TeacherRequestDetail {
  id: string
  status: string
  createdAt: string
  description?: string
  studentId?: string
  teacherId?: string
  collaborationId?: string
  candidates?: TeacherCandidate[]
}

export interface CreateTeacherRequestPayload {
  description: string
  studentId?: string
}

export interface UpdateTeacherRequestStatusPayload {
  status: string
}

/**
 * Payload de ChangePrincipalTeacherDialog — POST /teacher-requests/pp-change (écart :
 * route non documentée dans docs/routes.md, comportement runtime préservé).
 */
export interface PpChangeRequestPayload {
  studentId: string
  currentTeacherId?: string
  requestedTeacherId?: string
  reason?: string
}

export interface PpChangeResponse {
  id: string
  status: string
  createdAt: string
}

/**
 * Payload/réponse de SpecificTeacherRequestForm — POST /teacher-requests (variante
 * sujet/niveau/filière, distincte de CreateTeacherRequestPayload).
 */
export interface SpecificTeacherRequestPayload {
  subject: string
  level: string
  sector: string
  message?: string
  studentId?: string
}

export interface SpecificTeacherRequestCreated {
  id: string
  status: string
  createdAt: string
  subject: string
  level: string
  sector: string
  message?: string
  studentId?: string
}

/**
 * Payload de StopCollaborationRequestForm — POST /teacher-collaborations/:id/stop-request
 * (écart : route non documentée dans docs/routes.md, comportement runtime préservé).
 */
export interface StopCollaborationPayload {
  reason?: string
  noticePeriodDays?: number
}

/**
 * Forme utilisée par TeacherRequestInbox — `status` reste `string` (comme
 * TeacherRequestDetail) pour reproduire le typage large préexistant du composant.
 */
export interface TeacherRequestInboxItem {
  id: string
  status: string
  createdAt: string
  description?: string
  studentId?: string
  candidateId?: string
}
