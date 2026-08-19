import { renderHook, act, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../src/api/calendar')

import { createActivity } from '../../src/api/calendar'
import { useProposeCourseSlot } from '../../src/hooks/calendar/useProposeCourseSlot'

const mockCreateActivity = vi.mocked(createActivity)

const PAYLOAD = {
  type: 'cours' as const,
  participantIds: ['student-1'],
  startTime: '2026-09-10T14:00:00.000Z',
  endTime: '2026-09-10T15:00:00.000Z',
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useProposeCourseSlot', () => {
  it('soumet la proposition et renvoie l’activité créée', async () => {
    const created = { id: 'activity-1', status: 'proposed' as const, ...PAYLOAD }
    mockCreateActivity.mockResolvedValue(created as never)

    const { result } = renderHook(() => useProposeCourseSlot())

    let outcome: unknown
    await act(async () => {
      outcome = await result.current.submit(PAYLOAD)
    })

    expect(mockCreateActivity).toHaveBeenCalledWith(PAYLOAD)
    expect(outcome).toEqual(created)
    expect(result.current.errorMessage).toBeNull()
  })

  it("traduit un 403 (lien absent) en message générique français", async () => {
    mockCreateActivity.mockRejectedValue({ response: { status: 403 } })

    const { result } = renderHook(() => useProposeCourseSlot())

    let outcome: unknown
    await act(async () => {
      outcome = await result.current.submit(PAYLOAD)
    })

    expect(outcome).toBeNull()
    await waitFor(() => {
      expect(result.current.errorMessage).toBe("Vous n'êtes pas autorisé à effectuer cette action.")
    })
  })

  it('isSubmitting bascule pendant la soumission', async () => {
    let resolvePromise: (value: unknown) => void = () => {}
    mockCreateActivity.mockReturnValue(
      new Promise((resolve) => {
        resolvePromise = resolve
      }) as never,
    )

    const { result } = renderHook(() => useProposeCourseSlot())

    let submitPromise: Promise<unknown>
    act(() => {
      submitPromise = result.current.submit(PAYLOAD)
    })

    await waitFor(() => expect(result.current.isSubmitting).toBe(true))

    await act(async () => {
      resolvePromise({ id: 'activity-1', ...PAYLOAD })
      await submitPromise
    })

    expect(result.current.isSubmitting).toBe(false)
  })

  it('clearError efface le message affiché', async () => {
    mockCreateActivity.mockRejectedValue({ response: { status: 500 } })

    const { result } = renderHook(() => useProposeCourseSlot())

    await act(async () => {
      await result.current.submit(PAYLOAD)
    })
    await waitFor(() => expect(result.current.errorMessage).not.toBeNull())

    act(() => {
      result.current.clearError()
    })

    expect(result.current.errorMessage).toBeNull()
  })
})
