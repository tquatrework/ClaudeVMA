/**
 * Tests for ActivitiesPage
 *
 * Covers:
 * - Loading state
 * - List rendering with status badges
 * - Empty state (no activities at all)
 * - Filter by status
 * - Empty state for a filtered status that has no matches
 * - Error state with retry button
 * - API error 403 shows "Accès refusé"
 * - Summary stat cards (planifiées, en cours, terminées)
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ActivitiesPage from '../../src/pages/ActivitiesPage'

vi.mock('../../src/hooks/useAuth')
vi.mock('../../src/api/client')

import { useAuth } from '../../src/hooks/useAuth'
import apiClient from '../../src/api/client'

const mockUseAuth = vi.mocked(useAuth)
const mockApiClient = vi.mocked(apiClient)

const STUDENT_USER = {
  id: 'student-1',
  email: 'eleve@test.com',
  role: 'eleve' as const,
  validationStatus: 'active' as const,
}

function buildAuthMock(userObj = STUDENT_USER) {
  return {
    user: userObj,
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    hasRole: vi.fn((...roles: string[]) => roles.includes(userObj.role)),
    isInternalRole: vi.fn(() => false),
  }
}

function renderActivities() {
  return render(
    <MemoryRouter>
      <ActivitiesPage />
    </MemoryRouter>,
  )
}

const PAST_DATE = new Date(Date.now() - 86400000).toISOString()
const FUTURE_DATE = new Date(Date.now() + 86400000).toISOString()

const SAMPLE_ACTIVITIES = [
  {
    id: 'act-1',
    title: 'Cours terminé',
    startAt: PAST_DATE,
    endAt: PAST_DATE,
    status: 'completed',
    type: 'course',
  },
  {
    id: 'act-2',
    title: 'Cours planifié',
    startAt: FUTURE_DATE,
    endAt: FUTURE_DATE,
    status: 'scheduled',
    type: 'course',
  },
  {
    id: 'act-3',
    title: 'Réunion en cours',
    startAt: PAST_DATE,
    endAt: FUTURE_DATE,
    status: 'ongoing',
    type: 'meeting',
  },
]

beforeEach(() => {
  vi.clearAllMocks()
  mockUseAuth.mockReturnValue(buildAuthMock())
})

describe('ActivitiesPage', () => {
  it('shows loading state while fetching', () => {
    mockApiClient.get = vi.fn().mockReturnValue(new Promise(() => {}))

    renderActivities()

    expect(screen.getByText('Chargement des activités…')).toBeDefined()
  })

  it('renders list of activities with their titles', async () => {
    mockApiClient.get = vi.fn().mockResolvedValue({ data: SAMPLE_ACTIVITIES })

    renderActivities()

    await waitFor(() => {
      expect(screen.getByText('Cours terminé')).toBeDefined()
      expect(screen.getByText('Cours planifié')).toBeDefined()
      expect(screen.getByText('Réunion en cours')).toBeDefined()
    })
  })

  it('shows summary stat cards when activities are present', async () => {
    mockApiClient.get = vi.fn().mockResolvedValue({ data: SAMPLE_ACTIVITIES })

    renderActivities()

    await waitFor(() => {
      // "Planifiées" and "Terminées" appear in stat cards (unique labels)
      expect(screen.getByText('Planifiées')).toBeDefined()
      expect(screen.getByText('Terminées')).toBeDefined()
      // "En cours" appears in both the stat card AND the filter button — use getAllByText
      const enCoursMatches = screen.getAllByText('En cours')
      expect(enCoursMatches.length).toBeGreaterThan(0)
    })
  })

  it('shows empty state when no activities exist', async () => {
    mockApiClient.get = vi.fn().mockResolvedValue({ data: [] })

    renderActivities()

    await waitFor(() => {
      expect(screen.getByText('Aucune activité pour le moment')).toBeDefined()
    })
  })

  it('shows empty state for a filtered status with no matches', async () => {
    // Only completed activities, no cancelled ones
    mockApiClient.get = vi.fn().mockResolvedValue({
      data: [SAMPLE_ACTIVITIES[0]], // only 'completed'
    })

    renderActivities()

    await waitFor(() => {
      expect(screen.getByText('Cours terminé')).toBeDefined()
    })

    // Click filter for 'Annulée'
    await userEvent.click(screen.getByRole('button', { name: /annulée/i }))

    await waitFor(() => {
      expect(screen.getByText(/aucune activité avec le statut/i)).toBeDefined()
    })
  })

  it('filters to show only scheduled activities when clicking the filter', async () => {
    mockApiClient.get = vi.fn().mockResolvedValue({ data: SAMPLE_ACTIVITIES })

    renderActivities()

    await waitFor(() => {
      expect(screen.getByText('Cours planifié')).toBeDefined()
    })

    await userEvent.click(screen.getByRole('button', { name: /planifiée/i }))

    await waitFor(() => {
      expect(screen.getByText('Cours planifié')).toBeDefined()
      expect(screen.queryByText('Cours terminé')).toBeNull()
    })
  })

  it('shows error message on API failure', async () => {
    mockApiClient.get = vi.fn().mockRejectedValue({ response: { status: 500 } })

    renderActivities()

    await waitFor(() => {
      expect(screen.getByText('Impossible de charger les activités')).toBeDefined()
    })
  })

  it('shows "Accès refusé" on 403 error', async () => {
    mockApiClient.get = vi.fn().mockRejectedValue({ response: { status: 403 } })

    renderActivities()

    await waitFor(() => {
      expect(screen.getByText('Accès refusé')).toBeDefined()
    })
  })

  it('shows a retry button on error', async () => {
    mockApiClient.get = vi.fn().mockRejectedValue({ response: { status: 500 } })

    renderActivities()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /réessayer/i })).toBeDefined()
    })
  })

  it('fetches with studentId query param for élève role', async () => {
    mockApiClient.get = vi.fn().mockResolvedValue({ data: [] })

    renderActivities()

    await waitFor(() => {
      const calendarCall = vi.mocked(mockApiClient.get).mock.calls.find(
        ([url]) => typeof url === 'string' && url.includes('/calendar'),
      )
      expect(calendarCall).toBeDefined()
      expect(calendarCall![0]).toContain('studentId=student-1')
    })
  })
})
