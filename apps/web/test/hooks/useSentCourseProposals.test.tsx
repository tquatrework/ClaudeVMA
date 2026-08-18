import { renderHook, act, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../src/api/calendar')

import { fetchScheduledActivity } from '../../src/api/calendar'
import { useSentCourseProposals } from '../../src/hooks/calendar/useSentCourseProposals'

const mockFetchScheduledActivity = vi.mocked(fetchScheduledActivity)

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
  window.localStorage.clear()
})

describe('useSentCourseProposals', () => {
  it("part d'une liste vide sans proposition envoyée", async () => {
    const { result } = renderHook(() => useSentCourseProposals('teacher-1'))
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.proposals).toEqual([])
    expect(mockFetchScheduledActivity).not.toHaveBeenCalled()
  })

  it('addProposal persiste l’identifiant puis recharge son statut réel', async () => {
    mockFetchScheduledActivity.mockResolvedValue(ACTIVITY)

    const { result } = renderHook(() => useSentCourseProposals('teacher-1'))
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => {
      result.current.addProposal(ACTIVITY)
    })

    await waitFor(() => expect(result.current.proposals).toEqual([ACTIVITY]))
    expect(mockFetchScheduledActivity).toHaveBeenCalledWith('activity-1')
  })

  it('les identifiants sont scopés par utilisateur (pas de fuite entre comptes)', async () => {
    mockFetchScheduledActivity.mockResolvedValue(ACTIVITY)

    const { result: teacherResult } = renderHook(() => useSentCourseProposals('teacher-1'))
    await waitFor(() => expect(teacherResult.current.isLoading).toBe(false))
    act(() => {
      teacherResult.current.addProposal(ACTIVITY)
    })
    await waitFor(() => expect(teacherResult.current.proposals).toEqual([ACTIVITY]))

    const { result: otherResult } = renderHook(() => useSentCourseProposals('teacher-2'))
    await waitFor(() => expect(otherResult.current.isLoading).toBe(false))
    expect(otherResult.current.proposals).toEqual([])
  })

  it('un identifiant devenu introuvable côté serveur est simplement omis, jamais une erreur bloquante', async () => {
    mockFetchScheduledActivity.mockRejectedValue({ response: { status: 404 } })

    const { result } = renderHook(() => useSentCourseProposals('teacher-1'))
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => {
      result.current.addProposal(ACTIVITY)
    })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.proposals).toEqual([])
    expect(result.current.loadError).toBeNull()
  })

  it("n'appelle rien sans utilisateur authentifié", async () => {
    const { result } = renderHook(() => useSentCourseProposals(undefined))
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(mockFetchScheduledActivity).not.toHaveBeenCalled()
  })
})
