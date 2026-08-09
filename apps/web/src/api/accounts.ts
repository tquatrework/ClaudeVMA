/**
 * Module API — comptes (identity-access-service)
 *
 * Gestion des comptes (statut, régénération d'accès), inscription élève/parent/formateur,
 * vérification de disponibilité d'un email, et consentements RGPD/CGU/marketing.
 * Toutes les requêtes passent par apiClient (base /api/v1).
 *
 * Écarts signalés (non documentés dans docs/routes.md, comportement runtime préservé
 * tel quel — voir rapport de migration du lot) :
 * - PATCH /accounts/:accountId/status
 * - POST /accounts/:accountId/access/regenerate
 */

import apiClient from './client'
import type {
  ChangeAccountStatusPayload,
  CheckEmailAvailabilityResult,
  ConsentEvent,
  ConsentState,
  ConsentType,
  RegenerateAccountAccessPayload,
  RegisterParentPayload,
  RegisterStudentPayload,
  RegisterTeacherPayload,
} from '../types/accounts'

// ─── Inscription ──────────────────────────────────────────────────────────────

/**
 * GET /accounts/check-email — Vérifier la disponibilité d'un email
 */
export async function checkEmailAvailability(email: string): Promise<CheckEmailAvailabilityResult> {
  const { data } = await apiClient.get<CheckEmailAvailabilityResult>(
    `/accounts/check-email?email=${encodeURIComponent(email)}`,
  )
  return data
}

/**
 * POST /accounts/parents — Créer un compte parent / financeur
 */
export async function registerParent(payload: RegisterParentPayload): Promise<void> {
  await apiClient.post('/accounts/parents', payload)
}

/**
 * POST /accounts/students — Créer un compte élève
 */
export async function registerStudent(payload: RegisterStudentPayload): Promise<void> {
  await apiClient.post('/accounts/students', payload)
}

/**
 * POST /accounts/teachers — Créer un compte formateur
 */
export async function registerTeacher(payload: RegisterTeacherPayload): Promise<void> {
  await apiClient.post('/accounts/teachers', payload)
}

// ─── Gestion des comptes ──────────────────────────────────────────────────────

/**
 * PATCH /accounts/:accountId/status — Changer le statut d'un compte
 *
 * Écart : cette route n'apparaît pas dans docs/routes.md, qui documente à la place
 * PUT /accounts/:accountId/validate et PUT /accounts/:accountId/suspend. Reproduite
 * ici à l'identique du comportement préexistant — non corrigée dans ce lot structurel.
 */
export async function changeAccountStatus(
  accountId: string,
  payload: ChangeAccountStatusPayload,
): Promise<void> {
  await apiClient.patch(`/accounts/${accountId}/status`, {
    status: payload.status,
    reason: payload.reason,
  })
}

/**
 * POST /accounts/:accountId/access/regenerate — Régénérer l'accès d'un compte
 *
 * Écart : cette route n'apparaît pas dans docs/routes.md. Reproduite ici à l'identique
 * du comportement préexistant — non corrigée dans ce lot structurel.
 */
export async function regenerateAccountAccess(
  accountId: string,
  payload: RegenerateAccountAccessPayload,
): Promise<void> {
  await apiClient.post(`/accounts/${accountId}/access/regenerate`, payload)
}

// ─── Consentements RGPD ────────────────────────────────────────────────────────

/**
 * GET /consents — État courant de mes consentements
 *
 * Renvoie toujours un élément par type reconnu (`rgpd`, `cgu`, `marketing`), y
 * compris ceux jamais donnés : l'appelant lit `status`, il ne déduit rien de
 * l'absence d'un élément.
 */
export async function fetchConsents(): Promise<ConsentState[]> {
  const { data } = await apiClient.get<ConsentState[]>('/consents')
  return data
}

/**
 * POST /consents — Donner (ou redonner) un consentement
 *
 * Sert aussi bien au premier octroi qu'à la ré-acceptation après un retrait :
 * le `409` du serveur porte sur l'état courant, pas sur l'existence d'une ligne.
 */
export async function grantConsent(consentType: ConsentType): Promise<void> {
  await apiClient.post('/consents', { consentType })
}

/**
 * POST /consents/:consentType/withdraw — Retirer un consentement optionnel
 *
 * `POST` et non `DELETE` : le retrait **ajoute** un événement au journal
 * append-only, il ne supprime aucune ressource. Sans corps de requête.
 *
 * Erreurs métier attendues : `400` type inconnu, `403` consentement obligatoire,
 * `404` jamais donné, `409` déjà retiré.
 */
export async function withdrawConsent(consentType: ConsentType): Promise<ConsentEvent> {
  const { data } = await apiClient.post<ConsentEvent>(`/consents/${consentType}/withdraw`)
  return data
}
