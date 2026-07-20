/**
 * Tests for ProfileVisibilitySettingsPage
 *
 * Covers:
 * - Student can view own visibility preferences via fetchVisibilityPreferences(userId)
 * - Student edits and saves preferences via updateVisibilityPreferences(userId, payload)
 * - Loading state displayed while fetching
 * - Error state on forbidden access
 * - Non-owner non-RP user cannot access (Accès refusé)
 * - Toggling a checkbox updates the preference
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ProfileVisibilitySettingsPage from '../../src/pages/ProfileVisibilitySettingsPage'

vi.mock('../../src/hooks/useAuth')
vi.mock('../../src/api/profile')

import { useAuth } from '../../src/hooks/useAuth'
import { fetchVisibilityPreferences, updateVisibilityPreferences } from '../../src/api/profile'

const mockUseAuth = vi.mocked(useAuth)
const mockFetchVisibilityPreferences = vi.mocked(fetchVisibilityPreferences)
const mockUpdateVisibilityPreferences = vi.mocked(updateVisibilityPreferences)

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

const PARENT_USER = {
  id: 'parent-1',
  email: 'parent@test.com',
  role: 'parent_financeur' as const,
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

const SAMPLE_PREFERENCES = {
  showEmailToTeachers: false,
  showPhoneToTeachers: true,
  showAddressToTeachers: false,
  showProgressToParents: true,
  showCalendarToParents: false,
}

function renderPage(userId = 'student-1') {
  return render(
    <MemoryRouter initialEntries={[`/profiles/${userId}/visibility`]}>
      <Routes>
        <Route path="/profiles/:userId/visibility" element={<ProfileVisibilitySettingsPage />} />
        <Route path="/profiles/:userId" element={<div>Profile Page</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUseAuth.mockReturnValue(buildAuthMock())
})

describe('ProfileVisibilitySettingsPage', () => {
  it('shows loading state while fetching preferences', () => {
    mockFetchVisibilityPreferences.mockReturnValue(new Promise(() => {}))
    renderPage()
    expect(screen.getByText('Chargement…')).toBeDefined()
  })

  it('renders the visibility settings form for own profile', async () => {
    mockFetchVisibilityPreferences.mockResolvedValue(SAMPLE_PREFERENCES)
    renderPage('student-1')

    await waitFor(() => {
      expect(screen.getByText('Confidentialité')).toBeDefined()
      expect(screen.getByText('Visibilité envers les formateurs')).toBeDefined()
      expect(screen.getByText('Visibilité envers les parents')).toBeDefined()
    })
  })

  it('pre-fills checkboxes from loaded preferences', async () => {
    mockFetchVisibilityPreferences.mockResolvedValue(SAMPLE_PREFERENCES)
    renderPage('student-1')

    await waitFor(() => {
      const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[]
      // showEmailToTeachers = false, showPhoneToTeachers = true, showAddressToTeachers = false
      // showProgressToParents = true, showCalendarToParents = false
      expect(checkboxes[0].checked).toBe(false) // showEmailToTeachers
      expect(checkboxes[1].checked).toBe(true)  // showPhoneToTeachers
      expect(checkboxes[2].checked).toBe(false) // showAddressToTeachers
      expect(checkboxes[3].checked).toBe(true)  // showProgressToParents
      expect(checkboxes[4].checked).toBe(false) // showCalendarToParents
    })
  })

  it('calls updateVisibilityPreferences(userId, payload) on save', async () => {
    mockFetchVisibilityPreferences.mockResolvedValue(SAMPLE_PREFERENCES)
    mockUpdateVisibilityPreferences.mockResolvedValue(SAMPLE_PREFERENCES)

    renderPage('student-1')

    await waitFor(() => {
      screen.getByRole('button', { name: /enregistrer/i })
    })

    await userEvent.click(screen.getByRole('button', { name: /enregistrer/i }))

    await waitFor(() => {
      expect(mockUpdateVisibilityPreferences).toHaveBeenCalledWith(
        'student-1',
        expect.objectContaining({ showPhoneToTeachers: true }),
      )
    })
  })

  it('shows success message after saving', async () => {
    mockFetchVisibilityPreferences.mockResolvedValue(SAMPLE_PREFERENCES)
    mockUpdateVisibilityPreferences.mockResolvedValue(SAMPLE_PREFERENCES)

    renderPage('student-1')

    await waitFor(() => {
      screen.getByRole('button', { name: /enregistrer/i })
    })

    await userEvent.click(screen.getByRole('button', { name: /enregistrer/i }))

    await waitFor(() => {
      expect(screen.getByText('Préférences de confidentialité enregistrées')).toBeDefined()
    })
  })

  it('shows error message on save failure', async () => {
    mockFetchVisibilityPreferences.mockResolvedValue(SAMPLE_PREFERENCES)
    mockUpdateVisibilityPreferences.mockRejectedValue({
      response: { data: { message: 'Erreur serveur' } },
    })

    renderPage('student-1')

    await waitFor(() => {
      screen.getByRole('button', { name: /enregistrer/i })
    })

    await userEvent.click(screen.getByRole('button', { name: /enregistrer/i }))

    await waitFor(() => {
      expect(screen.getByText('Erreur serveur')).toBeDefined()
    })
  })

  it('toggles a checkbox when clicked', async () => {
    mockFetchVisibilityPreferences.mockResolvedValue(SAMPLE_PREFERENCES)
    renderPage('student-1')

    await waitFor(() => {
      screen.getAllByRole('checkbox')
    })

    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[]
    const initialValue = checkboxes[0].checked // showEmailToTeachers = false

    await userEvent.click(checkboxes[0])

    await waitFor(() => {
      const updatedCheckboxes = screen.getAllByRole('checkbox') as HTMLInputElement[]
      expect(updatedCheckboxes[0].checked).toBe(!initialValue)
    })
  })

  it('shows "Accès refusé" for unauthorized users (parent viewing another profile)', () => {
    // Parent user viewing someone else's profile — not own and not RP/TI
    mockUseAuth.mockReturnValue(buildAuthMock(PARENT_USER))
    mockFetchVisibilityPreferences.mockResolvedValue(SAMPLE_PREFERENCES)

    renderPage('student-1') // parent-1 viewing student-1's profile

    expect(screen.getByText('Accès refusé')).toBeDefined()
  })

  it('allows RP to access visibility settings of any student', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(RP_USER))
    mockFetchVisibilityPreferences.mockResolvedValue(SAMPLE_PREFERENCES)

    renderPage('student-1')

    await waitFor(() => {
      expect(screen.getByText('Confidentialité')).toBeDefined()
    })
  })
})
