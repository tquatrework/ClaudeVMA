/**
 * Module API — orchestration-service (Phase 16)
 * Suivi des workflows transverses, commandes idempotentes et historique d'événements.
 * Toutes les requêtes passent par apiClient (base /api/v1/orchestration/).
 */

import apiClient from './client'

// ─── Types — Workflows ────────────────────────────────────────────────────────

export type WorkflowStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'needs_arbitration'

export type WorkflowType =
  | 'student-onboarding'
  | 'teacher-onboarding'
  | 'teacher-request-to-assignment'
  | 'scheduled-video-course'

export interface WorkflowDefinition {
  id: string
  name: string
  phase: number
  stepCount: number
}

export interface WorkflowStep {
  order: number
  service: string
  action: string
  status: WorkflowStatus
  startedAt?: string
  completedAt?: string
  errorMessage?: string
}

export interface WorkflowInstance {
  workflowInstanceId: string
  workflowType: WorkflowType
  correlationId: string
  status: WorkflowStatus
  startedAt: string
  completedAt?: string
  initiatedBy?: string
}

export interface WorkflowInstanceDetail {
  instance: WorkflowInstance
  steps: WorkflowStep[]
  status: WorkflowStatus
}

export interface StartWorkflowPayload {
  workflowType: WorkflowType
  payload: Record<string, unknown>
  initiatedBy?: string
  correlationId?: string
}

export interface StartWorkflowResponse {
  workflowInstanceId: string
  workflowType: WorkflowType
  correlationId: string
  status: WorkflowStatus
  startedAt: string
}

export interface SuspendWorkflowPayload {
  reason: string
}

export interface SuspendWorkflowResponse {
  workflowInstanceId: string
  status: 'needs_arbitration'
  reason: string
}

export interface ResumeWorkflowPayload {
  tiOverride?: boolean
}

export interface ResumeWorkflowResponse {
  workflowInstanceId: string
  status: 'in_progress'
  tiOverride?: boolean
}

// ─── Types — Commandes ────────────────────────────────────────────────────────

export interface DispatchCommandPayload {
  targetService: string
  action: string
  payload: Record<string, unknown>
  idempotencyKey: string
  correlationId?: string
}

// ─── Types — Événements ───────────────────────────────────────────────────────

export interface IntegrationEvent {
  id: string
  correlationId: string
  eventType: string
  sourceService?: string
  payload?: Record<string, unknown>
  occurredAt: string
}

export interface IntegrationEventHistory {
  correlationId: string
  count: number
  events: IntegrationEvent[]
}

// ─── API — Workflows ──────────────────────────────────────────────────────────

/**
 * GET /orchestration/workflows
 * Liste les types de workflows disponibles.
 */
export async function fetchWorkflowDefinitions(): Promise<WorkflowDefinition[]> {
  const { data } = await apiClient.get<WorkflowDefinition[]>('/orchestration/workflows')
  return data
}

/**
 * POST /orchestration/workflows/:workflowId/start
 * Déclenche un workflow transverse (ex : student-onboarding).
 */
export async function startWorkflow(
  workflowId: string,
  payload: StartWorkflowPayload,
): Promise<StartWorkflowResponse> {
  const { data } = await apiClient.post<StartWorkflowResponse>(
    `/orchestration/workflows/${workflowId}/start`,
    payload,
  )
  return data
}

/**
 * GET /orchestration/workflows/:workflowInstanceId
 * Lit l'état complet d'une instance de workflow.
 */
export async function fetchWorkflowInstance(
  workflowInstanceId: string,
): Promise<WorkflowInstanceDetail> {
  const { data } = await apiClient.get<WorkflowInstanceDetail>(
    `/orchestration/workflows/${workflowInstanceId}`,
  )
  return data
}

/**
 * POST /orchestration/workflows/:workflowInstanceId/suspend
 * Suspend un workflow en attente d'arbitrage utilisateur (ORCH-BR-006).
 */
export async function suspendWorkflow(
  workflowInstanceId: string,
  payload: SuspendWorkflowPayload,
): Promise<SuspendWorkflowResponse> {
  const { data } = await apiClient.post<SuspendWorkflowResponse>(
    `/orchestration/workflows/${workflowInstanceId}/suspend`,
    payload,
  )
  return data
}

/**
 * POST /orchestration/workflows/:workflowInstanceId/resume
 * Reprend un workflow après arbitrage ou forçage TI (ORCH-BR-006/007).
 */
export async function resumeWorkflow(
  workflowInstanceId: string,
  payload: ResumeWorkflowPayload = {},
): Promise<ResumeWorkflowResponse> {
  const { data } = await apiClient.post<ResumeWorkflowResponse>(
    `/orchestration/workflows/${workflowInstanceId}/resume`,
    payload,
  )
  return data
}

/**
 * Forme aplatie historiquement attendue par AgreementsPage pour une instance de
 * workflow en attente d'arbitrage utilisateur.
 *
 * Écart préexistant, non corrigé ici : `GET /orchestration/workflows/:workflowInstanceId`
 * est documenté (et consommé par `fetchWorkflowInstance` / WorkflowTimeline) sous la forme
 * imbriquée `{instance, steps, status}`, mais AgreementsPage lit directement
 * `workflowInstanceId`/`status`/`reason` à la racine de la réponse.
 */
export interface WorkflowArbitrationInstance {
  workflowInstanceId: string
  status: string
  reason?: string
}

/**
 * GET /orchestration/workflows/:workflowInstanceId
 * Même route que `fetchWorkflowInstance`, mais typée selon la forme aplatie
 * consommée par AgreementsPage (voir `WorkflowArbitrationInstance`).
 */
export async function fetchWorkflowArbitrationInstance(
  workflowInstanceId: string,
): Promise<WorkflowArbitrationInstance> {
  const { data } = await apiClient.get<WorkflowArbitrationInstance>(
    `/orchestration/workflows/${workflowInstanceId}`,
  )
  return data
}

// ─── API — Commandes ──────────────────────────────────────────────────────────

/**
 * POST /orchestration/commands
 * Émet une commande idempotente vers un microservice cible.
 */
export async function dispatchCommand(
  payload: DispatchCommandPayload,
): Promise<{ message: string }> {
  const { data } = await apiClient.post<{ message: string }>('/orchestration/commands', payload)
  return data
}

// ─── API — Événements ─────────────────────────────────────────────────────────

/**
 * GET /orchestration/events/:correlationId
 * Lit l'historique chronologique des événements pour un correlationId.
 */
export async function fetchEventHistory(
  correlationId: string,
): Promise<IntegrationEventHistory> {
  const { data } = await apiClient.get<IntegrationEventHistory>(
    `/orchestration/events/${correlationId}`,
  )
  return data
}
