/**
 * Tests pour NotificationBell — cloche + menu déroulant des notifications
 * récentes (système de notifications transversal, arbitrage du 2026-08-14).
 *
 * Couvre : badge de compteur (masqué si 0), ouverture/fermeture du menu,
 * marquage lu au clic sans fermer le menu, lien "Tout voir", et le repli sûr
 * en l'absence de `<NotificationsProvider>`.
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NotificationBell } from '../../../src/components/layout/NotificationBell'
import { NotificationsContext, type NotificationsState } from '../../../src/context/NotificationsContext'
import { makeUseAuthReturn } from '../../../src/test-helpers'
import type { DashboardNotification } from '../../../src/types/dashboard'

vi.mock('../../../src/hooks/useAuth')

import { useAuth } from '../../../src/hooks/useAuth'

const mockUseAuth = vi.mocked(useAuth)

const NOTIF_UNREAD: DashboardNotification = {
  id: 'notif-1',
  userId: 'user-1',
  type: 'teacher_assigned',
  title: '',
  message: '',
  isRead: false,
  metadata: { studentName: 'Camille Durand' },
  createdAt: '2026-08-14T10:00:00.000Z',
}

function renderBell(contextValue: NotificationsState | null) {
  const tree = (
    <MemoryRouter>
      <NotificationBell />
    </MemoryRouter>
  )
  if (contextValue === null) {
    return render(tree)
  }
  return render(
    <NotificationsContext.Provider value={contextValue}>{tree}</NotificationsContext.Provider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUseAuth.mockReturnValue(makeUseAuthReturn({ id: 'user-1', role: 'eleve' }))
})

describe('NotificationBell', () => {
  it("ne se plante pas sans <NotificationsProvider> (repli inerte)", () => {
    renderBell(null)

    expect(screen.getByRole('button', { name: 'Notifications' })).toBeDefined()
  })

  it('masque le badge quand aucune notification non lue', () => {
    renderBell({ notifications: [], unreadCount: 0, isLoading: false, loadError: null, markAsRead: vi.fn() })

    expect(screen.queryByText('0')).toBeNull()
  })

  it('affiche le badge de compteur quand des notifications sont non lues', () => {
    renderBell({
      notifications: [NOTIF_UNREAD],
      unreadCount: 3,
      isLoading: false,
      loadError: null,
      markAsRead: vi.fn(),
    })

    expect(screen.getByText('3')).toBeDefined()
  })

  it('ouvre le menu au clic et affiche les notifications récentes', async () => {
    renderBell({
      notifications: [NOTIF_UNREAD],
      unreadCount: 1,
      isLoading: false,
      loadError: null,
      markAsRead: vi.fn(),
    })

    await userEvent.click(screen.getByRole('button', { name: /notifications/i }))

    expect(screen.getByText('Un professeur a été trouvé pour Camille Durand')).toBeDefined()
    expect(screen.getByRole('link', { name: 'Tout voir' }).getAttribute('href')).toBe('/notifications')
  })

  it('marque une notification comme lue au clic, sans fermer le menu', async () => {
    const markAsRead = vi.fn().mockResolvedValue({ ...NOTIF_UNREAD, isRead: true })
    renderBell({
      notifications: [NOTIF_UNREAD],
      unreadCount: 1,
      isLoading: false,
      loadError: null,
      markAsRead,
    })

    await userEvent.click(screen.getByRole('button', { name: /notifications/i }))
    await userEvent.click(screen.getByText('Un professeur a été trouvé pour Camille Durand'))

    await waitFor(() => {
      expect(markAsRead).toHaveBeenCalledWith('notif-1')
    })
    // Le menu reste ouvert : la ligne cliquée est toujours visible.
    expect(screen.getByText('Un professeur a été trouvé pour Camille Durand')).toBeDefined()
  })

  it("affiche un état vide explicite quand il n'y a aucune notification récente", async () => {
    renderBell({ notifications: [], unreadCount: 0, isLoading: false, loadError: null, markAsRead: vi.fn() })

    await userEvent.click(screen.getByRole('button', { name: /notifications/i }))

    expect(screen.getByText("Aucune notification pour l'instant.")).toBeDefined()
  })
})
