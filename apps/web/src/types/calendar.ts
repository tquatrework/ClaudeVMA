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
 * Fréquence de récurrence d'un créneau de disponibilité — représentation **front** (grille,
 * formulaire). Distincte de la valeur réelle envoyée au serveur, voir `AvailabilityRecurrenceApi`
 * ci-dessous et `src/utils/availabilitySlotApiMapping.ts`.
 */
export type AvailabilityRecurrence = 'NONE' | 'WEEKLY' | 'BIWEEKLY'

/**
 * Nature d'un créneau : disponibilité déclarée, ou indisponibilité (à exclure) — représentation
 * **front**. Distincte de la valeur réelle envoyée au serveur, voir `AvailabilityKindApi`
 * ci-dessous.
 */
export type AvailabilityKind = 'AVAILABLE' | 'UNAVAILABLE'

/**
 * Créneau de disponibilité/indisponibilité d'un calendrier, récurrent sur un jour de la
 * semaine (`dayOfWeek` = 0 dimanche … 6 samedi, alignée `Date.getDay()`).
 *
 * **Représentation front** : `startTime`/`endTime` en `HH:mm`, `kind`/`recurrence` en
 * majuscules — c'est la forme consommée par `AvailabilityGrid` et `AvailabilitySlotFormModal`.
 * Elle diffère du contrat réel de calendar-service (voir `AvailabilitySlotApi` ci-dessous,
 * vérifié contre la pile réelle le 2026-08-18) ; la traduction entre les deux a lieu exclusivement
 * dans `src/api/calendar.ts`, via `src/utils/availabilitySlotApiMapping.ts`.
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

/** Corps front de création d'un créneau — voir `AvailabilitySlot` pour la représentation. */
export interface CreateAvailabilitySlotPayload {
  dayOfWeek: number
  startTime: string
  endTime: string
  recurrence: AvailabilityRecurrence
  recurrenceEndDate?: string | null
  kind: AvailabilityKind
}

/** Corps front de modification d'un créneau — champs partiels. */
export type UpdateAvailabilitySlotPayload = Partial<CreateAvailabilitySlotPayload>

// ─── Contrat réel de calendar-service ("Api") ──────────────────────────────────
//
// Vérifié par appel HTTP réel contre https://claudevma.visioprof.fr le 2026-08-18 (bug remonté
// par front-tester, `.claude/reports/front-tester-2026-08-18.md`) :
// - `kind`/`recurrence` sont exigés en minuscules (`400` explicite sinon) ;
// - `startTime`/`endTime` sont exigés en date ISO 8601 **complète**
//   (ex. `"2026-08-24T10:00:00.000Z"`), jamais une heure seule (`"10:00"` → `400` explicite,
//   « startTime must be a valid ISO 8601 date string ») ;
// - la même forme est renvoyée en lecture par `GET /calendars/:ownerId`.
// `docs/routes.md` documente déjà `kind`/`recurrence` en minuscules pour calendar-service ; ces
// types en sont le miroir typé côté front, absent jusqu'ici.

/** Nature d'un créneau, valeur réelle acceptée/renvoyée par calendar-service. */
export type AvailabilityKindApi = 'available' | 'unavailable'

/** Fréquence de récurrence, valeur réelle acceptée/renvoyée par calendar-service. */
export type AvailabilityRecurrenceApi = 'none' | 'weekly' | 'biweekly'

/** Forme réelle d'un créneau telle que renvoyée par `GET /calendars/:ownerId`. */
export interface AvailabilitySlotApi {
  id: string
  calendarId?: string
  ownerId?: string
  dayOfWeek: number
  /** Date ISO 8601 complète, ex. `"2026-08-24T10:00:00.000Z"` — pas une heure seule. */
  startTime: string
  endTime: string
  recurrence: AvailabilityRecurrenceApi
  recurrenceEndDate: string | null
  kind: AvailabilityKindApi
  createdAt?: string
  updatedAt?: string
}

/** Corps réel de `POST /calendars/:ownerId/availability-slots`. */
export interface CreateAvailabilitySlotPayloadApi {
  dayOfWeek: number
  startTime: string
  endTime: string
  recurrence: AvailabilityRecurrenceApi
  recurrenceEndDate?: string | null
  kind: AvailabilityKindApi
}

/** Corps réel de `PATCH /calendars/:ownerId/availability-slots/:slotId` — champs partiels. */
export type UpdateAvailabilitySlotPayloadApi = Partial<CreateAvailabilitySlotPayloadApi>
