/**
 * Tests de usePedagogicalArchives.
 *
 * La distinction qui compte : un `404` est un **état vide** (absence d'archive et
 * refus par absence de relation y répondent le même message, volontairement
 * indiscernables), tandis qu'un `503` ou un `500` est une **erreur** à montrer.
 * C'est cette confusion qui avait laissé croire pendant des semaines que des
 * routes montées sur le mauvais préfixe renvoyaient « aucune archive ».
 */

import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { usePedagogicalArchives } from '../../src/hooks/archive/usePedagogicalArchives'
import { COURSE_SUMMARY_ITEM, STUDENT_ID, TIMELINE_GROUPS, paginate } from '../fixtures/archives'

vi.mock('../../src/api/archiveDocument')

import { fetchArchiveTimeline, fetchPedagogicalArchives } from '../../src/api/archiveDocument'

const mockFetchPedagogicalArchives = vi.mocked(fetchPedagogicalArchives)
const mockFetchArchiveTimeline = vi.mocked(fetchArchiveTimeline)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('usePedagogicalArchives', () => {
  it("déballe l'enveloppe paginée des deux routes", async () => {
    mockFetchPedagogicalArchives.mockResolvedValue(paginate([COURSE_SUMMARY_ITEM]))
    mockFetchArchiveTimeline.mockResolvedValue(paginate(TIMELINE_GROUPS))

    const { result } = renderHook(() => usePedagogicalArchives(STUDENT_ID))

    await waitFor(() => {
      expect(result.current.archiveItems).toHaveLength(1)
    })
    expect(result.current.timelineGroups).toHaveLength(3)
    expect(result.current.error).toBeNull()
  })

  it('rend un état vide sans erreur sur 404', async () => {
    mockFetchPedagogicalArchives.mockRejectedValue({ response: { status: 404 } })
    mockFetchArchiveTimeline.mockRejectedValue({ response: { status: 404 } })

    const { result } = renderHook(() => usePedagogicalArchives(STUDENT_ID))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    expect(result.current.archiveItems).toEqual([])
    expect(result.current.error).toBeNull()
  })

  it('remonte une vraie erreur sur 503', async () => {
    mockFetchPedagogicalArchives.mockRejectedValue({ response: { status: 503 } })
    mockFetchArchiveTimeline.mockRejectedValue({ response: { status: 503 } })

    const { result } = renderHook(() => usePedagogicalArchives(STUDENT_ID))

    await waitFor(() => {
      expect(result.current.error).toMatch(/serveur rencontre un problème/i)
    })
  })

  it("n'appelle rien tant qu'aucune personne n'est identifiée", async () => {
    const { result } = renderHook(() => usePedagogicalArchives(''))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    expect(mockFetchPedagogicalArchives).not.toHaveBeenCalled()
  })

  it('recharge quand la personne consultée change', async () => {
    mockFetchPedagogicalArchives.mockResolvedValue(paginate([COURSE_SUMMARY_ITEM]))
    mockFetchArchiveTimeline.mockResolvedValue(paginate(TIMELINE_GROUPS))

    const { rerender } = renderHook(({ userId }) => usePedagogicalArchives(userId), {
      initialProps: { userId: STUDENT_ID },
    })

    await waitFor(() => {
      expect(mockFetchPedagogicalArchives).toHaveBeenCalledWith(STUDENT_ID)
    })

    rerender({ userId: 'another-person-id' })

    await waitFor(() => {
      expect(mockFetchPedagogicalArchives).toHaveBeenCalledWith('another-person-id')
    })
  })
})
