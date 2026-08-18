/**
 * Contrat HTTP des fonctions de disponibilités de `src/api/calendar.ts`.
 *
 * `fetchAvailability` — corrigée le 2026-08-18 : `GET /calendars/:ownerId/availability`
 * n'a jamais existé côté calendar-service (404 confirmé contre la pile réelle). La vraie
 * route est `GET /calendars/:ownerId`, dont la réponse porte les créneaux dans le bloc
 * `availabilitySlots`. Les 3 fonctions CRUD consomment un contrat encore hors
 * `docs/routes.md` au moment de leur écriture (backend en cours d'implémentation en
 * parallèle sur la même branche) — voir l'en-tête de `src/api/calendar.ts`.
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

beforeEach(() => {
  vi.clearAllMocks()
})

describe('fetchAvailability', () => {
  it('GET /calendars/:ownerId et extrait le bloc availabilitySlots', async () => {
    const slot = {
      id: SLOT_ID,
      ownerId: OWNER_ID,
      dayOfWeek: 1,
      startTime: '09:00',
      endTime: '10:00',
      recurrence: 'WEEKLY' as const,
      recurrenceEndDate: null,
      kind: 'AVAILABLE' as const,
    }
    mockGet.mockResolvedValue({
      data: { availabilitySlots: [slot], events: [] },
    })

    const result = await fetchAvailability(OWNER_ID)

    expect(mockGet).toHaveBeenCalledWith(`/calendars/${OWNER_ID}`)
    expect(result).toEqual([slot])
  })

  it('renvoie un tableau vide si availabilitySlots est absent de la réponse', async () => {
    mockGet.mockResolvedValue({ data: {} })

    const result = await fetchAvailability(OWNER_ID)

    expect(result).toEqual([])
  })
})

describe('createAvailabilitySlot', () => {
  it('POST /calendars/:ownerId/availability-slots avec le corps exact', async () => {
    const createdSlot = {
      id: SLOT_ID,
      ownerId: OWNER_ID,
      dayOfWeek: 1,
      startTime: '09:00',
      endTime: '10:00',
      recurrence: 'WEEKLY' as const,
      recurrenceEndDate: null,
      kind: 'AVAILABLE' as const,
    }
    mockPost.mockResolvedValue({ data: createdSlot })

    const payload = {
      dayOfWeek: 1,
      startTime: '09:00',
      endTime: '10:00',
      recurrence: 'WEEKLY' as const,
      recurrenceEndDate: null,
      kind: 'AVAILABLE' as const,
    }

    const result = await createAvailabilitySlot(OWNER_ID, payload)

    expect(mockPost).toHaveBeenCalledWith(
      `/calendars/${OWNER_ID}/availability-slots`,
      payload,
    )
    expect(result).toEqual(createdSlot)
  })
})

describe('updateAvailabilitySlot', () => {
  it('PATCH /calendars/:ownerId/availability-slots/:slotId avec le corps partiel', async () => {
    const updatedSlot = {
      id: SLOT_ID,
      ownerId: OWNER_ID,
      dayOfWeek: 1,
      startTime: '09:00',
      endTime: '11:00',
      recurrence: 'WEEKLY' as const,
      recurrenceEndDate: null,
      kind: 'AVAILABLE' as const,
    }
    mockPatch.mockResolvedValue({ data: updatedSlot })

    const payload = { endTime: '11:00' }
    const result = await updateAvailabilitySlot(OWNER_ID, SLOT_ID, payload)

    expect(mockPatch).toHaveBeenCalledWith(
      `/calendars/${OWNER_ID}/availability-slots/${SLOT_ID}`,
      payload,
    )
    expect(result).toEqual(updatedSlot)
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
