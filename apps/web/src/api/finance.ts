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
 * GET /finance/finance-events
 *
 * Correction (bug de production) : la gateway nginx (`gateway/api-gateway/nginx.conf`) ne route
 * que `^~ /api/v1/finance/` (avec le slash) vers finance-credit-service ; l'appel précédent
 * omettait ce préfixe et renvoyait systématiquement un 404 avant même d'atteindre le backend.
 * Le contrôleur backend réel est `@Controller('finance-events')`, donc le chemin ci-dessous,
 * une fois préfixé par le gateway, atteint bien le contrôleur.
 */
export async function fetchFinanceEvents(): Promise<FinanceEvent[]> {
  const { data } = await apiClient.get<FinanceEvent[]>('/finance/finance-events')
  return Array.isArray(data) ? data : []
}

/**
 * PATCH /finance/financial-settings/rewards
 *
 * Correction (bug de production) : préfixe `/finance/` manquant (même cause que
 * `fetchFinanceEvents` ci-dessus — 404 garanti côté gateway). Contrôleur backend réel :
 * `@Controller('financial-settings')` + `@Patch('rewards')`, confirmé exact une fois préfixé.
 */
export async function updateRewardSettings(payload: UpdateRewardSettingsPayload): Promise<void> {
  await apiClient.patch('/finance/financial-settings/rewards', payload)
}

/**
 * GET /finance/teacher-payment-requests/by-teacher/:teacherId
 *
 * Correction (bug de production) : l'ancien appel `GET /teacher-payment-requests` (sans préfixe
 * `/finance/` ni paramètre) n'existe pas côté backend, même préfixé — le contrôleur
 * `teacher-payment-requests` n'expose aucune liste globale. Le seul endpoint de lecture réel est
 * `GET /teacher-payment-requests/by-teacher/:teacherId` (liste les demandes d'un formateur donné).
 * Décision produit : le front s'adapte à l'existant plutôt que d'appeler un endpoint inexistant.
 * Réservé au rôle formateur (consultation de ses propres demandes) ; il n'existe à ce jour aucun
 * endpoint de liste globale utilisable par l'administrateur financier.
 */
export async function fetchTeacherPaymentRequests(
  teacherId: string,
): Promise<TeacherPaymentRequest[]> {
  const { data } = await apiClient.get<TeacherPaymentRequest[]>(
    `/finance/teacher-payment-requests/by-teacher/${teacherId}`,
  )
  return Array.isArray(data) ? data : []
}

/**
 * POST /finance/teacher-payment-requests
 *
 * Correction (bug de production) : préfixe `/finance/` manquant (même cause que ci-dessus).
 * Contrôleur backend réel : `@Controller('teacher-payment-requests')` + `@Post()`, confirmé
 * exact une fois préfixé.
 */
export async function createTeacherPaymentRequest(
  payload: CreateTeacherPaymentRequestPayload,
): Promise<TeacherPaymentRequest> {
  const { data } = await apiClient.post<TeacherPaymentRequest>(
    '/finance/teacher-payment-requests',
    payload,
  )
  return data
}

/**
 * POST /finance/teacher-payment-requests/:id/validate
 *
 * Correction (bug de production) : préfixe `/finance/` manquant (même cause que ci-dessus).
 * Contrôleur backend réel : `@Post(':id/validate')`, confirmé exact une fois préfixé.
 */
export async function validateTeacherPaymentRequest(
  requestId: string,
): Promise<TeacherPaymentRequest> {
  const { data } = await apiClient.post<TeacherPaymentRequest>(
    `/finance/teacher-payment-requests/${requestId}/validate`,
  )
  return data
}
