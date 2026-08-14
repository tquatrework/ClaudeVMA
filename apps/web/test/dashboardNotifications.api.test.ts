/**
 * Tests du module API — dashboard-notification-service, système de
 * notifications transversal (arbitrage du 2026-08-14).
 *
 * Contrat : `GET /notifications?page=&limit=&isRead=`, `GET /notifications/unread-count`,
 * `POST /notifications/:notificationId/read`.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../src/api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}))

import apiClient from '../src/api/client'
import {
  fetchNotifications,
  fetchNotificationsPage,
  fetchUnreadNotificationCount,
  markNotificationAsRead,
} from '../src/api/dashboardNotifications'

const mockGet = vi.mocked(apiClient.get)
const mockPost = vi.mocked(apiClient.post)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('fetchNotifications', () => {
  it('appelle GET /notifications et normalise une enveloppe en tableau', async () => {
    mockGet.mockResolvedValue({
      data: { data: [{ id: 'n1' }], page: 1, limit: 20, total: 1, totalPages: 1 },
    })

    const notifications = await fetchNotifications({ limit: 20 })

    expect(mockGet).toHaveBeenCalledWith('/notifications', { params: { limit: 20 } })
    expect(notifications).toEqual([{ id: 'n1' }])
  })

  it('normalise aussi un tableau nu', async () => {
    mockGet.mockResolvedValue({ data: [{ id: 'n1' }] })

    const notifications = await fetchNotifications()

    expect(notifications).toEqual([{ id: 'n1' }])
  })
})

describe('fetchNotificationsPage', () => {
  it("renvoie l'enveloppe telle quelle, sans la confondre avec un tableau", async () => {
    mockGet.mockResolvedValue({
      data: { data: [{ id: 'n1' }], page: 2, limit: 20, total: 42, totalPages: 3 },
    })

    const page = await fetchNotificationsPage({ page: 2, limit: 20 })

    expect(mockGet).toHaveBeenCalledWith('/notifications', { params: { page: 2, limit: 20 } })
    expect(page.total).toBe(42)
    expect(page.totalPages).toBe(3)
    expect(page.data).toHaveLength(1)
  })
})

describe('fetchUnreadNotificationCount', () => {
  it('appelle GET /notifications/unread-count et renvoie le compteur', async () => {
    mockGet.mockResolvedValue({ data: { count: 7 } })

    const count = await fetchUnreadNotificationCount()

    expect(mockGet).toHaveBeenCalledWith('/notifications/unread-count')
    expect(count).toBe(7)
  })
})

describe('markNotificationAsRead', () => {
  it('appelle POST /notifications/:id/read et renvoie la notification à jour', async () => {
    mockPost.mockResolvedValue({ data: { id: 'n1', isRead: true } })

    const updated = await markNotificationAsRead('n1')

    expect(mockPost).toHaveBeenCalledWith('/notifications/n1/read')
    expect(updated).toEqual({ id: 'n1', isRead: true })
  })
})
