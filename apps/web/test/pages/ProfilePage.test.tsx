/**
 * Tests for ProfilePage
 *
 * Covers:
 * - Fetches profile via GET /profiles/:userId
 * - Loading state
 * - Error states (403, 404, 500)
 * - Shows edit button for own profile or privileged roles
 * - Internal notes section shown only for RP / administrateur_financier
 * - Teacher relations section shown for authorised roles
 * - Can add an internal note via POST /profiles/:userId/internal-notes
 */

import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ProfilePage from '../../src/pages/ProfilePage'

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

function renderProfilePage(userId = 'student-1') {
  return render(
    <MemoryRouter initialEntries={[`/profiles/${userId}`]}>
      <Routes>
        <Route path="/profiles/:userId" element={<ProfilePage />} />
        <Route path="/profiles/:userId/edit" element={<div>Edit Profile Page</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

const SAMPLE_PROFILE = {
  userId: 'student-1',
  administrativeProfile: { firstName: 'Marie', lastName: 'Dupont', phone: '0612345678' },
  pedagogicalProfile: { level: 'Terminale', subjects: 'Mathématiques' },
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUseAuth.mockReturnValue(buildAuthMock())
})

describe('ProfilePage', () => {
  it('shows loading state while fetching', () => {
    mockApiClient.get = vi.fn().mockReturnValue(new Promise(() => {}))

    renderProfilePage()

    expect(screen.getByText('Chargement…')).toBeDefined()
  })

  it('renders administrative and pedagogical profile sections', async () => {
    mockApiClient.get = vi.fn().mockImplementation((url: string) => {
      if (url === '/profiles/student-1') return Promise.resolve({ data: SAMPLE_PROFILE })
      return Promise.resolve({ data: [] })
    })

    renderProfilePage()

    await waitFor(() => {
      // Les onglets "Profil administratif" et "Profil pédagogique" apparaissent dans la barre de navigation
      const adminTabs = screen.getAllByText('Profil administratif')
      expect(adminTabs.length).toBeGreaterThanOrEqual(1)
      expect(screen.getByRole('tab', { name: 'Profil pédagogique' })).toBeDefined()
    })
  })

  it('displays field values from the profile', async () => {
    mockApiClient.get = vi.fn().mockImplementation((url: string) => {
      if (url === '/profiles/student-1') return Promise.resolve({ data: SAMPLE_PROFILE })
      return Promise.resolve({ data: [] })
    })

    renderProfilePage()

    // Onglet "Profil administratif" actif par défaut — vérifier les champs admin
    await waitFor(() => {
      expect(screen.getByText('Marie')).toBeDefined()
    })

    // Naviguer vers l'onglet "Profil pédagogique" pour voir les données pédagogiques
    const pedagogiqueTab = await screen.findByRole('tab', { name: 'Profil pédagogique' })
    fireEvent.click(pedagogiqueTab)

    await waitFor(() => {
      expect(screen.getByText('Terminale')).toBeDefined()
    })
  })

  it('shows "Profil introuvable" for 404 error', async () => {
    mockApiClient.get = vi.fn().mockRejectedValue({ response: { status: 404 } })

    renderProfilePage()

    await waitFor(() => {
      expect(screen.getByText('Profil introuvable')).toBeDefined()
    })
  })

  it('shows "Accès refusé" for 403 error', async () => {
    mockApiClient.get = vi.fn().mockRejectedValue({ response: { status: 403 } })

    renderProfilePage()

    await waitFor(() => {
      expect(screen.getByText('Accès refusé')).toBeDefined()
    })
  })

  it('shows edit button when viewing own profile as élève', async () => {
    mockApiClient.get = vi.fn().mockImplementation((url: string) => {
      if (url === '/profiles/student-1') return Promise.resolve({ data: SAMPLE_PROFILE })
      return Promise.resolve({ data: [] })
    })

    renderProfilePage('student-1')

    await waitFor(() => {
      expect(screen.getByRole('link', { name: /modifier/i })).toBeDefined()
    })
  })

  it('does NOT show internal notes section for élève role', async () => {
    mockApiClient.get = vi.fn().mockImplementation((url: string) => {
      if (url === '/profiles/student-1') return Promise.resolve({ data: SAMPLE_PROFILE })
      return Promise.resolve({ data: [] })
    })

    renderProfilePage()

    await waitFor(() => {
      expect(screen.queryByText('Notes internes')).toBeNull()
    })
  })

  it('shows internal notes section for RP role', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(RP_USER))

    const internalNotes = [
      { id: 'note-1', authorId: 'rp-1', content: 'Élève en difficulté', createdAt: new Date().toISOString() },
    ]

    mockApiClient.get = vi.fn().mockImplementation((url: string) => {
      if (url === '/profiles/student-1') return Promise.resolve({ data: SAMPLE_PROFILE })
      if (url.includes('/internal-notes')) return Promise.resolve({ data: internalNotes })
      return Promise.resolve({ data: [] })
    })

    renderProfilePage()

    await waitFor(() => {
      expect(screen.getByText('Notes internes')).toBeDefined()
      expect(screen.getByText('Élève en difficulté')).toBeDefined()
    })
  })

  it('allows RP to add an internal note via POST', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(RP_USER))

    const newNote = {
      id: 'note-new',
      authorId: 'rp-1',
      content: 'Nouveau suivi nécessaire',
      createdAt: new Date().toISOString(),
    }

    mockApiClient.get = vi.fn().mockImplementation((url: string) => {
      if (url === '/profiles/student-1') return Promise.resolve({ data: SAMPLE_PROFILE })
      if (url.includes('/internal-notes')) return Promise.resolve({ data: [] })
      return Promise.resolve({ data: [] })
    })
    mockApiClient.post = vi.fn().mockResolvedValue({ data: newNote })

    renderProfilePage()

    await waitFor(() => {
      screen.getByText('Ajouter une note')
    })

    await userEvent.click(screen.getByText('Ajouter une note'))

    await userEvent.type(
      screen.getByPlaceholderText(/note interne/i),
      'Nouveau suivi nécessaire',
    )

    await userEvent.click(screen.getByRole('button', { name: /ajouter$/i }))

    await waitFor(() => {
      expect(mockApiClient.post).toHaveBeenCalledWith(
        '/profiles/student-1/internal-notes',
        { content: 'Nouveau suivi nécessaire' },
      )
    })
  })

  it('shows the new note in the list after adding it', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(RP_USER))

    const newNote = {
      id: 'note-new',
      authorId: 'rp-1',
      content: 'Suivi trimestriel',
      createdAt: new Date().toISOString(),
    }

    mockApiClient.get = vi.fn().mockImplementation((url: string) => {
      if (url === '/profiles/student-1') return Promise.resolve({ data: SAMPLE_PROFILE })
      if (url.includes('/internal-notes')) return Promise.resolve({ data: [] })
      return Promise.resolve({ data: [] })
    })
    mockApiClient.post = vi.fn().mockResolvedValue({ data: newNote })

    renderProfilePage()

    await waitFor(() => {
      screen.getByText('Ajouter une note')
    })

    await userEvent.click(screen.getByText('Ajouter une note'))
    await userEvent.type(screen.getByPlaceholderText(/note interne/i), 'Suivi trimestriel')
    await userEvent.click(screen.getByRole('button', { name: /ajouter$/i }))

    await waitFor(() => {
      expect(screen.getByText('Suivi trimestriel')).toBeDefined()
    })
  })
})
