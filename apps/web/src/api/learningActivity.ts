/**
 * Module API — learning-activity-service (Phase 13)
 * Activités non pourvues, acceptation par les formateurs, export global.
 * Toutes les requêtes passent par apiClient (base /api/v1).
 */

import apiClient from './client'

// ─── Types ────────────────────────────────────────────────────────────────────

export type OpenActivityStatus = 'open' | 'partially_filled' | 'filled' | 'cancelled'

export type ActivityStatus = 'scheduled' | 'ongoing' | 'completed' | 'cancelled'

export interface OpenActivity {
  id: string
  title: string
  description: string
  subject: string
  level: string
  requiredSlots: number
  filledSlots: number
  status: OpenActivityStatus
  publishedBy: string
  publishedAt: string
  deadline?: string
}

export interface CreateOpenActivityPayload {
  title: string
  description: string
  subject: string
  level: string
  requiredSlots: number
  deadline?: string
}

export interface UpdateOpenActivityPayload {
  title?: string
  description?: string
  deadline?: string
  status?: OpenActivityStatus
}

export interface AcceptOpenActivityPayload {
  teacherId?: string
  message?: string
}

export interface AcceptOpenActivityResponse {
  id: string
  openActivityId: string
  teacherId: string
  acceptedAt: string
  calendarEventId?: string
}

export interface Activity {
  id: string
  title?: string
  subject?: string
  level?: string
  startAt: string
  endAt: string
  status: ActivityStatus
  studentId?: string
  teacherId?: string
  videoRoomId?: string
  type?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  meta: {
    total: number
    page: number
    pageSize: number
  }
}

// ─── API Activités non pourvues ───────────────────────────────────────────────

/**
 * GET /open-activities
 * Liste les activités non pourvues (formateurs, RP, AP).
 */
export async function fetchOpenActivities(params?: {
  status?: OpenActivityStatus
  subject?: string
  level?: string
}): Promise<OpenActivity[]> {
  const { data } = await apiClient.get<OpenActivity[] | PaginatedResponse<OpenActivity>>(
    '/open-activities',
    { params },
  )
  if (Array.isArray(data)) return data
  return (data as PaginatedResponse<OpenActivity>).data ?? []
}

/**
 * POST /open-activities
 * Publie une activité non pourvue (RP uniquement).
 */
export async function createOpenActivity(
  payload: CreateOpenActivityPayload,
): Promise<OpenActivity> {
  const { data } = await apiClient.post<OpenActivity>('/open-activities', payload)
  return data
}

/**
 * GET /open-activities/:id
 * Détail d'une activité non pourvue.
 */
export async function fetchOpenActivity(activityId: string): Promise<OpenActivity> {
  const { data } = await apiClient.get<OpenActivity>(`/open-activities/${activityId}`)
  return data
}

/**
 * POST /open-activities/:id/accept
 * Le formateur accepte une activité non pourvue.
 */
export async function acceptOpenActivity(
  activityId: string,
  payload: AcceptOpenActivityPayload = {},
): Promise<AcceptOpenActivityResponse> {
  const { data } = await apiClient.post<AcceptOpenActivityResponse>(
    `/open-activities/${activityId}/accept`,
    payload,
  )
  return data
}

/**
 * PATCH /open-activities/:id
 * Modifie une activité non pourvue (RP, AP).
 */
export async function updateOpenActivity(
  activityId: string,
  payload: UpdateOpenActivityPayload,
): Promise<OpenActivity> {
  const { data } = await apiClient.patch<OpenActivity>(
    `/open-activities/${activityId}`,
    payload,
  )
  return data
}

// ─── API Activités globales ───────────────────────────────────────────────────

/**
 * GET /activities
 * Liste toutes les activités (RP, AP, TI, AF pour export).
 */
export async function fetchActivities(params?: {
  status?: ActivityStatus
  teacherId?: string
  studentId?: string
  from?: string
  to?: string
}): Promise<Activity[]> {
  const { data } = await apiClient.get<Activity[] | PaginatedResponse<Activity>>('/activities', {
    params,
  })
  if (Array.isArray(data)) return data
  return (data as PaginatedResponse<Activity>).data ?? []
}
