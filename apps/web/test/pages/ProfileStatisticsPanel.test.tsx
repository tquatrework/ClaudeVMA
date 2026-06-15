/**
 * Tests for ProfileStatisticsPanel
 *
 * Covers:
 * - Fetches stats via GET /profiles/:userId/statistics
 * - Displays statistics values when loaded
 * - Shows "non disponible" message on error
 * - Not rendered for roles without access (eleve viewing another student)
 * - Shows stats for RP/TI roles
 * - Shows empty message when stats are empty
 */

import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ProfileStatisticsPanel from '../../src/pages/ProfileStatisticsPanel'

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

const RP_USER = {
  id: 'rp-1',
  email: 'rp@test.com',
  role: 'responsable_pedagogique' as const,
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
    isInternalRole: vi.fn(() =>
      (['responsable_pedagogique', 'animateur_pedagogique', 'technicien_informatique', 'administrateur_financier'] as string[]).includes(userObj.role),
    ),
  }
}

const SAMPLE_STATISTICS = {
  totalSessionsAttended: 12,
  totalHoursLearned: 18,
  averageSessionDurationMinutes: 90,
  lastSessionDate: new Date('2026-06-10').toISOString(),
  subjectsStudied: ['Mathématiques', 'Physique'],
  currentLevel: 'Terminale',
  progressScore: 72,
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUseAuth.mockReturnValue(buildAuthMock())
})

describe('ProfileStatisticsPanel', () => {
  it('does not render for a student viewing another student profile', () => {
    // student-1 viewing student-2 — no access
    mockUseAuth.mockReturnValue(buildAuthMock(STUDENT_USER))
    const { container } = render(<ProfileStatisticsPanel userId="student-2" />)
    expect(container.firstChild).toBeNull()
  })

  it('renders for a student viewing their own profile', async () => {
    // student-1 viewing their own profile
    mockUseAuth.mockReturnValue(buildAuthMock(STUDENT_USER))
    mockApiClient.get = vi.fn().mockResolvedValue({ data: SAMPLE_STATISTICS })

    render(<ProfileStatisticsPanel userId="student-1" />)

    await waitFor(() => {
      expect(screen.getByText('Statistiques pédagogiques')).toBeDefined()
    })
  })

  it('fetches stats via GET /profiles/:userId/statistics', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(RP_USER))
    mockApiClient.get = vi.fn().mockResolvedValue({ data: SAMPLE_STATISTICS })

    render(<ProfileStatisticsPanel userId="student-1" />)

    await waitFor(() => {
      expect(mockApiClient.get).toHaveBeenCalledWith('/profiles/student-1/statistics')
    })
  })

  it('displays all statistics values when loaded', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(RP_USER))
    mockApiClient.get = vi.fn().mockResolvedValue({ data: SAMPLE_STATISTICS })

    render(<ProfileStatisticsPanel userId="student-1" />)

    await waitFor(() => {
      expect(screen.getByText('12')).toBeDefined()
      expect(screen.getByText('18h')).toBeDefined()
      expect(screen.getByText('90 min')).toBeDefined()
      expect(screen.getByText('Terminale')).toBeDefined()
      expect(screen.getByText('72 / 100')).toBeDefined()
      expect(screen.getByText('Mathématiques, Physique')).toBeDefined()
    })
  })

  it('shows "non disponible" message on fetch error', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(RP_USER))
    mockApiClient.get = vi.fn().mockRejectedValue({ response: { status: 500 } })

    render(<ProfileStatisticsPanel userId="student-1" />)

    await waitFor(() => {
      expect(screen.getByText('Statistiques non disponibles pour le moment')).toBeDefined()
    })
  })

  it('shows empty message when stats object exists but has no values', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(RP_USER))
    mockApiClient.get = vi.fn().mockResolvedValue({ data: {} })

    render(<ProfileStatisticsPanel userId="student-1" />)

    await waitFor(() => {
      expect(screen.getByText('Aucune statistique disponible')).toBeDefined()
    })
  })
})
