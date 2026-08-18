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

/** Fréquence de récurrence d'un créneau de disponibilité. */
export type AvailabilityRecurrence = 'NONE' | 'WEEKLY' | 'BIWEEKLY'

/** Nature d'un créneau : disponibilité déclarée, ou indisponibilité (à exclure). */
export type AvailabilityKind = 'AVAILABLE' | 'UNAVAILABLE'

/**
 * Créneau de disponibilité/indisponibilité d'un calendrier, récurrent sur un jour de la
 * semaine (`dayOfWeek` = 0 dimanche … 6 samedi, alignée `Date.getDay()`).
 *
 * Source API : GET /calendars/:ownerId (lecture, bloc `availabilitySlots` — corrigé le
 * 2026-08-18, l'ancienne route `/calendars/:ownerId/availability` n'a jamais existé côté
 * calendar-service), POST/PATCH/DELETE /calendars/:ownerId/availability-slots[/:slotId]
 * (écriture).
 */
export interface AvailabilitySlot {
  id: string
  ownerId: string
  dayOfWeek: number
  startTime: string
  endTime: string
  recurrence: AvailabilityRecurrence
  recurrenceEndDate: string | null
  kind: AvailabilityKind
  createdAt?: string
  updatedAt?: string
}

/** Corps de `POST /calendars/:ownerId/availability-slots`. */
export interface CreateAvailabilitySlotPayload {
  dayOfWeek: number
  startTime: string
  endTime: string
  recurrence: AvailabilityRecurrence
  recurrenceEndDate?: string | null
  kind: AvailabilityKind
}

/** Corps de `PATCH /calendars/:ownerId/availability-slots/:slotId` — champs partiels. */
export type UpdateAvailabilitySlotPayload = Partial<CreateAvailabilitySlotPayload>
