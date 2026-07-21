/**
 * Module API — calendar-service
 * Toutes les requêtes passent par apiClient (base /api/v1).
 *
 * Écarts signalés (non documentés dans docs/routes.md — comportement runtime préservé
 * tel quel, ne pas corriger ici) :
 * - `fetchActivitySessions` / `fetchActivity` / `updateActivity` / `deleteActivity` appellent
 *   `/calendar` et `/calendar/:id`, qui n'apparaissent dans aucune section de docs/routes.md
 *   (seule `/calendars/:ownerId/events` y est documentée pour calendar-service). Route
 *   utilisée par ActivitiesPage et ActivityDetailPage avant cette migration ; reproduite à
 *   l'identique.
 */

import apiClient from './client'
import type {
  CalendarEvent as OwnerCalendarEvent,
  EventType,
  ReminderDelay,
} from '../components/calendar/calendarTypes'
import type { CalendarEvent, ActivitySession, AvailabilitySlot } from '../types/calendar'

// ─── Calendrier (CalendarPage) ─────────────────────────────────────────────────

export interface FetchOwnerEventsParams {
  type?: string
  personId?: string
}

/**
 * GET /calendars/:ownerId/events — Lister les événements autorisés (vue calendrier complète,
 * avec filtres type/personId). Utilisé par CalendarPage.
 */
export async function fetchOwnerEvents(
  ownerId: string,
  params: FetchOwnerEventsParams = {},
): Promise<OwnerCalendarEvent[]> {
  const queryParams = new URLSearchParams()
  if (params.type) queryParams.set('type', params.type)
  if (params.personId) queryParams.set('personId', params.personId)
  const queryString = queryParams.toString()

  const { data } = await apiClient.get<OwnerCalendarEvent[]>(
    `/calendars/${ownerId}/events${queryString ? `?${queryString}` : ''}`,
  )
  return Array.isArray(data) ? data : []
}

// ─── Calendrier (dashboards) ────────────────────────────────────────────────────

/**
 * GET /calendars/:userId/events — Lit les événements d'un utilisateur pour les besoins des
 * tableaux de bord (prochain cours, cours à venir). Utilisé par EleveDashboardPage,
 * ProfesseurDashboardPage et ParentDashboardPage (une fois par élève lié).
 */
export async function fetchUserEvents(userId: string): Promise<CalendarEvent[]> {
  const { data } = await apiClient.get<CalendarEvent[]>(`/calendars/${userId}/events`)
  return Array.isArray(data) ? data : []
}

// ─── Activités (ActivitiesPage / ActivityDetailPage) ───────────────────────────

export interface FetchActivitySessionsParams {
  teacherId?: string
  studentId?: string
}

/**
 * GET /calendar — Liste des séances d'activité, filtrée par rôle via query param.
 * Utilisé par ActivitiesPage.
 */
export async function fetchActivitySessions(
  params: FetchActivitySessionsParams = {},
): Promise<ActivitySession[]> {
  const queryParam = params.teacherId
    ? `teacherId=${params.teacherId}`
    : params.studentId
      ? `studentId=${params.studentId}`
      : ''

  const { data } = await apiClient.get<ActivitySession[]>(
    `/calendar${queryParam ? `?${queryParam}` : ''}`,
  )
  return Array.isArray(data) ? data : []
}

/**
 * GET /calendar/:id — Détail d'une séance d'activité. Utilisé par ActivityDetailPage.
 */
export async function fetchActivity(activityId: string): Promise<ActivitySession> {
  const { data } = await apiClient.get<ActivitySession>(`/calendar/${activityId}`)
  return data
}

export interface UpdateActivityPayload {
  title?: string
  status?: string
}

/**
 * PATCH /calendar/:id — Modifie une séance d'activité (titre, statut).
 */
export async function updateActivity(
  activityId: string,
  payload: UpdateActivityPayload,
): Promise<ActivitySession> {
  const { data } = await apiClient.patch<ActivitySession>(`/calendar/${activityId}`, payload)
  return data
}

/**
 * DELETE /calendar/:id — Supprime une séance d'activité.
 */
export async function deleteActivity(activityId: string): Promise<void> {
  await apiClient.delete(`/calendar/${activityId}`)
}

// ─── Disponibilités (AvailabilityEditor) ───────────────────────────────────────

/**
 * GET /calendars/:ownerId/availability — Lit les créneaux de disponibilité d'un calendrier.
 * Utilisé par AvailabilityEditor.
 */
export async function fetchAvailability(ownerId: string): Promise<AvailabilitySlot[]> {
  const { data } = await apiClient.get<AvailabilitySlot[]>(`/calendars/${ownerId}/availability`)
  return Array.isArray(data) ? data : []
}

// ─── Création d'événement (EventCreateDialog) ──────────────────────────────────

export interface CreateOwnerEventPayload {
  title?: string
  startAt: string
  endAt: string
  eventType: EventType
  description?: string
  inviteeIds?: string[]
}

/**
 * POST /calendars/:ownerId/events — Crée un événement selon les droits du rôle courant.
 * Utilisé par EventCreateDialog.
 */
export async function createOwnerEvent(
  ownerId: string,
  payload: CreateOwnerEventPayload,
): Promise<OwnerCalendarEvent> {
  const { data } = await apiClient.post<OwnerCalendarEvent>(
    `/calendars/${ownerId}/events`,
    payload,
  )
  return data
}

// ─── Invitations (InvitationBanner) ─────────────────────────────────────────────

/**
 * POST /events/:id/invitees/:userId/accept — Accepte une invitation. Utilisé par
 * InvitationBanner.
 */
export async function acceptEventInvitation(eventId: string, userId: string): Promise<void> {
  await apiClient.post(`/events/${eventId}/invitees/${userId}/accept`)
}

/**
 * POST /events/:id/invitees/:userId/decline — Refuse une invitation (retire l'invité).
 * Utilisé par InvitationBanner.
 */
export async function declineEventInvitation(eventId: string, userId: string): Promise<void> {
  await apiClient.post(`/events/${eventId}/invitees/${userId}/decline`)
}

// ─── Annulation (CancellationRequestDialog) ─────────────────────────────────────

export interface RequestCancellationPayload {
  reason?: string
}

export interface RequestCancellationResult {
  status?: string
}

/**
 * POST /events/:id/cancel-request — Demande ou applique une annulation (immédiate si ≥48h
 * avant l'événement, sinon `status: pending_approval` si <48h). Utilisé par
 * CancellationRequestDialog.
 */
export async function requestEventCancellation(
  eventId: string,
  payload: RequestCancellationPayload,
): Promise<RequestCancellationResult> {
  const { data } = await apiClient.post<RequestCancellationResult>(
    `/events/${eventId}/cancel-request`,
    payload,
  )
  return data
}

// ─── Rappels (ReminderSettingsPanel) ────────────────────────────────────────────

/**
 * POST /events/:id/reminders — Configure le délai de rappel d'un événement. Utilisé par
 * ReminderSettingsPanel.
 */
export async function setEventReminder(eventId: string, delay: ReminderDelay): Promise<void> {
  await apiClient.post(`/events/${eventId}/reminders`, { delay })
}
