/**
 * Module API — admin-observability-service (Phase 15)
 * Logs d'activité, logs techniques, overrides de visibilité, métadonnées site et health.
 * Toutes les requêtes passent par apiClient (base /api/v1).
 */

import apiClient from './client'

// ─── Types — Logs d'activité ──────────────────────────────────────────────────

export interface ActivityLogEntry {
  id: string
  userId?: string
  userEmail?: string
  userRole?: string
  action: string
  targetResource?: string
  targetId?: string
  metadata?: Record<string, unknown>
  ipAddress?: string
  occurredAt: string
}

export interface ActivityLogFilters {
  userId?: string
  action?: string
  from?: string
  to?: string
  page?: number
  pageSize?: number
}

// ─── Types — Logs techniques ─────────────────────────────────────────────────

export type TechnicalLogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal'

export interface TechnicalLogEntry {
  id: string
  level: TechnicalLogLevel
  service?: string
  message: string
  traceId?: string
  stackTrace?: string
  metadata?: Record<string, unknown>
  occurredAt: string
}

export interface TechnicalLogFilters {
  level?: TechnicalLogLevel
  service?: string
  from?: string
  to?: string
  page?: number
  pageSize?: number
}

// ─── Types — Overrides de visibilité ─────────────────────────────────────────

export type VisibilityOverrideTarget = 'account' | 'profile' | 'content'

export interface VisibilityOverride {
  id: string
  targetType: VisibilityOverrideTarget
  targetId: string
  reason: string
  createdBy: string
  expiresAt?: string
  createdAt: string
}

export interface CreateVisibilityOverridePayload {
  targetType: VisibilityOverrideTarget
  targetId: string
  reason: string
  expiresAt?: string
}

// ─── Types — Santé des services ───────────────────────────────────────────────

export type ServiceHealthStatus = 'healthy' | 'degraded' | 'down' | 'unknown'

export interface ServiceHealthInfo {
  service: string
  status: ServiceHealthStatus
  responseTimeMs?: number
  lastCheckedAt: string
  details?: Record<string, unknown>
}

export interface HealthStatusReport {
  overallStatus: ServiceHealthStatus
  services: ServiceHealthInfo[]
  checkedAt: string
}

// ─── Types — Métadonnées du site ──────────────────────────────────────────────

export interface SiteMetadata {
  id: string
  siteName?: string
  maintenanceMessage?: string
  isMaintenanceMode?: boolean
  contactEmail?: string
  supportUrl?: string
  announcementBanner?: string
  updatedAt: string
  updatedBy?: string
}

export interface UpdateSiteMetadataPayload {
  siteName?: string
  maintenanceMessage?: string
  isMaintenanceMode?: boolean
  contactEmail?: string
  supportUrl?: string
  announcementBanner?: string
}

// ─── Types — Pagination ───────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[]
  meta: {
    total: number
    page: number
    pageSize: number
  }
}

// ─── API Logs d'activité ──────────────────────────────────────────────────────

/**
 * GET /admin/activity-log
 * Liste les logs d'activité utilisateur (TI, RP, AF).
 */
export async function fetchActivityLog(
  filters?: ActivityLogFilters,
): Promise<ActivityLogEntry[]> {
  const { data } = await apiClient.get<ActivityLogEntry[] | PaginatedResponse<ActivityLogEntry>>(
    '/admin/activity-log',
    { params: filters },
  )
  if (Array.isArray(data)) return data
  return (data as PaginatedResponse<ActivityLogEntry>).data ?? []
}

// ─── API Logs techniques ──────────────────────────────────────────────────────

/**
 * GET /admin/technical-logs
 * Liste les logs techniques des services (TI uniquement).
 */
export async function fetchTechnicalLogs(
  filters?: TechnicalLogFilters,
): Promise<TechnicalLogEntry[]> {
  const { data } = await apiClient.get<TechnicalLogEntry[] | PaginatedResponse<TechnicalLogEntry>>(
    '/admin/technical-logs',
    { params: filters },
  )
  if (Array.isArray(data)) return data
  return (data as PaginatedResponse<TechnicalLogEntry>).data ?? []
}

// ─── API Overrides de visibilité ──────────────────────────────────────────────

/**
 * POST /admin/visibility-overrides
 * Crée un masquage temporaire d'une ressource sans suppression de données (TI).
 */
export async function createVisibilityOverride(
  payload: CreateVisibilityOverridePayload,
): Promise<VisibilityOverride> {
  const { data } = await apiClient.post<VisibilityOverride>(
    '/admin/visibility-overrides',
    payload,
  )
  return data
}

/**
 * DELETE /admin/visibility-overrides/:id
 * Supprime un override de visibilité (TI).
 */
export async function deleteVisibilityOverride(overrideId: string): Promise<void> {
  await apiClient.delete(`/admin/visibility-overrides/${overrideId}`)
}

// ─── API Santé des services ───────────────────────────────────────────────────

/**
 * GET /admin/health
 * Rapport de santé agrégé de tous les microservices (TI).
 */
export async function fetchHealthStatus(): Promise<HealthStatusReport> {
  const { data } = await apiClient.get<HealthStatusReport>('/admin/health')
  return data
}

// ─── API Métadonnées du site ──────────────────────────────────────────────────

/**
 * PATCH /admin/site-metadata/:id
 * Met à jour les métadonnées du site (TI).
 */
export async function updateSiteMetadata(
  metadataId: string,
  payload: UpdateSiteMetadataPayload,
): Promise<SiteMetadata> {
  const { data } = await apiClient.patch<SiteMetadata>(
    `/admin/site-metadata/${metadataId}`,
    payload,
  )
  return data
}
