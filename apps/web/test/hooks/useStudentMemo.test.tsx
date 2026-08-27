/**
 * Tests de useStudentMemo — chargement du mémo consolidé d'un élève.
 */

import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../src/api/pedagogicalLogMemos')

import { fetchStudentMemo } from '../../src/api/pedagogicalLogMemos'
import { useStudentMemo } from '../../src/hooks/pedagogical-log/useStudentMemo'

const mockFetchStudentMemo = vi.mocked(fetchStudentMemo)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useStudentMemo', () => {
  it('charge le mémo au montage et expose les chapitres', async () => {
    mockFetchStudentMemo.mockResolvedValue([
      {
        id: 'ch-1',
        studentId: 'student-1',
        title: 'Algèbre',
        order: 0,
        createdAt: '2026-08-27T00:00:00.000Z',
        updatedAt: '2026-08-27T00:00:00.000Z',
        items: [],
      },
    ])

    const { result } = renderHook(() => useStudentMemo('student-1'))

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.chapters).toHaveLength(1)
    expect(result.current.error).toBeNull()
    expect(mockFetchStudentMemo).toHaveBeenCalledWith('student-1')
  })

  it('traduit un 403 en message lisible', async () => {
    mockFetchStudentMemo.mockRejectedValue({ response: { status: 403 } })

    const { result } = renderHook(() => useStudentMemo('student-1'))

    await waitFor(() => {
      expect(result.current.error).toMatch(/accès/i)
    })
    expect(result.current.chapters).toBeNull()
  })

  it('ne charge rien si studentId est null', () => {
    const { result } = renderHook(() => useStudentMemo(null))

    expect(result.current.isLoading).toBe(false)
    expect(mockFetchStudentMemo).not.toHaveBeenCalled()
  })
})
