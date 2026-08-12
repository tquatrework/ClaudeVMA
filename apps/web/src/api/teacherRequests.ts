/**
 * Module API — flow « demande de professeur » (teacher-request-service).
 * Toutes les requêtes passent par apiClient (base `/api/v1`).
 *
 * Les chemins ci-dessous sont ceux de `docs/routes.md` > teacher-request-service,
 * vérifiés contre la pile réelle le 2026-08-12. Le préfixe gateway canonique est
 * `/api/v1/teacher-requests` ; `/proposals` est proxifié séparément.
 *
 * Routes du modèle abandonné, **supprimées côté serveur** le 2026-08-12 et retirées ici :
 * - `POST /teacher-requests/:id/select` (le client choisissait le formateur) ;
 * - `POST /teacher-requests/:id/selected-candidates`.
 * `POST /teacher-collaborations/:id/stop-request` a également disparu : ce préfixe n'est
 * pas proxifié par la gateway et répondait `404` HTML.
 */

import apiClient from './client'
import type {
  CreateTeacherRequestPayload,
  PpChangeRequestPayload,
  SendTeacherProposalsPayload,
  TeacherProposal,
  TeacherProposalInboxItem,
  TeacherProposalStatus,
  TeacherRequest,
  TeacherRequestScope,
  UpdateTeacherRequestStatusPayload,
  ValidateTeacherRequestPayload,
} from '../types/teacherRequests'
import type {
  TeacherValidationStatus,
  UpdateTeacherValidationPayload,
} from '../types/profile'

// ─── Étape 1 — l'élève ou son parent crée la demande ───────────────────────────

/**
 * POST /teacher-requests — crée une demande. Un seul champ de saisie : `description`.
 */
export async function createTeacherRequest(
  payload: CreateTeacherRequestPayload,
): Promise<TeacherRequest> {
  const { data } = await apiClient.post<TeacherRequest>('/teacher-requests', payload)
  return data
}

// ─── Étapes 2, 4 et 8 — lire les demandes ou la boîte de réception ─────────────

/**
 * GET /teacher-requests — la forme dépend du **rôle**, jamais du contenu :
 * élève / parent / RP reçoivent des demandes (`fetchTeacherRequests`), le formateur
 * reçoit sa boîte de réception de propositions (`fetchTeacherProposalInbox`).
 *
 * `scope` vaut `open` par défaut côté serveur : les demandes traitées disparaissent
 * des listes ouvertes (étape 8).
 */
export async function fetchTeacherRequests(
  scope: TeacherRequestScope = 'open',
): Promise<TeacherRequest[]> {
  const { data } = await apiClient.get<TeacherRequest[]>('/teacher-requests', {
    params: { scope },
  })
  return data
}

/** GET /teacher-requests — même route, forme renvoyée au formateur destinataire. */
export async function fetchTeacherProposalInbox(
  scope: TeacherRequestScope = 'open',
): Promise<TeacherProposalInboxItem[]> {
  const { data } = await apiClient.get<TeacherProposalInboxItem[]>('/teacher-requests', {
    params: { scope },
  })
  return data
}

/** GET /teacher-requests/:id — détail d'une demande. */
export async function fetchTeacherRequest(requestId: string): Promise<TeacherRequest> {
  const { data } = await apiClient.get<TeacherRequest>(`/teacher-requests/${requestId}`)
  return data
}

// ─── Étape 3 — le RP propose la demande à plusieurs formateurs ─────────────────

/**
 * POST /teacher-requests/:requestId/proposals — envoi **groupé et atomique** à
 * plusieurs formateurs. Bascule la demande en `redirected`.
 */
export async function sendTeacherProposals(
  requestId: string,
  payload: SendTeacherProposalsPayload,
): Promise<TeacherProposal[]> {
  const { data } = await apiClient.post<TeacherProposal[]>(
    `/teacher-requests/${requestId}/proposals`,
    payload,
  )
  return data
}

// ─── Étape 5 — le RP lit les réponses ─────────────────────────────────────────

/** GET /teacher-requests/:requestId/proposals — qui a accepté, refusé, ou n'a rien dit. */
export async function fetchTeacherProposals(requestId: string): Promise<TeacherProposal[]> {
  const { data } = await apiClient.get<TeacherProposal[]>(
    `/teacher-requests/${requestId}/proposals`,
  )
  return data
}

// ─── Étape 4 — le formateur répond ────────────────────────────────────────────

/**
 * POST /proposals/:proposalId/accept — ou `/decline`.
 * `proposalId` est l'identifiant de la **proposition**, jamais celui de la demande.
 * Accepter n'enregistre qu'une candidature : aucune affectation n'est créée ici.
 */
export async function respondToTeacherProposal(
  proposalId: string,
  responseStatus: Extract<TeacherProposalStatus, 'accepted' | 'declined'>,
): Promise<TeacherProposalInboxItem> {
  const action = responseStatus === 'accepted' ? 'accept' : 'decline'
  const { data } = await apiClient.post<TeacherProposalInboxItem>(
    `/proposals/${proposalId}/${action}`,
    {},
  )
  return data
}

// ─── Étapes 5 et 6 — le RP tranche, le lien élève↔professeur est créé ──────────

/**
 * POST /teacher-requests/:id/validate — point de décision unique du RP.
 * Crée le lien élève↔formateur dans profile-service et clôture la demande.
 */
export async function validateTeacherRequest(
  requestId: string,
  payload: ValidateTeacherRequestPayload,
): Promise<TeacherRequest> {
  const { data } = await apiClient.post<TeacherRequest>(
    `/teacher-requests/${requestId}/validate`,
    payload,
  )
  return data
}

// ─── Actions RP hors flow nominal ─────────────────────────────────────────────

/** PATCH /teacher-requests/:id/status — RP uniquement (l'élève reçoit `403`). */
export async function updateTeacherRequestStatus(
  requestId: string,
  payload: UpdateTeacherRequestStatusPayload,
): Promise<TeacherRequest> {
  const { data } = await apiClient.patch<TeacherRequest>(
    `/teacher-requests/${requestId}/status`,
    payload,
  )
  return data
}

/** DELETE /teacher-requests/:id — RP uniquement (l'élève reçoit `403`). */
export async function deleteTeacherRequest(requestId: string): Promise<void> {
  await apiClient.delete(`/teacher-requests/${requestId}`)
}

/**
 * POST /teacher-requests/pp-change — changement de professeur principal,
 * parent financeur uniquement. Corps aligné sur `POST /teacher-requests`.
 */
export async function createPpChangeRequest(
  payload: PpChangeRequestPayload,
): Promise<TeacherRequest> {
  const { data } = await apiClient.post<TeacherRequest>('/teacher-requests/pp-change', payload)
  return data
}

// ─── Validation formateur (TeacherValidationPanel — profile-service) ──────────

/** GET /profiles/:teacherId/validation */
export async function fetchTeacherValidationStatus(
  teacherId: string,
): Promise<TeacherValidationStatus> {
  const { data } = await apiClient.get<TeacherValidationStatus>(`/profiles/${teacherId}/validation`)
  return data
}

/** PATCH /profiles/:teacherId/validation — prise en charge, validation, rejet. */
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
