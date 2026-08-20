/**
 * availabilitySlotApiMapping.ts — traduction entre la représentation front d'un créneau de
 * disponibilité (`HH:mm`, enums en majuscules — consommée par `AvailabilityGrid` et
 * `AvailabilitySlotFormModal`) et le contrat réel de calendar-service (`startTime`/`endTime` en
 * ISO 8601 complet, `kind`/`recurrence` en minuscules).
 *
 * Contrat vérifié par appel HTTP réel contre https://claudevma.visioprof.fr le 2026-08-18 :
 * - `POST /calendars/:ownerId/availability-slots` avec `startTime: "10:00"` renvoie `400`
 *   (« startTime must be a valid ISO 8601 date string ») — une date ISO 8601 complète est
 *   exigée, ex. `"2026-08-24T10:00:00.000Z"` ;
 * - `kind`/`recurrence` en majuscules (`"AVAILABLE"`, `"WEEKLY"`) sont silencieusement rejetés
 *   par la même validation ; seules les valeurs minuscules documentées dans `docs/routes.md`
 *   sont acceptées ;
 * - `GET /calendars/:ownerId` (bloc `availabilitySlots`) renvoie la même forme en lecture.
 *
 * Fonctions pures, réutilisées à la fois en écriture (construction du payload, dans
 * `src/api/calendar.ts`) et en lecture (interprétation de la réponse du serveur) — aucune
 * duplication de la conversion entre les deux sens.
 *
 * Choix pour la date ISO construite en écriture : seuls le jour de semaine (`dayOfWeek`,
 * transmis séparément) et l'heure du jour comptent pour un créneau récurrent — vérifié contre
 * la pile réelle, qui accepte une date dont le jour de semaine ne correspond pas à `dayOfWeek`
 * sans jamais recouper les deux. La date choisie ici est néanmoins la **prochaine occurrence
 * réelle** de ce jour de semaine (aujourd'hui inclus) par hygiène, au cas où une version future
 * du service s'en servirait pour ancrer le début d'une récurrence. Toujours construite et lue en
 * **UTC**, jamais dans le fuseau du navigateur : un aller-retour envoi → relecture reproduit
 * l'heure affichée sans dérive liée au fuseau horaire de qui l'utilise.
 */

import type {
  AvailabilityKind,
  AvailabilityKindApi,
  AvailabilityRecurrence,
  AvailabilityRecurrenceApi,
  AvailabilitySlot,
  AvailabilitySlotApi,
  CreateAvailabilitySlotPayload,
  CreateAvailabilitySlotPayloadApi,
  UpdateAvailabilitySlotPayload,
  UpdateAvailabilitySlotPayloadApi,
} from '../types/calendar'
import { isValidTimeString } from './availabilityTime'

const KIND_TO_API: Record<AvailabilityKind, AvailabilityKindApi> = {
  AVAILABLE: 'available',
  UNAVAILABLE: 'unavailable',
}

const KIND_FROM_API: Record<AvailabilityKindApi, AvailabilityKind> = {
  available: 'AVAILABLE',
  unavailable: 'UNAVAILABLE',
}

const RECURRENCE_TO_API: Record<AvailabilityRecurrence, AvailabilityRecurrenceApi> = {
  NONE: 'none',
  WEEKLY: 'weekly',
  BIWEEKLY: 'biweekly',
}

const RECURRENCE_FROM_API: Record<AvailabilityRecurrenceApi, AvailabilityRecurrence> = {
  none: 'NONE',
  weekly: 'WEEKLY',
  biweekly: 'BIWEEKLY',
}

/**
 * Date (UTC, heure à minuit) de la prochaine occurrence — aujourd'hui inclus — d'un jour de
 * semaine (0 dimanche … 6 samedi, aligné `Date.getDay()`), à partir d'une date de référence.
 * `referenceDate` est un paramètre explicite (et non un appel direct à `Date.now()` à
 * l'intérieur) pour que la fonction reste testable de façon déterministe.
 */
function nextOrTodayDateForWeekday(dayOfWeek: number, referenceDate: Date): Date {
  const result = new Date(
    Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth(), referenceDate.getUTCDate()),
  )
  const daysToAdd = (dayOfWeek - result.getUTCDay() + 7) % 7
  result.setUTCDate(result.getUTCDate() + daysToAdd)
  return result
}

/**
 * Combine un jour de semaine et une heure `HH:mm` en une date ISO 8601 complète, exigée par
 * calendar-service pour `startTime`/`endTime`. Voir l'en-tête du fichier pour le choix de date.
 */
export function buildIsoDateTimeForDay(
  dayOfWeek: number,
  time: string,
  referenceDate: Date = new Date(),
): string {
  if (!isValidTimeString(time)) {
    throw new Error(`Heure invalide : ${time}`)
  }
  const [hours, minutes] = time.split(':').map(Number)
  const date = nextOrTodayDateForWeekday(dayOfWeek, referenceDate)
  date.setUTCHours(hours, minutes, 0, 0)
  return date.toISOString()
}

/**
 * La date/heure ISO 8601 résolue par `buildIsoDateTimeForDay` tombe-t-elle déjà dans le passé par
 * rapport à `referenceDate` (défaut : l'instant présent) ?
 *
 * `buildIsoDateTimeForDay` retient toujours le jour calendaire d'aujourd'hui ou d'un jour futur
 * (`nextOrTodayDateForWeekday`) : la seule façon d'obtenir un instant déjà passé est de cliquer
 * sur le jour de semaine correspondant à aujourd'hui, à une heure déjà dépassée (ex. cliquer sur
 * « Mercredi 15:00 » alors qu'il est déjà 16h ce même mercredi) — la grille étant un gabarit
 * hebdomadaire récurrent (point 1), rien n'empêche ce clic. Décision utilisateur du 2026-08-19 :
 * avertir avant de valider, sans jamais bloquer la création — cette fonction sert uniquement à
 * détecter le cas pour afficher l'avertissement, la création reste possible ensuite.
 *
 * `referenceDate` est un paramètre explicite (et non un appel direct à `Date.now()` à l'intérieur)
 * pour que la fonction reste testable de façon déterministe, même convention que
 * `nextOrTodayDateForWeekday`/`buildIsoDateTimeForDay` ci-dessus.
 */
export function isResolvedDateTimeInPast(
  isoDateTime: string,
  referenceDate: Date = new Date(),
): boolean {
  const parsed = new Date(isoDateTime)
  if (Number.isNaN(parsed.getTime())) return false
  return parsed.getTime() < referenceDate.getTime()
}

/**
 * Extrait l'heure `HH:mm` (UTC) d'une date ISO 8601 complète renvoyée par calendar-service.
 * Renvoie `null` si la chaîne n'est pas une date valide — jamais une heure inventée.
 */
export function extractTimeOfDayFromIso(isoDateTime: string): string | null {
  const parsed = new Date(isoDateTime)
  if (Number.isNaN(parsed.getTime())) return null
  const hours = parsed.getUTCHours().toString().padStart(2, '0')
  const minutes = parsed.getUTCMinutes().toString().padStart(2, '0')
  return `${hours}:${minutes}`
}

/** Traduit un créneau reçu du serveur vers la représentation front (grille, formulaire). */
export function fromApiSlot(apiSlot: AvailabilitySlotApi): AvailabilitySlot {
  return {
    id: apiSlot.id,
    ownerId: apiSlot.ownerId ?? '',
    dayOfWeek: apiSlot.dayOfWeek,
    startTime: extractTimeOfDayFromIso(apiSlot.startTime) ?? '00:00',
    endTime: extractTimeOfDayFromIso(apiSlot.endTime) ?? '00:00',
    recurrence: RECURRENCE_FROM_API[apiSlot.recurrence],
    recurrenceEndDate: apiSlot.recurrenceEndDate,
    kind: KIND_FROM_API[apiSlot.kind],
    createdAt: apiSlot.createdAt,
    updatedAt: apiSlot.updatedAt,
  }
}

/** Traduit un payload de création front vers le corps réel attendu par calendar-service. */
export function toApiCreatePayload(
  payload: CreateAvailabilitySlotPayload,
): CreateAvailabilitySlotPayloadApi {
  return {
    dayOfWeek: payload.dayOfWeek,
    startTime: buildIsoDateTimeForDay(payload.dayOfWeek, payload.startTime),
    endTime: buildIsoDateTimeForDay(payload.dayOfWeek, payload.endTime),
    recurrence: RECURRENCE_TO_API[payload.recurrence],
    recurrenceEndDate: payload.recurrenceEndDate ?? null,
    kind: KIND_TO_API[payload.kind],
  }
}

/**
 * Traduit un payload de modification (champs partiels) front vers le corps réel attendu par
 * calendar-service. `startTime`/`endTime` dépendent d'un jour de semaine pour construire une
 * date ISO cohérente : celui du payload s'il est fourni, sinon celui déjà connu du créneau
 * modifié (`currentDayOfWeek`, optionnel — `0` par défaut). En pratique `AvailabilitySlotFormModal`
 * envoie toujours `dayOfWeek` avec ses modifications ; le repli ne sert qu'un appelant partiel
 * hypothétique, et reste sans conséquence : calendar-service ne recoupe jamais la date de
 * `startTime`/`endTime` avec `dayOfWeek` (vérifié contre la pile réelle le 2026-08-18 — un jour de
 * semaine explicitement incohérent avec la date est accepté sans erreur), seule l'heure du jour
 * compte pour un créneau récurrent.
 */
export function toApiUpdatePayload(
  payload: UpdateAvailabilitySlotPayload,
  currentDayOfWeek = 0,
): UpdateAvailabilitySlotPayloadApi {
  const dayOfWeek = payload.dayOfWeek ?? currentDayOfWeek
  const apiPayload: UpdateAvailabilitySlotPayloadApi = {}

  if (payload.dayOfWeek !== undefined) apiPayload.dayOfWeek = payload.dayOfWeek
  if (payload.startTime !== undefined) {
    apiPayload.startTime = buildIsoDateTimeForDay(dayOfWeek, payload.startTime)
  }
  if (payload.endTime !== undefined) {
    apiPayload.endTime = buildIsoDateTimeForDay(dayOfWeek, payload.endTime)
  }
  if (payload.recurrence !== undefined) apiPayload.recurrence = RECURRENCE_TO_API[payload.recurrence]
  if (payload.recurrenceEndDate !== undefined) apiPayload.recurrenceEndDate = payload.recurrenceEndDate
  if (payload.kind !== undefined) apiPayload.kind = KIND_TO_API[payload.kind]

  return apiPayload
}
