/**
 * Tests pour EleveDashboardPage (dashboard-notification-service / calendar-service /
 * communication-service)
 *
 * Couvre :
 * - Chargement puis affichage du prochain cours
 * - État vide (aucun cours à venir → invite à demander un professeur)
 * - Détection du professeur principal parmi les contacts
 * - Notifications affichées via ActivityFeed
 */

import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import EleveDashboardPage from '../../src/pages/EleveDashboardPage'

vi.mock('../../src/hooks/useAuth')
vi.mock('../../src/api/calendar')
vi.mock('../../src/api/dashboardNotifications')
vi.mock('../../src/api/communication')

import { useAuth } from '../../src/hooks/useAuth'
import { fetchUserEvents } from '../../src/api/calendar'
import { fetchNotifications } from '../../src/api/dashboardNotifications'
import { fetchContacts } from '../../src/api/communication'

const mockUseAuth = vi.mocked(useAuth)
const mockFetchUserEvents = vi.mocked(fetchUserEvents)
const mockFetchNotifications = vi.mocked(fetchNotifications)
const mockFetchContacts = vi.mocked(fetchContacts)

const STUDENT_USER = {
  id: 'student-1',
  loginIdentifier: 'eleve1',
  email: 'eleve@test.com',
  role: 'eleve' as const,
  validationStatus: 'active' as const,
}

function buildAuthMock() {
  return {
    user: STUDENT_USER,
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
      <EleveDashboardPage />
    </MemoryRouter>,
  )
}

const FUTURE_ISO_1 = new Date(Date.now() + 86400000).toISOString()
const FUTURE_ISO_2 = new Date(Date.now() + 172800000).toISOString()

beforeEach(() => {
  vi.clearAllMocks()
  mockUseAuth.mockReturnValue(buildAuthMock())
  mockFetchNotifications.mockResolvedValue([])
  mockFetchContacts.mockResolvedValue([])
  mockFetchUserEvents.mockResolvedValue([])
})

describe('EleveDashboardPage — prochain cours', () => {
  it('affiche le prochain cours après chargement', async () => {
    mockFetchUserEvents.mockResolvedValue([
      { id: 'evt-1', title: 'Séance d\'algèbre', startAt: FUTURE_ISO_1, endAt: FUTURE_ISO_2 },
    ])

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByText('Séance d\'algèbre')).toBeDefined()
    })

    expect(mockFetchUserEvents).toHaveBeenCalledWith('student-1')
  })

  it('affiche un état vide invitant à demander un professeur quand aucun cours n\'est prévu', async () => {
    renderDashboard()

    await waitFor(() => {
      expect(screen.getByText('Aucun cours à venir')).toBeDefined()
    })
  })
})

describe('EleveDashboardPage — professeur attitré', () => {
  it('affiche le professeur principal détecté parmi les contacts', async () => {
    mockFetchContacts.mockResolvedValue([
      {
        id: 'contact-1',
        userId: 'teacher-1',
        displayName: 'Mme Curie',
        role: 'formateur',
        status: 'active',
        mandatory: true,
      },
    ])

    renderDashboard()

    await waitFor(() => {
      expect(screen.getAllByText('Mme Curie').length).toBeGreaterThan(0)
    })
  })

  it('affiche une invitation à demander un professeur si aucun contact formateur', async () => {
    renderDashboard()

    await waitFor(() => {
      expect(screen.getByText('Vous n\'avez pas pour l\'instant de professeur attitré')).toBeDefined()
    })
  })
})

describe('EleveDashboardPage — notifications', () => {
  it('affiche les notifications récentes', async () => {
    mockFetchNotifications.mockResolvedValue([
      { id: 'notif-1', message: 'Nouvelle activité disponible', read: false, createdAt: FUTURE_ISO_1 },
    ])

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByText('Nouvelle activité disponible')).toBeDefined()
    })
  })
})
