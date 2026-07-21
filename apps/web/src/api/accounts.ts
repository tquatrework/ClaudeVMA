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
  Consent,
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
 * GET /consents — Mes consentements
 */
export async function fetchConsents(): Promise<Consent[]> {
  const { data } = await apiClient.get<Consent[]>('/consents')
  return data
}

/**
 * POST /consents — Signer un consentement
 */
export async function signConsent(consentType: ConsentType): Promise<void> {
  await apiClient.post('/consents', { consentType })
}
