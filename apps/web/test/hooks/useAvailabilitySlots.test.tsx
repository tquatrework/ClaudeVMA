import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useAvailabilitySlots } from '../../src/hooks/calendar/useAvailabilitySlots'

vi.mock('../../src/api/calendar')

import {
  createAvailabilitySlot,
  deleteAvailabilitySlot,
  fetchAvailability,
  updateAvailabilitySlot,
} from '../../src/api/calendar'

const mockFetchAvailability = vi.mocked(fetchAvailability)
const mockCreateAvailabilitySlot = vi.mocked(createAvailabilitySlot)
const mockUpdateAvailabilitySlot = vi.mocked(updateAvailabilitySlot)
const mockDeleteAvailabilitySlot = vi.mocked(deleteAvailabilitySlot)

const OWNER_ID = 'owner-1'

const EXISTING_SLOT = {
  id: 'slot-1',
  ownerId: OWNER_ID,
  dayOfWeek: 1,
  startTime: '09:00',
  endTime: '10:00',
  recurrence: 'WEEKLY' as const,
  recurrenceEndDate: null,
  kind: 'AVAILABLE' as const,
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useAvailabilitySlots — chargement', () => {
  it('charge les créneaux existants', async () => {
    mockFetchAvailability.mockResolvedValue([EXISTING_SLOT])

    const { result } = renderHook(() => useAvailabilitySlots(OWNER_ID))

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    expect(result.current.slots).toEqual([EXISTING_SLOT])
    expect(mockFetchAvailability).toHaveBeenCalledWith(OWNER_ID)
  })

  it('remonte une erreur de chargement', async () => {
    mockFetchAvailability.mockRejectedValue({ response: { status: 500 } })

    const { result } = renderHook(() => useAvailabilitySlots(OWNER_ID))

    await waitFor(() => {
      expect(result.current.loadError).not.toBeNull()
    })
    expect(result.current.slots).toEqual([])
  })
})

describe('useAvailabilitySlots — création', () => {
  it('ajoute le créneau renvoyé par le serveur, pas le corps envoyé', async () => {
    mockFetchAvailability.mockResolvedValue([])
    const serverCreatedSlot = { ...EXISTING_SLOT, id: 'slot-server-generated' }
    mockCreateAvailabilitySlot.mockResolvedValue(serverCreatedSlot)

    const { result } = renderHook(() => useAvailabilitySlots(OWNER_ID))

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      const success = await result.current.createSlot({
        dayOfWeek: 1,
        startTime: '09:00',
        endTime: '10:00',
        recurrence: 'WEEKLY',
        kind: 'AVAILABLE',
      })
      expect(success).toBe(true)
    })

    expect(result.current.slots).toEqual([serverCreatedSlot])
  })

  it("remonte une erreur d'action sans modifier la liste", async () => {
    mockFetchAvailability.mockResolvedValue([])
    mockCreateAvailabilitySlot.mockRejectedValue({ response: { status: 400 } })

    const { result } = renderHook(() => useAvailabilitySlots(OWNER_ID))
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      const success = await result.current.createSlot({
        dayOfWeek: 1,
        startTime: '09:00',
        endTime: '10:00',
        recurrence: 'NONE',
        kind: 'AVAILABLE',
      })
      expect(success).toBe(false)
    })

    expect(result.current.actionError).not.toBeNull()
    expect(result.current.slots).toEqual([])
  })
})

describe('useAvailabilitySlots — modification', () => {
  it('remplace le créneau par la réponse serveur', async () => {
    mockFetchAvailability.mockResolvedValue([EXISTING_SLOT])
    const updatedSlot = { ...EXISTING_SLOT, endTime: '11:00' }
    mockUpdateAvailabilitySlot.mockResolvedValue(updatedSlot)

    const { result } = renderHook(() => useAvailabilitySlots(OWNER_ID))
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.updateSlot(EXISTING_SLOT.id, { endTime: '11:00' })
    })

    expect(result.current.slots).toEqual([updatedSlot])
    expect(mockUpdateAvailabilitySlot).toHaveBeenCalledWith(OWNER_ID, EXISTING_SLOT.id, {
      endTime: '11:00',
    })
  })
})

describe('useAvailabilitySlots — suppression', () => {
  it('retire le créneau supprimé de la liste', async () => {
    mockFetchAvailability.mockResolvedValue([EXISTING_SLOT])
    mockDeleteAvailabilitySlot.mockResolvedValue(undefined)

    const { result } = renderHook(() => useAvailabilitySlots(OWNER_ID))
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      const success = await result.current.deleteSlot(EXISTING_SLOT.id)
      expect(success).toBe(true)
    })

    expect(result.current.slots).toEqual([])
  })
})
