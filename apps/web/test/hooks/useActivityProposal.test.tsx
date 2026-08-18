import { renderHook, act, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../src/api/calendar')

import { acceptActivity, declineActivity, fetchScheduledActivity } from '../../src/api/calendar'
import { useActivityProposal } from '../../src/hooks/calendar/useActivityProposal'

const mockFetchScheduledActivity = vi.mocked(fetchScheduledActivity)
const mockAcceptActivity = vi.mocked(acceptActivity)
const mockDeclineActivity = vi.mocked(declineActivity)

const ACTIVITY = {
  id: 'activity-1',
  title: 'Cours de géométrie',
  type: 'cours' as const,
  creatorId: 'teacher-1',
  creatorRole: 'formateur',
  participantIds: ['student-1'],
  startTime: '2026-09-10T14:00:00.000Z',
  endTime: '2026-09-10T15:00:00.000Z',
  status: 'proposed' as const,
  description: null,
  correlationId: null,
  createdAt: '2026-09-01T10:00:00.000Z',
  updatedAt: '2026-09-01T10:00:00.000Z',
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useActivityProposal', () => {
  it("charge l'activité via GET /activities/:activityId", async () => {
    mockFetchScheduledActivity.mockResolvedValue(ACTIVITY)

    const { result } = renderHook(() => useActivityProposal('activity-1'))

    await waitFor(() => expect(result.current.activity).toEqual(ACTIVITY))
    expect(mockFetchScheduledActivity).toHaveBeenCalledWith('activity-1')
  })

  it("n'appelle rien tant que l'id est absent", async () => {
    const { result } = renderHook(() => useActivityProposal(undefined))
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(mockFetchScheduledActivity).not.toHaveBeenCalled()
  })

  it("accept réaffiche la réponse serveur, jamais un état optimiste", async () => {
    mockFetchScheduledActivity.mockResolvedValue(ACTIVITY)
    const confirmed = { ...ACTIVITY, status: 'confirmed' as const }
    mockAcceptActivity.mockResolvedValue(confirmed)

    const { result } = renderHook(() => useActivityProposal('activity-1'))
    await waitFor(() => expect(result.current.activity).toEqual(ACTIVITY))

    await act(async () => {
      await result.current.respond('accept')
    })

    expect(mockAcceptActivity).toHaveBeenCalledWith('activity-1')
    expect(result.current.activity).toEqual(confirmed)
  })

  it('decline réaffiche la réponse serveur', async () => {
    mockFetchScheduledActivity.mockResolvedValue(ACTIVITY)
    const cancelled = { ...ACTIVITY, status: 'cancelled' as const }
    mockDeclineActivity.mockResolvedValue(cancelled)

    const { result } = renderHook(() => useActivityProposal('activity-1'))
    await waitFor(() => expect(result.current.activity).toEqual(ACTIVITY))

    await act(async () => {
      await result.current.respond('decline')
    })

    expect(mockDeclineActivity).toHaveBeenCalledWith('activity-1')
    expect(result.current.activity).toEqual(cancelled)
  })

  it('un 409 (déjà traité) devient un message générique français', async () => {
    mockFetchScheduledActivity.mockResolvedValue(ACTIVITY)
    mockAcceptActivity.mockRejectedValue({ response: { status: 409 } })

    const { result } = renderHook(() => useActivityProposal('activity-1'))
    await waitFor(() => expect(result.current.activity).toEqual(ACTIVITY))

    await act(async () => {
      await result.current.respond('accept')
    })

    expect(result.current.respondError).toBe(
      'Cette action entre en conflit avec une donnée existante.',
    )
    // Le statut affiché reste celui du serveur, jamais modifié localement en échec.
    expect(result.current.activity).toEqual(ACTIVITY)
  })
})
