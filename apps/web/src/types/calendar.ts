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

// ─── Visibilité busy/free d'un tiers lié (chantier calendrier de disponibilités, point 2) ──
//
// Source API : GET /calendars/:ownerId/busy?from=&to= (docs/routes.md § calendar-service >
// "Visibilité busy/free"). Réponse pauvre par construction : jamais d'id, de titre, de type ni
// de liste de participants — uniquement des plages `start`/`end`. Toutes les dates de la
// réponse sont en ISO 8601 UTC avec millisecondes (`Date.prototype.toISOString()`), quel que
// soit le format fourni en requête.

/** Une plage horaire de la réponse busy/free — bornes en ISO 8601 UTC. */
export interface BusyFreeTimeBlock {
  start: string
  end: string
}

/**
 * Réponse complète de `GET /calendars/:ownerId/busy` : les créneaux **disponibles** et
 * **indisponibles** (projection des créneaux de disponibilité du titulaire sur `[from, to)`) et
 * les blocs **occupés** (activités du titulaire sur la même fenêtre, sans aucun détail).
 */
export interface LinkedCalendarBusyFree {
  ownerId: string
  from: string
  to: string
  availableWindows: BusyFreeTimeBlock[]
  unavailableBlocks: BusyFreeTimeBlock[]
  busyBlocks: BusyFreeTimeBlock[]
}

// ─── Activités planifiées — proposer/accepter/refuser un créneau de cours ──────
//
// Chantier calendrier de disponibilités, point 3 (2026-08-18). Contrat vérifié contre
// docs/routes.md § calendar-service > "Activités planifiées" — forme exacte de
// `ScheduledActivity`, distincte de `ActivitySession` ci-dessus (représentation historique,
// jamais renvoyée telle quelle par le serveur, voir `src/utils/scheduledActivityApiMapping.ts`
// pour la traduction utilisée par `fetchActivity`/`updateActivity`).

/** `type` d'une activité planifiée — minuscules, exactement comme envoyé/renvoyé par le serveur. */
export type ActivityType = 'cours' | 'reunion_pedagogique' | 'entretien_rp' | 'rappel' | 'autre'

/** `status` d'une activité planifiée. `completed` n'est jamais atteignable par ces routes. */
export type ActivityStatus = 'proposed' | 'confirmed' | 'cancelled' | 'completed'

/**
 * Forme réelle d'une activité planifiée, telle que renvoyée par `POST/GET/PUT /activities`,
 * `.../accept` et `.../decline` (docs/routes.md § calendar-service > "Activités planifiées").
 */
export interface ScheduledActivity {
  id: string
  title?: string | null
  type: ActivityType
  creatorId: string
  creatorRole: string
  participantIds: string[]
  startTime: string
  endTime: string
  status: ActivityStatus
  description?: string | null
  correlationId?: string | null
  createdAt: string
  updatedAt: string
}

/** Corps de `POST /activities`. */
export interface CreateActivityPayload {
  title?: string
  type: ActivityType
  participantIds: string[]
  startTime: string
  endTime: string
  description?: string
  correlationId?: string
}

// ─── Activités dans GET /calendars/:ownerId — affichage inline (point 3, 2026-08-19) ──
//
// Chantier calendrier de disponibilités, point 3, gap comblé le 2026-08-18 côté serveur :
// `GET /calendars/:ownerId` porte désormais un champ `activities` (docs/routes.md § calendar-service
// > "GET /calendars/:ownerId — forme exacte de activities"). Forme **distincte** de
// `ScheduledActivity` ci-dessus : plus pauvre (pas de `title`/`description`/`correlationId`/
// `createdAt`/`updatedAt`), mais `creatorName` y est déjà résolu par le serveur — jamais un UUID à
// afficher (arbitrage du 2026-08-09).

/**
 * Élément d'activité tel que renvoyé dans `activities` par `GET /calendars/:ownerId`. Utilisé pour
 * afficher les propositions/confirmations de créneau de cours directement dans la grille du
 * destinataire (`CalendarUnifiedView`, `useOwnerCalendarActivities`).
 */
export interface CalendarActivityEntry {
  id: string
  type: ActivityType
  status: Extract<ActivityStatus, 'proposed' | 'confirmed'>
  startTime: string
  endTime: string
  creatorId: string
  creatorName: string | null
  participantIds: string[]
}

// ─── Destinataire choisi par nom — proposition de créneau ET création d'événement ──
//
// Partagé par `ProposeCourseSlotDialog` (`POST /activities`) et `EventCreateFormModal`
// (`POST /calendars/:ownerId/events`, champ `inviteeIds`) — correction du 2026-08-20, point D.
// `userId` ne sert qu'à construire l'appel suivant, jamais affiché (arbitrage du 2026-08-09).

export interface EventRecipientOption {
  userId: string
  displayName: string
}
