/**
 * Tests pour RpDashboardPage (dashboard-notification-service / teacher-request-service)
 *
 * Couvre :
 * - Compteur de demandes professeur en attente (GET /requests)
 * - Dégradation vers 0 en cas d'échec (comportement préexistant préservé)
 * - Notifications affichées via ActivityFeed
 */

import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import RpDashboardPage from '../../src/pages/RpDashboardPage'

vi.mock('../../src/hooks/useAuth')
vi.mock('../../src/api/teacherRequests')
vi.mock('../../src/api/dashboardNotifications')

import { useAuth } from '../../src/hooks/useAuth'
import { fetchTeacherRequestsForDashboard } from '../../src/api/teacherRequests'
import { fetchNotifications } from '../../src/api/dashboardNotifications'

const mockUseAuth = vi.mocked(useAuth)
const mockFetchTeacherRequestsForDashboard = vi.mocked(fetchTeacherRequestsForDashboard)
const mockFetchNotifications = vi.mocked(fetchNotifications)

const RP_USER = {
  id: 'rp-1',
  loginIdentifier: 'rp1',
  email: 'rp@test.com',
  role: 'responsable_pedagogique' as const,
  validationStatus: 'active' as const,
}

function buildAuthMock() {
  return {
    user: RP_USER,
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
      <RpDashboardPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUseAuth.mockReturnValue(buildAuthMock())
  mockFetchNotifications.mockResolvedValue([])
  mockFetchTeacherRequestsForDashboard.mockResolvedValue([])
})

describe('RpDashboardPage — demandes professeur en attente', () => {
  it('compte uniquement les demandes au statut pending', async () => {
    mockFetchTeacherRequestsForDashboard.mockResolvedValue([
      { id: 'req-1', status: 'pending', createdAt: new Date().toISOString() },
      { id: 'req-2', status: 'accepted', createdAt: new Date().toISOString() },
      { id: 'req-3', status: 'pending', createdAt: new Date().toISOString() },
    ])

    renderDashboard()

    await waitFor(() => {
      const matches = screen.getAllByText('2')
      expect(matches.length).toBeGreaterThan(0)
    })
  })

  it('retombe sur 0 (pas de message d\'erreur) en cas d\'échec de chargement', async () => {
    mockFetchTeacherRequestsForDashboard.mockRejectedValue({ response: { status: 500 } })

    renderDashboard()

    await waitFor(() => {
      const matches = screen.getAllByText('0')
      expect(matches.length).toBeGreaterThan(0)
    })
  })
})

describe('RpDashboardPage — notifications', () => {
  it('affiche les notifications récentes', async () => {
    mockFetchNotifications.mockResolvedValue([
      { id: 'notif-1', message: 'Compte à valider', read: false, createdAt: new Date().toISOString() },
    ])

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByText('Compte à valider')).toBeDefined()
    })
  })
})
