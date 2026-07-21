/**
 * Tests pour ProfesseurDashboardPage (dashboard-notification-service / calendar-service)
 *
 * Couvre :
 * - Chargement puis affichage du prochain cours
 * - État vide (aucun cours planifié)
 * - Notifications affichées via ActivityFeed
 * - Liste "Cette semaine" des cours suivants
 */

import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ProfesseurDashboardPage from '../../src/pages/ProfesseurDashboardPage'

vi.mock('../../src/hooks/useAuth')
vi.mock('../../src/api/calendar')
vi.mock('../../src/api/dashboardNotifications')

import { useAuth } from '../../src/hooks/useAuth'
import { fetchUserEvents } from '../../src/api/calendar'
import { fetchNotifications } from '../../src/api/dashboardNotifications'

const mockUseAuth = vi.mocked(useAuth)
const mockFetchUserEvents = vi.mocked(fetchUserEvents)
const mockFetchNotifications = vi.mocked(fetchNotifications)

const TEACHER_USER = {
  id: 'teacher-1',
  loginIdentifier: 'prof1',
  email: 'prof@test.com',
  role: 'formateur' as const,
  validationStatus: 'active' as const,
}

function buildAuthMock() {
  return {
    user: TEACHER_USER,
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    hasRole: vi.fn(() => true),
    isInternalRole: vi.fn(() => false),
  }
}

function renderDashboard() {
  return render(
    <MemoryRouter>
      <ProfesseurDashboardPage />
    </MemoryRouter>,
  )
}

const FUTURE_ISO_1 = new Date(Date.now() + 86400000).toISOString()
const FUTURE_ISO_2 = new Date(Date.now() + 172800000).toISOString()
const FUTURE_ISO_3 = new Date(Date.now() + 259200000).toISOString()

beforeEach(() => {
  vi.clearAllMocks()
  mockUseAuth.mockReturnValue(buildAuthMock())
  mockFetchNotifications.mockResolvedValue([])
  mockFetchUserEvents.mockResolvedValue([])
})

describe('ProfesseurDashboardPage — prochain cours', () => {
  it('affiche le prochain cours après chargement', async () => {
    mockFetchUserEvents.mockResolvedValue([
      { id: 'evt-1', title: 'Cours de géométrie', startAt: FUTURE_ISO_1, endAt: FUTURE_ISO_2 },
    ])

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByText('Cours de géométrie')).toBeDefined()
    })

    expect(mockFetchUserEvents).toHaveBeenCalledWith('teacher-1')
  })

  it('affiche un état vide quand aucun cours n\'est planifié', async () => {
    renderDashboard()

    await waitFor(() => {
      expect(screen.getByText('Aucun cours planifié')).toBeDefined()
    })
  })

  it('affiche la liste des cours suivants dans "Cette semaine"', async () => {
    mockFetchUserEvents.mockResolvedValue([
      { id: 'evt-1', title: 'Cours de géométrie', startAt: FUTURE_ISO_1, endAt: FUTURE_ISO_2 },
      { id: 'evt-2', title: 'Cours d\'algèbre', startAt: FUTURE_ISO_2, endAt: FUTURE_ISO_3 },
    ])

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByText('Cours d\'algèbre')).toBeDefined()
    })
  })
})

describe('ProfesseurDashboardPage — notifications', () => {
  it('affiche les notifications récentes', async () => {
    mockFetchNotifications.mockResolvedValue([
      { id: 'notif-1', message: 'Nouvelle demande professeur', read: false, createdAt: FUTURE_ISO_1 },
    ])

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByText('Nouvelle demande professeur')).toBeDefined()
    })
  })
})
