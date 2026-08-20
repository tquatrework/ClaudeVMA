/**
 * Module API — calendar-service
 * Toutes les requêtes passent par apiClient (base /api/v1).
 *
 * Assainissement du 2026-08-18 (chantier calendrier de disponibilités, point 3) :
 * `fetchActivity`/`updateActivity`/`deleteActivity` appelaient `/calendar/:id`, qui **404**
 * (aucune section de docs/routes.md ne l'a jamais documentée). Les vraies routes,
 * documentées pour la première fois le même jour, sont `/activities/:activityId`
 * (docs/routes.md § calendar-service > "Activités planifiées") — corrigées ci-dessous.
 *
 * **Écart restant, signalé et non corrigé** : `fetchActivitySessions` appelle `/calendar`
 * (liste, sans id), qui **404** également. Contrairement aux trois fonctions ci-dessus,
 * **aucune route de liste n'existe côté serveur** pour les activités planifiées — vérifié le
 * 2026-08-18 par appel direct contre `https://claudevma.visioprof.fr` avec un compte réel :
 * `GET /api/v1/activities` (sans id) répond `404 {"message":"Cannot GET /activities"}`, et
 * `GET /calendars/:ownerId` (qui répond `200` et dont la description promet pourtant
 * « créneaux de disponibilité + activités ») ne renvoie **aucune** activité même après qu'une
 * activité a été créée pour ce même titulaire — seul `availabilitySlots` y figure. La règle du
 * projet interdit d'inventer une URL : cet appel reste tel quel (toujours cassé), et
 * `ActivitiesPage` reste donc non fonctionnelle tant qu'aucune route de liste n'existe côté
 * serveur. Signalé dans le rapport de session, pas contourné ici.
 */

import apiClient from './client'
import type {
  CalendarEvent as OwnerCalendarEvent,
  EventType,
  ReminderDelay,
} from '../components/calendar/calendarTypes'
import type {
  CalendarActivityEntry,
  CalendarEvent,
  ActivitySession,
  AvailabilitySlot,
  AvailabilitySlotApi,
  CreateActivityPayload,
  CreateAvailabilitySlotPayload,
  ScheduledActivity,
  UpdateAvailabilitySlotPayload,
  LinkedCalendarBusyFree,
} from '../types/calendar'
import {
  fromApiSlot,
  toApiCreatePayload,
  toApiUpdatePayload,
} from '../utils/availabilitySlotApiMapping'
import { fromApiActivity } from '../utils/scheduledActivityApiMapping'

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
 * GET /calendar — **aucune route de liste équivalente n'existe côté serveur** (voir l'écart
 * signalé en tête de fichier). Laissé tel quel, toujours 404 : ne pas corriger sans route
 * documentée. Utilisé par ActivitiesPage.
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
 * GET /activities/:activityId — Détail d'une activité planifiée, traduit vers la
 * représentation front historique (voir `fromApiActivity`). Utilisé par ActivityDetailPage.
 */
export async function fetchActivity(activityId: string): Promise<ActivitySession> {
  const { data } = await apiClient.get<ScheduledActivity>(`/activities/${activityId}`)
  return fromApiActivity(data)
}

export interface UpdateActivityPayload {
  title?: string
  status?: string
}

/**
 * PUT /activities/:activityId — Modifie une activité planifiée (titre, statut — seuls champs
 * édités par ActivityEditForm ; `docs/routes.md` en autorise davantage — participants,
 * horaires, description — non exposés par ce formulaire).
 */
export async function updateActivity(
  activityId: string,
  payload: UpdateActivityPayload,
): Promise<ActivitySession> {
  const { data } = await apiClient.put<ScheduledActivity>(`/activities/${activityId}`, payload)
  return fromApiActivity(data)
}

/**
 * DELETE /activities/:activityId — Supprime une activité planifiée (suppression physique,
 * `204` sans corps).
 */
export async function deleteActivity(activityId: string): Promise<void> {
  await apiClient.delete(`/activities/${activityId}`)
}

// ─── Proposer / accepter / refuser un créneau de cours ─────────────────────────
//
// Chantier calendrier de disponibilités, point 3 (2026-08-18). `docs/routes.md` §
// calendar-service > "Activités planifiées". Le verbe API reste `POST /activities` — le choix
// entre proposer/partager/envoyer est un libellé d'interface (« Proposer un créneau »), pas un
// changement de contrat.

/**
 * POST /activities — Crée une activité planifiée, qui naît à `status: "proposed"`. Utilisé
 * par `ProposeCourseSlotDialog` (formateur → élève : `type: "cours"` ; AP → formateur :
 * `type: "reunion_pedagogique"` ; RP → formateur : `type: "reunion_pedagogique"`, sans
 * restriction de lien).
 */
export async function createActivity(payload: CreateActivityPayload): Promise<ScheduledActivity> {
  const { data } = await apiClient.post<ScheduledActivity>('/activities', payload)
  return data
}

/**
 * GET /activities/:activityId — Lit une activité planifiée dans sa forme réelle (sans
 * traduction), pour le flux de proposition (`CalendarProposalPage`, suivi des propositions
 * envoyées). Distinct de `fetchActivity` ci-dessus, qui traduit vers la représentation front
 * historique pour ActivityDetailPage.
 */
export async function fetchScheduledActivity(activityId: string): Promise<ScheduledActivity> {
  const { data } = await apiClient.get<ScheduledActivity>(`/activities/${activityId}`)
  return data
}

/**
 * POST /activities/:activityId/accept — Le destinataire accepte : `proposed` → `confirmed`.
 * Aucun corps. `409` si déjà traitée, `403` si l'appelant n'est pas le destinataire.
 */
export async function acceptActivity(activityId: string): Promise<ScheduledActivity> {
  const { data } = await apiClient.post<ScheduledActivity>(`/activities/${activityId}/accept`)
  return data
}

/**
 * POST /activities/:activityId/decline — Le destinataire refuse : `proposed` → `cancelled`.
 * Aucun corps. Mêmes règles que `acceptActivity`.
 */
export async function declineActivity(activityId: string): Promise<ScheduledActivity> {
  const { data } = await apiClient.post<ScheduledActivity>(`/activities/${activityId}/decline`)
  return data
}

// ─── Disponibilités (CalendarUnifiedView) ───────────────────────────────────────
//
// Corrigé le 2026-08-18 : `GET /calendars/:ownerId/availability` n'a jamais existé côté
// calendar-service (404 confirmé contre la pile réelle). `docs/routes.md` documente désormais
// la vraie route — `GET /calendars/:ownerId`, qui renvoie le calendrier complet et porte les
// créneaux de disponibilité dans son bloc `availabilitySlots`.
//
// Corrigé le même jour (second bug, distinct) : le contrat réel de calendar-service exige
// `startTime`/`endTime` en ISO 8601 complet et `kind`/`recurrence` en minuscules — vérifié par
// appel HTTP réel, voir `src/utils/availabilitySlotApiMapping.ts`. La traduction entre la
// représentation front (`HH:mm`, majuscules) et ce contrat a lieu ici, exclusivement.

interface OwnerCalendarResponse {
  availabilitySlots?: AvailabilitySlotApi[]
}

/**
 * GET /calendars/:ownerId — Lit le calendrier complet d'un titulaire et en extrait les
 * créneaux de disponibilité (`availabilitySlots`), traduits vers la représentation front.
 * Utilisé par CalendarUnifiedView.
 */
export async function fetchAvailability(ownerId: string): Promise<AvailabilitySlot[]> {
  const { data } = await apiClient.get<OwnerCalendarResponse>(`/calendars/${ownerId}`)
  return Array.isArray(data?.availabilitySlots) ? data.availabilitySlots.map(fromApiSlot) : []
}

/**
 * POST /calendars/:ownerId/availability-slots — Crée un créneau de disponibilité/indisponibilité.
 */
export async function createAvailabilitySlot(
  ownerId: string,
  payload: CreateAvailabilitySlotPayload,
): Promise<AvailabilitySlot> {
  const { data } = await apiClient.post<AvailabilitySlotApi>(
    `/calendars/${ownerId}/availability-slots`,
    toApiCreatePayload(payload),
  )
  return fromApiSlot(data)
}

/**
 * PATCH /calendars/:ownerId/availability-slots/:slotId — Modifie un créneau existant.
 *
 * `currentDayOfWeek` sert uniquement à construire une date ISO cohérente pour `startTime`/
 * `endTime` quand le payload ne porte pas lui-même `dayOfWeek` — voir
 * `toApiUpdatePayload` pour le détail (sans conséquence côté serveur, qui ne recoupe jamais la
 * date envoyée avec `dayOfWeek`).
 */
export async function updateAvailabilitySlot(
  ownerId: string,
  slotId: string,
  payload: UpdateAvailabilitySlotPayload,
  currentDayOfWeek?: number,
): Promise<AvailabilitySlot> {
  const { data } = await apiClient.patch<AvailabilitySlotApi>(
    `/calendars/${ownerId}/availability-slots/${slotId}`,
    toApiUpdatePayload(payload, currentDayOfWeek),
  )
  return fromApiSlot(data)
}

/**
 * DELETE /calendars/:ownerId/availability-slots/:slotId — Supprime un créneau.
 */
export async function deleteAvailabilitySlot(ownerId: string, slotId: string): Promise<void> {
  await apiClient.delete(`/calendars/${ownerId}/availability-slots/${slotId}`)
}

// ─── Activités du calendrier — affichage inline des propositions (CalendarUnifiedView) ──
//
// Chantier calendrier de disponibilités, point 3, gap comblé le 2026-08-18 côté serveur
// (docs/routes.md § calendar-service > "GET /calendars/:ownerId — forme exacte de activities").
// Décision explicite de l'utilisateur (2026-08-18) : les propositions de créneau apparaissent
// directement dans la grille du destinataire, pas dans une liste séparée.

interface OwnerCalendarActivitiesResponse {
  activities?: CalendarActivityEntry[]
}

/**
 * GET /calendars/:ownerId — Lit le calendrier complet d'un titulaire et en extrait les activités
 * planifiées (`activities`). Seuls `proposed`/`confirmed` peuvent y figurer (filtré côté serveur).
 * Utilisé par `useOwnerCalendarActivities` pour l'affichage inline des propositions/confirmations
 * de créneau de cours dans `AvailabilityGrid`.
 */
export async function fetchOwnerCalendarActivities(ownerId: string): Promise<CalendarActivityEntry[]> {
  const { data } = await apiClient.get<OwnerCalendarActivitiesResponse>(`/calendars/${ownerId}`)
  return Array.isArray(data?.activities) ? data.activities : []
}

// ─── Visibilité busy/free d'un tiers lié (LinkedCalendarView) ──────────────────
//
// GET /calendars/:ownerId/busy?from=&to= (docs/routes.md § calendar-service > "Visibilité
// busy/free"). `from`/`to` sont transmis exactement tels que fournis par l'appelant (ISO 8601
// avec fuseau) — la route accepte indifféremment avec ou sans millisecondes ; c'est la réponse
// qui est toujours normalisée en ISO 8601 UTC avec millisecondes.

/**
 * GET /calendars/:ownerId/busy — Lit le calendrier busy/free d'un tiers lié (jamais le
 * contenu). `403` si l'appelant n'a aucun lien ouvrant ce calendrier, `503` si profile-service
 * (consulté par calendar-service pour vérifier le lien) est injoignable — traduits par
 * `useLinkedCalendarBusyFree`, jamais affichés tels quels.
 */
export async function fetchLinkedCalendarBusyFree(
  ownerId: string,
  from: string,
  to: string,
): Promise<LinkedCalendarBusyFree> {
  const queryParams = new URLSearchParams({ from, to })
  const { data } = await apiClient.get<LinkedCalendarBusyFree>(
    `/calendars/${ownerId}/busy?${queryParams.toString()}`,
  )
  return data
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

// ─── Invitations (EventDetailDialog) ────────────────────────────────────────────
//
// InvitationBanner (bandeau distinct au-dessus de la grille) a été retiré le 2026-08-20 : bug réel
// signalé par un utilisateur (formateur → élève, invitation jamais vue). Deux causes cumulées —
// GET /calendars/:ownerId/events ne renvoyait pas les événements où l'appelant est seulement
// invité (corrigé côté calendar-service le même jour), et InvitationBanner lui-même ne pouvait
// jamais s'afficher pour une invitation réelle (il testait `eventType === 'invitation'` et un
// champ `inviteeStatus` que le serveur n'a jamais renvoyé). Remplacé par un affichage direct sur
// la grille (couleur dédiée, `EVENT_PENDING`) + une modale Accepter/Refuser au clic
// (`EventDetailDialog`), sur le même modèle que les propositions de créneau de cours (`PROPOSED`).

/**
 * POST /events/:id/invitees/:userId/accept — Accepte une invitation. Utilisé par
 * `EventDetailDialog` (via `useCalendarEvents.respondToEventInvitation`).
 */
export async function acceptEventInvitation(eventId: string, userId: string): Promise<void> {
  await apiClient.post(`/events/${eventId}/invitees/${userId}/accept`)
}

/**
 * POST /events/:id/invitees/:userId/decline — Refuse une invitation (retire l'invité). Utilisé
 * par `EventDetailDialog` (via `useCalendarEvents.respondToEventInvitation`).
 */
export async function declineEventInvitation(eventId: string, userId: string): Promise<void> {
  await apiClient.post(`/events/${eventId}/invitees/${userId}/decline`)
}

// ─── Suppression d'un événement (EventDetailDialog, point 4, 2026-08-20) ───────

/**
 * DELETE /calendars/:ownerId/events/:eventId — Supprime un événement (suppression physique,
 * `204` sans corps). Route ajoutée côté calendar-service le 2026-08-20 : créateur, RP ou TI
 * uniquement (`docs/routes.md`). Le front ne réserve le bouton "Supprimer l'événement" qu'au
 * créateur (`event.ownerId === viewerId`) — aucune notion de rôle privilégié RP/TI exacte n'est
 * réutilisable ici (`isAdministratorRole` inclut l'administrateur financier, qui n'a pas ce droit
 * côté serveur) ; un `403` reste géré si un cas limite se présentait malgré tout.
 */
export async function deleteOwnerEvent(ownerId: string, eventId: string): Promise<void> {
  await apiClient.delete(`/calendars/${ownerId}/events/${eventId}`)
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
