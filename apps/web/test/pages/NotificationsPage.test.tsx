/**
 * Tests pour NotificationsPage — historique paginé des notifications
 * (`GET /notifications`, dashboard-notification-service).
 *
 * Couvre : chargement, erreur, état vide, succès (libellé résolu depuis le
 * dictionnaire), pagination, et marquage lu qui remonte au contexte partagé
 * sans ré-appeler la liste.
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import NotificationsPage from '../../src/pages/NotificationsPage'
import { makeUseAuthReturn } from '../../src/test-helpers'
import type { DashboardNotification } from '../../src/types/dashboard'

vi.mock('../../src/hooks/useAuth')
vi.mock('../../src/hooks/useNotifications')
vi.mock('../../src/api/dashboardNotifications')

import { useAuth } from '../../src/hooks/useAuth'
import { useNotifications } from '../../src/hooks/useNotifications'
import { fetchNotificationsPage } from '../../src/api/dashboardNotifications'

const mockUseAuth = vi.mocked(useAuth)
const mockUseNotifications = vi.mocked(useNotifications)
const mockFetchNotificationsPage = vi.mocked(fetchNotificationsPage)

const mockMarkAsRead = vi.fn()

const NOTIF_UNREAD: DashboardNotification = {
  id: 'notif-1',
  userId: 'user-1',
  type: 'teacher_assigned',
  title: '',
  message: 'fallback message',
  isRead: false,
  metadata: { studentName: 'Camille Durand' },
  createdAt: '2026-08-14T10:00:00.000Z',
}

const NOTIF_READ: DashboardNotification = {
  id: 'notif-2',
  userId: 'user-1',
  type: 'teacher_request_created',
  title: '',
  message: 'fallback message 2',
  isRead: true,
  metadata: { studentName: 'Camille Durand' },
  createdAt: '2026-08-13T10:00:00.000Z',
}

function buildPage(data: DashboardNotification[], overrides: Partial<Record<string, number>> = {}) {
  return { data, page: 1, limit: 20, total: data.length, totalPages: 1, ...overrides }
}

function renderPage() {
  return render(
    <MemoryRouter>
      <NotificationsPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUseAuth.mockReturnValue(makeUseAuthReturn({ id: 'user-1', role: 'eleve' }))
  mockUseNotifications.mockReturnValue({
    notifications: [],
    unreadCount: 0,
    isLoading: false,
    loadError: null,
    markAsRead: mockMarkAsRead,
  })
})

describe('NotificationsPage', () => {
  it('affiche un état de chargement pendant la lecture', () => {
    mockFetchNotificationsPage.mockReturnValue(new Promise(() => {}))

    renderPage()

    expect(screen.getByText('Chargement…')).toBeDefined()
  })

  it('affiche un état vide explicite quand il n\'y a aucune notification', async () => {
    mockFetchNotificationsPage.mockResolvedValue(buildPage([]))

    renderPage()

    await screen.findByText("Aucune notification pour l'instant.")
  })

  it('affiche le message du serveur en cas d\'échec de chargement', async () => {
    mockFetchNotificationsPage.mockRejectedValue({
      response: { status: 500 },
    })

    renderPage()

    await screen.findByText(/serveur rencontre un problème/i)
  })

  it('affiche les notifications avec le libellé résolu par le dictionnaire', async () => {
    mockFetchNotificationsPage.mockResolvedValue(buildPage([NOTIF_UNREAD, NOTIF_READ]))

    renderPage()

    await screen.findByText('Un professeur a été trouvé pour Camille Durand')
    expect(screen.getByText('Nouvelle demande de professeur pour Camille Durand')).toBeDefined()
    // Le message brut du serveur n'est utilisé qu'en repli, jamais affiché ici :
    expect(screen.queryByText('fallback message')).toBeNull()
  })

  it('annonce le nombre total de notifications', async () => {
    mockFetchNotificationsPage.mockResolvedValue(buildPage([NOTIF_UNREAD], { total: 5 }))

    renderPage()

    await screen.findByText('5 notifications au total')
  })

  it('marque une notification non lue comme lue au clic, sans recharger la liste', async () => {
    mockFetchNotificationsPage.mockResolvedValue(buildPage([NOTIF_UNREAD]))
    mockMarkAsRead.mockResolvedValue({ ...NOTIF_UNREAD, isRead: true })

    renderPage()

    const row = await screen.findByText('Un professeur a été trouvé pour Camille Durand')
    await userEvent.click(row)

    await waitFor(() => {
      expect(mockMarkAsRead).toHaveBeenCalledWith('notif-1')
    })
    expect(mockFetchNotificationsPage).toHaveBeenCalledTimes(1)
  })

  it('ne rappelle pas markAsRead pour une notification déjà lue', async () => {
    mockFetchNotificationsPage.mockResolvedValue(buildPage([NOTIF_READ]))

    renderPage()

    const row = await screen.findByText('Nouvelle demande de professeur pour Camille Durand')
    await userEvent.click(row)

    expect(mockMarkAsRead).not.toHaveBeenCalled()
  })

  it('pagine et demande la page suivante au serveur', async () => {
    mockFetchNotificationsPage.mockResolvedValue(
      buildPage([NOTIF_UNREAD], { total: 40, totalPages: 2, page: 1 }),
    )

    renderPage()

    await screen.findByText('Un professeur a été trouvé pour Camille Durand')
    expect(screen.getByText('Page 1 sur 2')).toBeDefined()

    mockFetchNotificationsPage.mockResolvedValue(
      buildPage([NOTIF_READ], { total: 40, totalPages: 2, page: 2 }),
    )
    await userEvent.click(screen.getByRole('button', { name: /page suivante/i }))

    await waitFor(() => {
      expect(mockFetchNotificationsPage).toHaveBeenLastCalledWith({ page: 2, limit: 20 })
    })
    await screen.findByText('Nouvelle demande de professeur pour Camille Durand')
  })
})
