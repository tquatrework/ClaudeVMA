/**
 * Tests de useLinkedCalendarBusyFree.
 *
 * Trois familles d'échec distinctes (docs/routes.md § calendar-service > "Visibilité
 * busy/free") : `403` (aucune relation n'ouvre ce calendrier), `503` (profile-service
 * injoignable côté calendar-service) et tout le reste. Les trois se traduisent en un message
 * générique en français, sans UUID ni détail technique — jamais le message brut du serveur.
 */

import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useLinkedCalendarBusyFree } from '../../src/hooks/calendar/useLinkedCalendarBusyFree'

vi.mock('../../src/api/calendar')

import { fetchLinkedCalendarBusyFree } from '../../src/api/calendar'

const mockFetchLinkedCalendarBusyFree = vi.mocked(fetchLinkedCalendarBusyFree)

const OWNER_ID = 'owner-1'
const FROM = '2026-09-10T00:00:00Z'
const TO = '2026-09-17T00:00:00Z'

const BUSY_FREE_RESPONSE = {
  ownerId: OWNER_ID,
  from: '2026-09-10T00:00:00.000Z',
  to: '2026-09-17T00:00:00.000Z',
  availableWindows: [{ start: '2026-09-10T09:00:00.000Z', end: '2026-09-10T11:00:00.000Z' }],
  unavailableBlocks: [{ start: '2026-09-11T09:00:00.000Z', end: '2026-09-11T10:00:00.000Z' }],
  busyBlocks: [{ start: '2026-09-13T09:00:00.000Z', end: '2026-09-13T10:00:00.000Z' }],
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useLinkedCalendarBusyFree — succès', () => {
  it('charge le calendrier busy/free et propage from/to tels que fournis', async () => {
    mockFetchLinkedCalendarBusyFree.mockResolvedValue(BUSY_FREE_RESPONSE)

    const { result } = renderHook(() => useLinkedCalendarBusyFree(OWNER_ID, FROM, TO))

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    expect(result.current.data).toEqual(BUSY_FREE_RESPONSE)
    expect(result.current.error).toBeNull()
    expect(result.current.errorKind).toBeNull()
    expect(mockFetchLinkedCalendarBusyFree).toHaveBeenCalledWith(OWNER_ID, FROM, TO)
  })

  it("n'appelle rien tant qu'aucun titulaire n'est identifié", async () => {
    const { result } = renderHook(() => useLinkedCalendarBusyFree(undefined, FROM, TO))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    expect(result.current.data).toBeNull()
    expect(mockFetchLinkedCalendarBusyFree).not.toHaveBeenCalled()
  })
})

describe('useLinkedCalendarBusyFree — erreur 403 (refus de lien)', () => {
  it('renvoie un message générique en français, jamais le détail du serveur', async () => {
    mockFetchLinkedCalendarBusyFree.mockRejectedValue({
      response: { status: 403, data: { message: 'No relation opens calendar owner-1 to viewer-2' } },
    })

    const { result } = renderHook(() => useLinkedCalendarBusyFree(OWNER_ID, FROM, TO))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    expect(result.current.errorKind).toBe('access_denied')
    expect(result.current.error).toMatch(/pas accès au calendrier/i)
    expect(result.current.error).not.toMatch(/owner-1|viewer-2/)
    expect(result.current.data).toBeNull()
  })
})

describe('useLinkedCalendarBusyFree — erreur 503 (service injoignable)', () => {
  it('renvoie un message générique de service indisponible', async () => {
    mockFetchLinkedCalendarBusyFree.mockRejectedValue({ response: { status: 503 } })

    const { result } = renderHook(() => useLinkedCalendarBusyFree(OWNER_ID, FROM, TO))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    expect(result.current.errorKind).toBe('service_unavailable')
    expect(result.current.error).toMatch(/temporairement indisponible/i)
    expect(result.current.data).toBeNull()
  })
})

describe('useLinkedCalendarBusyFree — autre erreur', () => {
  it('classe tout le reste en "other" avec un message générique', async () => {
    mockFetchLinkedCalendarBusyFree.mockRejectedValue({ response: { status: 500 } })

    const { result } = renderHook(() => useLinkedCalendarBusyFree(OWNER_ID, FROM, TO))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    expect(result.current.errorKind).toBe('other')
    expect(result.current.error).not.toBeNull()
    expect(result.current.data).toBeNull()
  })

  it('classe une erreur réseau (sans réponse) en "other"', async () => {
    mockFetchLinkedCalendarBusyFree.mockRejectedValue({ request: {} })

    const { result } = renderHook(() => useLinkedCalendarBusyFree(OWNER_ID, FROM, TO))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    expect(result.current.errorKind).toBe('other')
    expect(result.current.error).toMatch(/impossible de contacter le serveur/i)
  })
})
