/**
 * Contrat HTTP de `fetchLinkedCalendarBusyFree` (`src/api/calendar.ts`).
 *
 * `GET /calendars/:ownerId/busy?from=&to=` — docs/routes.md § calendar-service > "Visibilité
 * busy/free". `from`/`to` sont transmis tels que fournis par l'appelant (ISO 8601 avec fuseau,
 * avec ou sans millisecondes) ; la réponse, elle, est toujours normalisée par le serveur en ISO
 * 8601 UTC avec millisecondes — ce test ne fait que vérifier que le corps est relayé tel quel,
 * sans transformation côté front (contrairement aux créneaux de disponibilité, dont la
 * représentation front diffère du contrat serveur).
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
import { fetchLinkedCalendarBusyFree } from '../src/api/calendar'

const mockGet = vi.mocked(apiClient.get)

const OWNER_ID = 'owner-1'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('fetchLinkedCalendarBusyFree', () => {
  it('GET /calendars/:ownerId/busy avec from/to en query, réponse relayée telle quelle', async () => {
    const RESPONSE = {
      ownerId: OWNER_ID,
      from: '2026-09-10T00:00:00.000Z',
      to: '2026-09-17T00:00:00.000Z',
      availableWindows: [{ start: '2026-09-10T09:00:00.000Z', end: '2026-09-10T11:00:00.000Z' }],
      unavailableBlocks: [{ start: '2026-09-11T09:00:00.000Z', end: '2026-09-11T10:00:00.000Z' }],
      busyBlocks: [{ start: '2026-09-13T09:00:00.000Z', end: '2026-09-13T10:00:00.000Z' }],
    }
    mockGet.mockResolvedValue({ data: RESPONSE })

    const result = await fetchLinkedCalendarBusyFree(
      OWNER_ID,
      '2026-09-10T00:00:00Z',
      '2026-09-17T00:00:00Z',
    )

    expect(mockGet).toHaveBeenCalledWith(
      `/calendars/${OWNER_ID}/busy?from=2026-09-10T00%3A00%3A00Z&to=2026-09-17T00%3A00%3A00Z`,
    )
    expect(result).toEqual(RESPONSE)
  })
})
