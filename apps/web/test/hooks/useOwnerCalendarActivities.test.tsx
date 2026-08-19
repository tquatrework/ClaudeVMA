import { renderHook, act, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../src/api/calendar')

import { acceptActivity, declineActivity, fetchOwnerCalendarActivities } from '../../src/api/calendar'
import { useOwnerCalendarActivities } from '../../src/hooks/calendar/useOwnerCalendarActivities'

const mockFetchOwnerCalendarActivities = vi.mocked(fetchOwnerCalendarActivities)
const mockAcceptActivity = vi.mocked(acceptActivity)
const mockDeclineActivity = vi.mocked(declineActivity)

const OWNER_ID = 'owner-1'

const PROPOSED_ENTRY = {
  id: 'activity-1',
  type: 'cours' as const,
  status: 'proposed' as const,
  startTime: '2026-09-10T14:00:00.000Z',
  endTime: '2026-09-10T15:00:00.000Z',
  creatorId: 'teacher-9',
  creatorName: 'Camille Durand',
  participantIds: [OWNER_ID],
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useOwnerCalendarActivities — chargement', () => {
  it('charge les activités via GET /calendars/:ownerId (activities)', async () => {
    mockFetchOwnerCalendarActivities.mockResolvedValue([PROPOSED_ENTRY])

    const { result } = renderHook(() => useOwnerCalendarActivities(OWNER_ID))

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.activities).toEqual([PROPOSED_ENTRY])
    expect(mockFetchOwnerCalendarActivities).toHaveBeenCalledWith(OWNER_ID)
  })

  it("n'appelle rien tant que l'id est absent", async () => {
    const { result } = renderHook(() => useOwnerCalendarActivities(undefined))
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(mockFetchOwnerCalendarActivities).not.toHaveBeenCalled()
  })
})

describe('useOwnerCalendarActivities — accepter', () => {
  it('accepte : le statut local passe à confirmed, réponse serveur confirmée avant mise à jour', async () => {
    mockFetchOwnerCalendarActivities.mockResolvedValue([PROPOSED_ENTRY])
    mockAcceptActivity.mockResolvedValue({
      id: 'activity-1',
      type: 'cours',
      creatorId: 'teacher-9',
      creatorRole: 'formateur',
      participantIds: [OWNER_ID],
      startTime: PROPOSED_ENTRY.startTime,
      endTime: PROPOSED_ENTRY.endTime,
      status: 'confirmed',
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
    })

    const { result } = renderHook(() => useOwnerCalendarActivities(OWNER_ID))
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.respondToActivity('activity-1', 'accept')
    })

    expect(mockAcceptActivity).toHaveBeenCalledWith('activity-1')
    expect(result.current.activities).toEqual([{ ...PROPOSED_ENTRY, status: 'confirmed' }])
    expect(result.current.respondingActivityId).toBeNull()
  })
})

describe('useOwnerCalendarActivities — refuser', () => {
  it('refuse : le créneau est retiré de la liste', async () => {
    mockFetchOwnerCalendarActivities.mockResolvedValue([PROPOSED_ENTRY])
    mockDeclineActivity.mockResolvedValue({
      id: 'activity-1',
      type: 'cours',
      creatorId: 'teacher-9',
      creatorRole: 'formateur',
      participantIds: [OWNER_ID],
      startTime: PROPOSED_ENTRY.startTime,
      endTime: PROPOSED_ENTRY.endTime,
      status: 'cancelled',
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
    })

    const { result } = renderHook(() => useOwnerCalendarActivities(OWNER_ID))
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.respondToActivity('activity-1', 'decline')
    })

    expect(mockDeclineActivity).toHaveBeenCalledWith('activity-1')
    expect(result.current.activities).toEqual([])
  })
})

describe('useOwnerCalendarActivities — conflit', () => {
  it('un 409 déclenche un message explicite et un rafraîchissement complet', async () => {
    mockFetchOwnerCalendarActivities.mockResolvedValue([PROPOSED_ENTRY])
    mockAcceptActivity.mockRejectedValue({ response: { status: 409 } })

    const { result } = renderHook(() => useOwnerCalendarActivities(OWNER_ID))
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.respondToActivity('activity-1', 'accept')
    })

    expect(result.current.respondError).toMatch(/déjà été traitée/i)
    expect(mockFetchOwnerCalendarActivities).toHaveBeenCalledTimes(2)
  })

  it("une erreur non-409 remonte un message générique et n'altère pas la liste", async () => {
    mockFetchOwnerCalendarActivities.mockResolvedValue([PROPOSED_ENTRY])
    mockAcceptActivity.mockRejectedValue({ response: { status: 403 } })

    const { result } = renderHook(() => useOwnerCalendarActivities(OWNER_ID))
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.respondToActivity('activity-1', 'accept')
    })

    expect(result.current.respondError).toBe("Vous n'êtes pas autorisé à effectuer cette action.")
    expect(result.current.activities).toEqual([PROPOSED_ENTRY])
  })
})
