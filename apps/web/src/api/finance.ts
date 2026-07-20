/**
 * Module API — finance-credit-service (Phase 9)
 * Profils financiers, paiements et archives financières.
 * Toutes les requêtes passent par apiClient (base /api/v1).
 */

import apiClient from './client'

// ─── Types ────────────────────────────────────────────────────────────────────

export type FinancialProfileType = 'limite' | 'membre'
export type PaymentMethod = 'cb' | 'virement' | 'paypal'
export type PaymentType = 'inscription' | 'abonnement' | 'versement_ponctuel'
export type FinancialArchiveItemType = 'payment' | 'invoice' | 'ledger_entry'

export interface FinancialProfile {
  id: string
  ownerId: string
  profileType: FinancialProfileType
  pointsBalance: number
  fundingEndDate?: string
  paymentMethod?: PaymentMethod
  paymentReference?: string
}

export interface UpdateFinancialProfilePayload {
  paymentMethod?: PaymentMethod
  paymentReference?: string
  fundingEndDate?: string
}

export interface PaymentPayload {
  paymentType: PaymentType
  amountCents: number
  externalReference?: string
  correlationId?: string
}

export interface PaymentResponse {
  payment: {
    id: string
    paymentType: PaymentType
    amountCents: number
    status: string
    createdAt: string
  }
  invoice: {
    id: string
    amountCents: number
    issuedAt: string
  }
}

export interface FinancialArchiveItem {
  id: string
  ownerId: string
  itemType: FinancialArchiveItemType
  referenceId: string
  label: string
  amountCents: number
  balanceSnapshot: number
  occurredAt: string
}

export interface FinanceEvent {
  id: string
  eventType: string
  payload?: Record<string, unknown>
  occurredAt: string
}

export interface RewardSettings {
  pointsPerEuro?: number
  bonusMultiplier?: number
}

export interface UpdateRewardSettingsPayload {
  pointsPerEuro: number
}

export type TeacherPaymentRequestStatus = 'pending' | 'validated' | 'rejected'

export interface TeacherPaymentRequest {
  id: string
  teacherId: string
  amountCents: number
  description: string
  invoiceReference?: string
  status: TeacherPaymentRequestStatus
  createdAt: string
}

export interface CreateTeacherPaymentRequestPayload {
  amountCents: number
  description: string
  invoiceReference?: string
}

// ─── API calls ────────────────────────────────────────────────────────────────

/**
 * GET /financial-profiles/:ownerId
 * Rôles autorisés : owner, AF, RP, TI
 */
export async function fetchFinancialProfile(ownerId: string): Promise<FinancialProfile> {
  const { data } = await apiClient.get<FinancialProfile>(`/finance/financial-profiles/${ownerId}`)
  return data
}

/**
 * PATCH /financial-profiles/:ownerId
 * Rôles autorisés : owner, AF, TI
 */
export async function updateFinancialProfile(
  ownerId: string,
  payload: UpdateFinancialProfilePayload,
): Promise<FinancialProfile> {
  const { data } = await apiClient.patch<FinancialProfile>(
    `/finance/financial-profiles/${ownerId}`,
    payload,
  )
  return data
}

/**
 * POST /payments
 * Initier un paiement (inscription, abonnement, versement ponctuel)
 */
export async function initiatePayment(payload: PaymentPayload): Promise<PaymentResponse> {
  const { data } = await apiClient.post<PaymentResponse>('/finance/payments', payload)
  return data
}

/**
 * GET /financial-archives/:ownerId
 * Rôles autorisés : owner, AF, RP, TI
 */
export async function fetchFinancialArchives(ownerId: string): Promise<FinancialArchiveItem[]> {
  const { data } = await apiClient.get<FinancialArchiveItem[]>(`/finance/financial-archives/${ownerId}`)
  return Array.isArray(data) ? data : []
}

/**
 * GET /finance-events
 *
 * ÉCART docs/routes.md : cette route n'est documentée pour aucun microservice
 * (ni sous /finance/, ni ailleurs). Comportement préexistant reproduit tel quel
 * (hors périmètre de ce lot — ne pas corriger sans arbitrage).
 */
export async function fetchFinanceEvents(): Promise<FinanceEvent[]> {
  const { data } = await apiClient.get<FinanceEvent[]>('/finance-events')
  return Array.isArray(data) ? data : []
}

/**
 * PATCH /financial-settings/rewards
 *
 * ÉCART docs/routes.md : la route documentée pour finance-credit-service est
 * `PATCH /finance/settings` (préfixe `/finance` + chemin `/settings`), pas
 * `/financial-settings/rewards`. Comportement préexistant reproduit tel quel
 * (hors périmètre de ce lot — ne pas corriger sans arbitrage).
 */
export async function updateRewardSettings(payload: UpdateRewardSettingsPayload): Promise<void> {
  await apiClient.patch('/financial-settings/rewards', payload)
}

/**
 * GET /teacher-payment-requests
 *
 * ÉCART docs/routes.md : la route documentée est `/finance/teacher-payment-requests`
 * (préfixe `/finance` manquant ici). Comportement préexistant reproduit tel quel
 * (hors périmètre de ce lot — ne pas corriger sans arbitrage).
 */
export async function fetchTeacherPaymentRequests(): Promise<TeacherPaymentRequest[]> {
  const { data } = await apiClient.get<TeacherPaymentRequest[]>('/teacher-payment-requests')
  return Array.isArray(data) ? data : []
}

/**
 * POST /teacher-payment-requests
 *
 * ÉCART docs/routes.md : même écart de préfixe que ci-dessus (`/finance` manquant).
 * Comportement préexistant reproduit tel quel (hors périmètre de ce lot).
 */
export async function createTeacherPaymentRequest(
  payload: CreateTeacherPaymentRequestPayload,
): Promise<TeacherPaymentRequest> {
  const { data } = await apiClient.post<TeacherPaymentRequest>('/teacher-payment-requests', payload)
  return data
}

/**
 * POST /teacher-payment-requests/:id/validate
 *
 * ÉCART docs/routes.md : la route documentée est `PATCH /finance/teacher-payment-requests/:id/status`
 * (verbe HTTP, chemin et préfixe différents). Comportement préexistant reproduit
 * tel quel (hors périmètre de ce lot — ne pas corriger sans arbitrage).
 */
export async function validateTeacherPaymentRequest(
  requestId: string,
): Promise<TeacherPaymentRequest> {
  const { data } = await apiClient.post<TeacherPaymentRequest>(
    `/teacher-payment-requests/${requestId}/validate`,
  )
  return data
}
