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
