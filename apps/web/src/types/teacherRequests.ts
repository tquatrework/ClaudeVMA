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
