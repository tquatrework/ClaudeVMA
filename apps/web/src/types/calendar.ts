/**
 * Types partagés — Calendrier et événements
 * Source API : GET /calendars/:ownerId/events
 */

export interface CalendarEvent {
  id: string
  title?: string
  startAt: string
  endAt: string
  eventType?: string
  description?: string
  status?: string
  ownerId?: string
  invitations?: unknown[]
  reminderRules?: unknown[]
}

/**
 * Séance d'activité — forme utilisée par ActivitiesPage (liste) et ActivityDetailPage
 * (détail, édition, suppression).
 *
 * Source API : GET /calendar (liste, écart non documenté dans docs/routes.md — voir
 * src/api/calendar.ts), GET/PATCH/DELETE /calendar/:id.
 */
export interface ActivitySession {
  id: string
  title?: string
  startAt: string
  endAt: string
  type?: string
  status?: string
  studentId?: string
  teacherId?: string
  videoRoomId?: string
}

/**
 * Créneau de disponibilité d'un calendrier — soit récurrent (`dayOfWeek` + `startTime`/`endTime`),
 * soit ponctuel (`date`), soit un simple libellé (`label`).
 *
 * Source API : GET /calendars/:ownerId/availability. Utilisé par AvailabilityEditor.
 */
export interface AvailabilitySlot {
  id: string
  dayOfWeek?: string
  startTime?: string
  endTime?: string
  date?: string
  label?: string
}
