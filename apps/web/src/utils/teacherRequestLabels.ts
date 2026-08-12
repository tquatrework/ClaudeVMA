/**
 * Point unique de correspondance statut technique → libellé français et couleur,
 * pour le flow « demande de professeur ».
 *
 * Ces tables vivaient en **cinq** exemplaires (TeacherRequestPage, TeacherRequestsPage,
 * TeacherRequestDetailPage, RpTeacherSearchWorkspace, TeacherCandidatesView) avec deux
 * contenus différents : un statut connu d'un écran affichait un badge vide sur un autre.
 * Règle de langue du 2026-08-09 : noms techniques en anglais, libellés en français,
 * correspondance en un seul endroit — même modèle que `utils/archiveLabels.ts`.
 */

import type { TeacherProposalStatus, TeacherRequestStatus } from '../types/teacherRequests'

const FALLBACK_COLOR = 'bg-gray-100 text-gray-500'

export const TEACHER_REQUEST_STATUS_LABELS: Record<TeacherRequestStatus, string> = {
  pending: 'En attente',
  redirected: 'Proposée à des formateurs',
  closed: 'Professeur trouvé',
  cancelled: 'Annulée',
  declined: 'Refusée',
  // Valeurs héritées de modèles abandonnés, encore portées par des lignes en base.
  assigned: 'Affectée (ancien flow)',
  accepted: 'Acceptée (ancien flow)',
  candidates_published: 'Candidats publiés (ancien flow)',
  candidates_selected: 'Candidats sélectionnés (ancien flow)',
  candidate_chosen: 'Candidat choisi (ancien flow)',
}

export const TEACHER_REQUEST_STATUS_COLORS: Record<TeacherRequestStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  redirected: 'bg-blue-100 text-blue-700',
  closed: 'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-500',
  declined: 'bg-red-100 text-red-700',
  assigned: 'bg-gray-100 text-gray-600',
  accepted: 'bg-gray-100 text-gray-600',
  candidates_published: 'bg-gray-100 text-gray-600',
  candidates_selected: 'bg-gray-100 text-gray-600',
  candidate_chosen: 'bg-gray-100 text-gray-600',
}

export const TEACHER_PROPOSAL_STATUS_LABELS: Record<TeacherProposalStatus, string> = {
  pending: 'Sans réponse',
  accepted: 'A accepté',
  declined: 'A refusé',
  not_selected: 'Non retenu',
  expired: 'Sans réponse (demande clôturée)',
}

export const TEACHER_PROPOSAL_STATUS_COLORS: Record<TeacherProposalStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  accepted: 'bg-green-100 text-green-700',
  declined: 'bg-red-100 text-red-700',
  not_selected: 'bg-gray-100 text-gray-500',
  expired: 'bg-gray-100 text-gray-500',
}

export function getTeacherRequestStatusLabel(status: string): string {
  return TEACHER_REQUEST_STATUS_LABELS[status as TeacherRequestStatus] ?? status
}

export function getTeacherRequestStatusColor(status: string): string {
  return TEACHER_REQUEST_STATUS_COLORS[status as TeacherRequestStatus] ?? FALLBACK_COLOR
}

export function getTeacherProposalStatusLabel(status: string): string {
  return TEACHER_PROPOSAL_STATUS_LABELS[status as TeacherProposalStatus] ?? status
}

export function getTeacherProposalStatusColor(status: string): string {
  return TEACHER_PROPOSAL_STATUS_COLORS[status as TeacherProposalStatus] ?? FALLBACK_COLOR
}

/**
 * Libellé principal d'une demande à l'écran.
 *
 * Jamais « Demande #c4fcaae5 » : un UUID tronqué n'est pas un nom (arbitrage du
 * 2026-08-09). Le serveur résout `studentName` ; s'il manque, on le dit en français
 * plutôt que d'exposer l'identifiant technique.
 */
export function getTeacherRequestTitle(studentName: string | null | undefined): string {
  return studentName?.trim() ? studentName : 'Élève (nom non renseigné)'
}

/**
 * Libellé principal d'un formateur à l'écran, même règle que ci-dessus.
 */
export function getTeacherDisplayName(teacherName: string | null | undefined): string {
  return teacherName?.trim() ? teacherName : 'Formateur (nom non renseigné)'
}
