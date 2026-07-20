/**
 * Tests pour ApDashboardPage (dashboard-notification-service)
 *
 * Couvre :
 * - Chargement puis affichage des notifications récentes
 * - État vide (aucune notification)
 */

import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ApDashboardPage from '../../src/pages/ApDashboardPage'

vi.mock('../../src/hooks/useAuth')
vi.mock('../../src/api/dashboardNotifications')

import { useAuth } from '../../src/hooks/useAuth'
import { fetchNotifications } from '../../src/api/dashboardNotifications'

const mockUseAuth = vi.mocked(useAuth)
const mockFetchNotifications = vi.mocked(fetchNotifications)

const AP_USER = {
  id: 'ap-1',
  loginIdentifier: 'ap1',
  email: 'ap@test.com',
  role: 'animateur_pedagogique' as const,
  validationStatus: 'active' as const,
}

function buildAuthMock() {
  return {
    user: AP_USER,
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    hasRole: vi.fn(() => true),
    isInternalRole: vi.fn(() => true),
  }
}

function renderDashboard() {
  return render(
    <MemoryRouter>
      <ApDashboardPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUseAuth.mockReturnValue(buildAuthMock())
  mockFetchNotifications.mockResolvedValue([])
})

describe('ApDashboardPage — notifications', () => {
  it('affiche les notifications récentes après chargement', async () => {
    mockFetchNotifications.mockResolvedValue([
      { id: 'notif-1', message: 'Contenu en attente de validation', read: false, createdAt: new Date().toISOString() },
    ])

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByText('Contenu en attente de validation')).toBeDefined()
    })
  })

  it('affiche un état vide quand il n\'y a aucune activité récente', async () => {
    renderDashboard()

    await waitFor(() => {
      expect(screen.getByText('Aucune activité récente.')).toBeDefined()
    })
  })

  it('affiche le titre de la page pour un animateur pédagogique', async () => {
    renderDashboard()

    await waitFor(() => {
      expect(screen.getByText(/Animateur pédagogique — espace de coordination/i)).toBeDefined()
    })
  })
})
