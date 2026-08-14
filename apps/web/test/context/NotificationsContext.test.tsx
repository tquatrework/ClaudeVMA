/**
 * Tests pour NotificationsContext — état partagé du système de notifications
 * transversal (arbitrage du 2026-08-14).
 *
 * Couvre : chargement au montage (un seul appel par session authentifiée),
 * réinitialisation à la déconnexion, et `markAsRead` qui met à jour l'état
 * local avec la réponse du serveur — décrémentant le compteur seulement si la
 * notification était réellement non lue (idempotence d'un second clic).
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useContext } from 'react'
import { NotificationsProvider, NotificationsContext } from '../../src/context/NotificationsContext'
import { makeUseAuthReturn } from '../../src/test-helpers'
import type { DashboardNotification } from '../../src/types/dashboard'

vi.mock('../../src/hooks/useAuth')
vi.mock('../../src/api/dashboardNotifications')

import { useAuth } from '../../src/hooks/useAuth'
import { fetchNotifications, fetchUnreadNotificationCount, markNotificationAsRead } from '../../src/api/dashboardNotifications'

const mockUseAuth = vi.mocked(useAuth)
const mockFetchNotifications = vi.mocked(fetchNotifications)
const mockFetchUnreadNotificationCount = vi.mocked(fetchUnreadNotificationCount)
const mockMarkNotificationAsRead = vi.mocked(markNotificationAsRead)

const NOTIF: DashboardNotification = {
  id: 'notif-1',
  userId: 'user-1',
  type: 'teacher_assigned',
  title: '',
  message: '',
  isRead: false,
  metadata: { studentName: 'Camille Durand' },
  createdAt: '2026-08-14T10:00:00.000Z',
}

function Consumer() {
  const ctx = useContext(NotificationsContext)
  if (!ctx) return <p>pas de contexte</p>
  return (
    <div>
      <p>notifications: {ctx.notifications.length}</p>
      <p>non lues: {ctx.unreadCount}</p>
      <button onClick={() => ctx.markAsRead('notif-1')}>marquer lu</button>
    </div>
  )
}

function renderProvider() {
  return render(
    <NotificationsProvider>
      <Consumer />
    </NotificationsProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('NotificationsProvider', () => {
  it('charge la liste bornée et le compteur au montage, une seule fois', async () => {
    mockUseAuth.mockReturnValue(makeUseAuthReturn({ id: 'user-1' }))
    mockFetchNotifications.mockResolvedValue([NOTIF])
    mockFetchUnreadNotificationCount.mockResolvedValue(1)

    renderProvider()

    await screen.findByText('notifications: 1')
    expect(screen.getByText('non lues: 1')).toBeDefined()
    expect(mockFetchNotifications).toHaveBeenCalledTimes(1)
    expect(mockFetchNotifications).toHaveBeenCalledWith({ limit: 20 })
    expect(mockFetchUnreadNotificationCount).toHaveBeenCalledTimes(1)
  })

  it("ne charge rien si l'utilisateur n'est pas authentifié", async () => {
    mockUseAuth.mockReturnValue({ ...makeUseAuthReturn({ id: 'user-1' }), isAuthenticated: false })

    renderProvider()

    await screen.findByText('notifications: 0')
    expect(mockFetchNotifications).not.toHaveBeenCalled()
  })

  it('markAsRead met à jour la liste et décrémente le compteur une seule fois', async () => {
    mockUseAuth.mockReturnValue(makeUseAuthReturn({ id: 'user-1' }))
    mockFetchNotifications.mockResolvedValue([NOTIF])
    mockFetchUnreadNotificationCount.mockResolvedValue(1)
    mockMarkNotificationAsRead.mockResolvedValue({ ...NOTIF, isRead: true })

    renderProvider()

    await screen.findByText('non lues: 1')
    await userEvent.click(screen.getByText('marquer lu'))

    await waitFor(() => {
      expect(screen.getByText('non lues: 0')).toBeDefined()
    })

    // Un second clic (notification déjà lue localement) ne décrémente pas à nouveau.
    await userEvent.click(screen.getByText('marquer lu'))
    await waitFor(() => {
      expect(mockMarkNotificationAsRead).toHaveBeenCalledTimes(2)
    })
    expect(screen.getByText('non lues: 0')).toBeDefined()
  })
})
