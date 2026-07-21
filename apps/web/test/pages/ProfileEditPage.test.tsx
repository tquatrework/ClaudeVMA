/**
 * Tests for ProfileEditPage
 *
 * Covers:
 * - Loads current profile via fetchProfile(userId)
 * - Pre-fills administrative form fields with loaded data
 * - Submits administrative changes via updateAdministrativeProfile(userId, payload)
 * - Shows success message on save
 * - Shows error message on save failure
 * - Tab navigation between administrative and pedagogical forms
 * - Pedagogical form submits via updatePedagogicalProfile(userId, payload)
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ProfileEditPage from '../../src/pages/ProfileEditPage'

vi.mock('../../src/hooks/useAuth')
vi.mock('../../src/api/profile')

import { useAuth } from '../../src/hooks/useAuth'
import { fetchProfile, updateAdministrativeProfile, updatePedagogicalProfile } from '../../src/api/profile'

const mockUseAuth = vi.mocked(useAuth)
const mockFetchProfile = vi.mocked(fetchProfile)
const mockUpdateAdministrativeProfile = vi.mocked(updateAdministrativeProfile)
const mockUpdatePedagogicalProfile = vi.mocked(updatePedagogicalProfile)

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

function renderEditPage(userId = 'student-1') {
  return render(
    <MemoryRouter initialEntries={[`/profiles/${userId}/edit`]}>
      <Routes>
        <Route path="/profiles/:userId/edit" element={<ProfileEditPage />} />
        <Route path="/profiles/:userId" element={<div>Profile Page</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

const EXISTING_PROFILE = {
  userId: 'student-1',
  administrativeProfile: {
    firstName: 'Alice',
    lastName: 'Martin',
    phone: '0601020304',
    address: '1 rue de la Paix',
  },
  pedagogicalProfile: {
    level: 'Terminale',
    subjects: 'Mathématiques',
    goals: 'Préparer le bac',
    notes: '',
  },
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUseAuth.mockReturnValue(buildAuthMock())
})

describe('ProfileEditPage', () => {
  it('shows loading state while fetching the profile', () => {
    mockFetchProfile.mockReturnValue(new Promise(() => {}))

    renderEditPage()

    expect(screen.getByText('Chargement…')).toBeDefined()
  })

  it('pre-fills the administrative form with existing data', async () => {
    mockFetchProfile.mockResolvedValue(EXISTING_PROFILE)

    renderEditPage()

    await waitFor(() => {
      const firstNameInput = screen.getByPlaceholderText(/jean/i) as HTMLInputElement
      expect(firstNameInput.value).toBe('Alice')
    })
  })

  it('calls updateAdministrativeProfile on admin form submit', async () => {
    mockFetchProfile.mockResolvedValue(EXISTING_PROFILE)
    mockUpdateAdministrativeProfile.mockResolvedValue({})

    renderEditPage()

    await waitFor(() => {
      screen.getByRole('button', { name: /enregistrer/i })
    })

    await userEvent.click(screen.getByRole('button', { name: /enregistrer/i }))

    await waitFor(() => {
      expect(mockUpdateAdministrativeProfile).toHaveBeenCalledWith(
        'student-1',
        expect.objectContaining({ firstName: 'Alice' }),
      )
    })
  })

  it('shows success message after saving admin profile', async () => {
    mockFetchProfile.mockResolvedValue(EXISTING_PROFILE)
    mockUpdateAdministrativeProfile.mockResolvedValue({})

    renderEditPage()

    await waitFor(() => {
      screen.getByRole('button', { name: /enregistrer/i })
    })

    await userEvent.click(screen.getByRole('button', { name: /enregistrer/i }))

    await waitFor(() => {
      expect(screen.getByText('Profil administratif mis à jour')).toBeDefined()
    })
  })

  it('shows error message when save fails', async () => {
    mockFetchProfile.mockResolvedValue(EXISTING_PROFILE)
    mockUpdateAdministrativeProfile.mockRejectedValue({
      response: { data: { message: 'Données invalides' } },
    })

    renderEditPage()

    await waitFor(() => {
      screen.getByRole('button', { name: /enregistrer/i })
    })

    await userEvent.click(screen.getByRole('button', { name: /enregistrer/i }))

    await waitFor(() => {
      expect(screen.getByText('Données invalides')).toBeDefined()
    })
  })

  it('shows the pedagogical tab for élève role', async () => {
    mockFetchProfile.mockResolvedValue(EXISTING_PROFILE)

    renderEditPage()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /profil pédagogique/i })).toBeDefined()
    })
  })

  it('switches to pedagogical tab on click', async () => {
    mockFetchProfile.mockResolvedValue(EXISTING_PROFILE)

    renderEditPage()

    await waitFor(() => {
      screen.getByRole('button', { name: /profil pédagogique/i })
    })

    await userEvent.click(screen.getByRole('button', { name: /profil pédagogique/i }))

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/terminale/i)).toBeDefined()
    })
  })

  it('calls updatePedagogicalProfile on pedagogical form submit', async () => {
    mockFetchProfile.mockResolvedValue(EXISTING_PROFILE)
    mockUpdatePedagogicalProfile.mockResolvedValue({})

    renderEditPage()

    await waitFor(() => {
      screen.getByRole('button', { name: /profil pédagogique/i })
    })

    await userEvent.click(screen.getByRole('button', { name: /profil pédagogique/i }))

    await waitFor(() => {
      screen.getAllByRole('button', { name: /enregistrer/i })
    })

    // Click the save button on the pedagogical form
    const saveButtons = screen.getAllByRole('button', { name: /enregistrer/i })
    await userEvent.click(saveButtons[0])

    await waitFor(() => {
      expect(mockUpdatePedagogicalProfile).toHaveBeenCalledWith(
        'student-1',
        expect.objectContaining({ level: 'Terminale' }),
      )
    })
  })

  it('shows success message after saving pedagogical profile', async () => {
    mockFetchProfile.mockResolvedValue(EXISTING_PROFILE)
    mockUpdatePedagogicalProfile.mockResolvedValue({})

    renderEditPage()

    await waitFor(() => {
      screen.getByRole('button', { name: /profil pédagogique/i })
    })

    await userEvent.click(screen.getByRole('button', { name: /profil pédagogique/i }))

    await waitFor(() => {
      screen.getAllByRole('button', { name: /enregistrer/i })
    })

    const saveButtons = screen.getAllByRole('button', { name: /enregistrer/i })
    await userEvent.click(saveButtons[0])

    await waitFor(() => {
      expect(screen.getByText('Profil pédagogique mis à jour')).toBeDefined()
    })
  })

  it('navigates back to profile page when clicking "Retour"', async () => {
    mockFetchProfile.mockResolvedValue(EXISTING_PROFILE)

    renderEditPage()

    await waitFor(() => {
      screen.getByText(/retour au profil/i)
    })

    await userEvent.click(screen.getByText(/retour au profil/i))

    await waitFor(() => {
      expect(screen.getByText('Profile Page')).toBeDefined()
    })
  })
})
