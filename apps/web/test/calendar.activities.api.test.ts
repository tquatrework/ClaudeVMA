/**
 * Contrat HTTP des fonctions d'activités planifiées de `src/api/calendar.ts`
 * (chantier calendrier de disponibilités, point 3 — docs/routes.md § calendar-service >
 * "Activités planifiées").
 *
 * `fetchActivity`/`updateActivity`/`deleteActivity` appelaient `/calendar/:id`, qui 404 —
 * corrigées vers `/activities/:activityId`. `createActivity`/`fetchScheduledActivity`/
 * `acceptActivity`/`declineActivity` sont nouvelles.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../src/api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}))

import apiClient from '../src/api/client'
import {
  acceptActivity,
  createActivity,
  declineActivity,
  deleteActivity,
  fetchActivity,
  fetchScheduledActivity,
  updateActivity,
} from '../src/api/calendar'

const mockGet = vi.mocked(apiClient.get)
const mockPost = vi.mocked(apiClient.post)
const mockPut = vi.mocked(apiClient.put)
const mockDelete = vi.mocked(apiClient.delete)

const ACTIVITY_ID = 'activity-1'

const SCHEDULED_ACTIVITY = {
  id: ACTIVITY_ID,
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

describe('fetchActivity', () => {
  it('GET /activities/:activityId, traduit vers la représentation front historique', async () => {
    mockGet.mockResolvedValue({ data: SCHEDULED_ACTIVITY })

    const result = await fetchActivity(ACTIVITY_ID)

    expect(mockGet).toHaveBeenCalledWith(`/activities/${ACTIVITY_ID}`)
    expect(result).toEqual({
      id: ACTIVITY_ID,
      title: 'Cours de géométrie',
      startAt: SCHEDULED_ACTIVITY.startTime,
      endAt: SCHEDULED_ACTIVITY.endTime,
      type: 'cours',
      status: 'proposed',
      studentId: 'student-1',
      teacherId: 'teacher-1',
    })
  })
})

describe('updateActivity', () => {
  it('PUT /activities/:activityId (pas PATCH)', async () => {
    mockPut.mockResolvedValue({ data: { ...SCHEDULED_ACTIVITY, title: 'Nouveau titre' } })

    const result = await updateActivity(ACTIVITY_ID, { title: 'Nouveau titre' })

    expect(mockPut).toHaveBeenCalledWith(`/activities/${ACTIVITY_ID}`, { title: 'Nouveau titre' })
    expect(result.title).toBe('Nouveau titre')
  })
})

describe('deleteActivity', () => {
  it('DELETE /activities/:activityId', async () => {
    mockDelete.mockResolvedValue({ data: undefined })

    await deleteActivity(ACTIVITY_ID)

    expect(mockDelete).toHaveBeenCalledWith(`/activities/${ACTIVITY_ID}`)
  })
})

describe('createActivity', () => {
  it('POST /activities avec le corps exact', async () => {
    mockPost.mockResolvedValue({ data: SCHEDULED_ACTIVITY })

    const payload = {
      type: 'cours' as const,
      participantIds: ['student-1'],
      startTime: '2026-09-10T14:00:00.000Z',
      endTime: '2026-09-10T15:00:00.000Z',
      title: 'Cours de géométrie',
    }

    const result = await createActivity(payload)

    expect(mockPost).toHaveBeenCalledWith('/activities', payload)
    expect(result).toEqual(SCHEDULED_ACTIVITY)
  })
})

describe('fetchScheduledActivity', () => {
  it('GET /activities/:activityId, sans traduction', async () => {
    mockGet.mockResolvedValue({ data: SCHEDULED_ACTIVITY })

    const result = await fetchScheduledActivity(ACTIVITY_ID)

    expect(mockGet).toHaveBeenCalledWith(`/activities/${ACTIVITY_ID}`)
    expect(result).toEqual(SCHEDULED_ACTIVITY)
  })
})

describe('acceptActivity', () => {
  it('POST /activities/:activityId/accept, aucun corps', async () => {
    mockPost.mockResolvedValue({ data: { ...SCHEDULED_ACTIVITY, status: 'confirmed' } })

    const result = await acceptActivity(ACTIVITY_ID)

    expect(mockPost).toHaveBeenCalledWith(`/activities/${ACTIVITY_ID}/accept`)
    expect(result.status).toBe('confirmed')
  })
})

describe('declineActivity', () => {
  it('POST /activities/:activityId/decline, aucun corps', async () => {
    mockPost.mockResolvedValue({ data: { ...SCHEDULED_ACTIVITY, status: 'cancelled' } })

    const result = await declineActivity(ACTIVITY_ID)

    expect(mockPost).toHaveBeenCalledWith(`/activities/${ACTIVITY_ID}/decline`)
    expect(result.status).toBe('cancelled')
  })
})
