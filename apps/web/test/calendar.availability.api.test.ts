/**
 * Contrat HTTP des fonctions de disponibilités de `src/api/calendar.ts`.
 *
 * `fetchAvailability` — corrigée le 2026-08-18 : `GET /calendars/:ownerId/availability`
 * n'a jamais existé côté calendar-service (404 confirmé contre la pile réelle). La vraie
 * route est `GET /calendars/:ownerId`, dont la réponse porte les créneaux dans le bloc
 * `availabilitySlots`.
 *
 * Second bug, corrigé le même jour : le contrat réel de calendar-service exige
 * `startTime`/`endTime` en date ISO 8601 complète et `kind`/`recurrence` en minuscules —
 * vérifié par appel HTTP réel contre https://claudevma.visioprof.fr (`POST` avec
 * `startTime: "10:00"` renvoyait `400 "startTime must be a valid ISO 8601 date string"`).
 * Ces tests couvrent désormais le **corps exact** envoyé au serveur (ISO complet, enums
 * minuscules) et le **format exact** attendu en lecture (même forme), pas seulement que
 * l'appel a lieu — la représentation front (`HH:mm`, enums majuscules) reste inchangée pour
 * la grille et le formulaire, la traduction ayant lieu dans `src/api/calendar.ts`.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../src/api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}))

import apiClient from '../src/api/client'
import {
  createAvailabilitySlot,
  deleteAvailabilitySlot,
  fetchAvailability,
  updateAvailabilitySlot,
} from '../src/api/calendar'

const mockGet = vi.mocked(apiClient.get)
const mockPost = vi.mocked(apiClient.post)
const mockPatch = vi.mocked(apiClient.patch)
const mockDelete = vi.mocked(apiClient.delete)

const OWNER_ID = 'owner-1'
const SLOT_ID = 'slot-1'

/** Forme réelle renvoyée par calendar-service — ISO complet, enums minuscules. */
const API_SLOT = {
  id: SLOT_ID,
  ownerId: OWNER_ID,
  dayOfWeek: 1,
  startTime: '2026-08-24T09:00:00.000Z',
  endTime: '2026-08-24T10:00:00.000Z',
  recurrence: 'weekly' as const,
  recurrenceEndDate: null,
  kind: 'available' as const,
}

/** Représentation front équivalente — `HH:mm`, enums majuscules. */
const FRONT_SLOT = {
  id: SLOT_ID,
  ownerId: OWNER_ID,
  dayOfWeek: 1,
  startTime: '09:00',
  endTime: '10:00',
  recurrence: 'WEEKLY' as const,
  recurrenceEndDate: null,
  kind: 'AVAILABLE' as const,
  createdAt: undefined,
  updatedAt: undefined,
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('fetchAvailability', () => {
  it('GET /calendars/:ownerId, extrait availabilitySlots et le traduit en représentation front', async () => {
    mockGet.mockResolvedValue({
      data: { availabilitySlots: [API_SLOT], events: [] },
    })

    const result = await fetchAvailability(OWNER_ID)

    expect(mockGet).toHaveBeenCalledWith(`/calendars/${OWNER_ID}`)
    expect(result).toEqual([FRONT_SLOT])
  })

  it('renvoie un tableau vide si availabilitySlots est absent de la réponse', async () => {
    mockGet.mockResolvedValue({ data: {} })

    const result = await fetchAvailability(OWNER_ID)

    expect(result).toEqual([])
  })
})

describe('createAvailabilitySlot', () => {
  it('POST /calendars/:ownerId/availability-slots avec startTime/endTime en ISO complet et enums minuscules', async () => {
    mockPost.mockResolvedValue({ data: API_SLOT })

    const payload = {
      dayOfWeek: 1,
      startTime: '09:00',
      endTime: '10:00',
      recurrence: 'WEEKLY' as const,
      recurrenceEndDate: null,
      kind: 'AVAILABLE' as const,
    }

    const result = await createAvailabilitySlot(OWNER_ID, payload)

    expect(mockPost).toHaveBeenCalledTimes(1)
    const [calledPath, calledBody] = mockPost.mock.calls[0]
    expect(calledPath).toBe(`/calendars/${OWNER_ID}/availability-slots`)
    expect(calledBody).toMatchObject({
      dayOfWeek: 1,
      recurrence: 'weekly',
      recurrenceEndDate: null,
      kind: 'available',
    })
    // startTime/endTime : date ISO 8601 complète portant l'heure demandée, pas "09:00" brut.
    expect(calledBody.startTime).toMatch(/^\d{4}-\d{2}-\d{2}T09:00:00\.000Z$/)
    expect(calledBody.endTime).toMatch(/^\d{4}-\d{2}-\d{2}T10:00:00\.000Z$/)

    // La réponse serveur (ISO, minuscules) est retraduite vers la représentation front.
    expect(result).toEqual(FRONT_SLOT)
  })
})

describe('updateAvailabilitySlot', () => {
  it('PATCH avec le corps partiel traduit — startTime en ISO complet, dayOfWeek connu du créneau', async () => {
    const updatedApiSlot = { ...API_SLOT, endTime: '2026-08-24T11:00:00.000Z' }
    mockPatch.mockResolvedValue({ data: updatedApiSlot })

    const result = await updateAvailabilitySlot(OWNER_ID, SLOT_ID, { endTime: '11:00' }, 1)

    expect(mockPatch).toHaveBeenCalledTimes(1)
    const [calledPath, calledBody] = mockPatch.mock.calls[0]
    expect(calledPath).toBe(`/calendars/${OWNER_ID}/availability-slots/${SLOT_ID}`)
    expect(Object.keys(calledBody)).toEqual(['endTime'])
    expect(calledBody.endTime).toMatch(/^\d{4}-\d{2}-\d{2}T11:00:00\.000Z$/)

    expect(result).toEqual({ ...FRONT_SLOT, endTime: '11:00' })
  })

  it('traduit kind/recurrence en minuscules quand ils font partie du corps partiel', async () => {
    mockPatch.mockResolvedValue({ data: { ...API_SLOT, kind: 'unavailable' as const } })

    await updateAvailabilitySlot(OWNER_ID, SLOT_ID, { kind: 'UNAVAILABLE' }, 1)

    const [, calledBody] = mockPatch.mock.calls[0]
    expect(calledBody).toEqual({ kind: 'unavailable' })
  })
})

describe('deleteAvailabilitySlot', () => {
  it('DELETE /calendars/:ownerId/availability-slots/:slotId', async () => {
    mockDelete.mockResolvedValue({ data: undefined })

    await deleteAvailabilitySlot(OWNER_ID, SLOT_ID)

    expect(mockDelete).toHaveBeenCalledWith(
      `/calendars/${OWNER_ID}/availability-slots/${SLOT_ID}`,
    )
  })
})
