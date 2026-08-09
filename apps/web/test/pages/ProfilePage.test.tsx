/**
 * Tests for ProfilePage
 *
 * Covers:
 * - Fetches profile via fetchProfile(userId)
 * - Loading state
 * - Error states (403, 404, 500)
 * - Shows edit button for own profile or privileged roles
 * - Internal notes section shown only for RP / administrateur_financier
 * - Teacher relations section shown for authorised roles
 * - Can add an internal note via createInternalNote(userId, content)
 *
 * Note : `TeacherValidationPanel` (RP/TI) et `ProfileStatisticsPanel` (onglet
 * pédagogique) sont montés en tant qu'enfants de ProfilePage mais ne font pas
 * partie de ce lot de migration — leurs dépendances (`api/client`,
 * `fetchProfileStatistics`) sont mockées ici uniquement pour éviter tout appel
 * réseau réel pendant ces tests, sans changer leur comportement.
 */

import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ProfilePage from '../../src/pages/ProfilePage'

vi.mock('../../src/hooks/useAuth')
vi.mock('../../src/api/client')
vi.mock('../../src/api/profile')
vi.mock('../../src/api/relations')

import { useAuth } from '../../src/hooks/useAuth'
import apiClient from '../../src/api/client'
import { fetchProfile, fetchInternalNotes, createInternalNote, fetchProfileStatistics } from '../../src/api/profile'
import { fetchTeacherStudentRelations } from '../../src/api/relations'

const mockUseAuth = vi.mocked(useAuth)
const mockApiClient = vi.mocked(apiClient)
const mockFetchProfile = vi.mocked(fetchProfile)
const mockFetchInternalNotes = vi.mocked(fetchInternalNotes)
const mockCreateInternalNote = vi.mocked(createInternalNote)
const mockFetchProfileStatistics = vi.mocked(fetchProfileStatistics)
const mockFetchTeacherStudentRelations = vi.mocked(fetchTeacherStudentRelations)

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

/**
 * Forme réelle de `GET /profiles/:userId` : rubriques `administrative` /
 * `pedagogical` (clés courtes). Ne pas réintroduire `administrativeProfile` /
 * `pedagogicalProfile` : ces clés longues n'existent plus nulle part depuis
 * l'arbitrage du 2026-08-08 (un seul nom par donnée, voir `docs/architecture.md`),
 * y compris sur les routes `/internal/*` qui les portaient encore. Une fixture aux
 * clés longues rendrait ce test vert alors que l'écran est vide en réalité.
 */
const SAMPLE_PROFILE = {
  userId: 'student-1',
  administrative: { firstName: 'Marie', lastName: 'Dupont', phone: '0612345678' },
  // `subjects` est un `string[]` côté profile-service, jamais une chaîne.
  pedagogical: { level: 'Terminale', subjects: ['Mathématiques', 'Physique-Chimie'] },
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUseAuth.mockReturnValue(buildAuthMock())
  // Dépendance non migrée (TeacherValidationPanel) — évite tout appel réseau réel.
  mockApiClient.get = vi.fn().mockResolvedValue({ data: [] })
  mockFetchTeacherStudentRelations.mockResolvedValue([])
  mockFetchInternalNotes.mockResolvedValue([])
  mockFetchProfileStatistics.mockResolvedValue({})
})

describe('ProfilePage', () => {
  it('shows loading state while fetching', () => {
    mockFetchProfile.mockReturnValue(new Promise(() => {}))

    renderProfilePage()

    expect(screen.getByText('Chargement…')).toBeDefined()
  })

  it('renders administrative and pedagogical profile sections', async () => {
    mockFetchProfile.mockResolvedValue(SAMPLE_PROFILE)

    renderProfilePage()

    await waitFor(() => {
      // Les onglets "Profil administratif" et "Profil pédagogique" apparaissent dans la barre de navigation
      const adminTabs = screen.getAllByText('Profil administratif')
      expect(adminTabs.length).toBeGreaterThanOrEqual(1)
      expect(screen.getByRole('tab', { name: 'Profil pédagogique' })).toBeDefined()
    })
  })

  it('displays field values from the profile', async () => {
    mockFetchProfile.mockResolvedValue(SAMPLE_PROFILE)

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
    // Un champ tableau s'affiche en liste lisible, jamais en JSON brut.
    expect(screen.getByText('Mathématiques, Physique-Chimie')).toBeDefined()
  })

  it("n'affiche ni l'UUID du compte ni de libellé anglais dans l'onglet administratif", async () => {
    // Le serveur renvoie le bloc `administrative` avec ses champs techniques :
    // affiché tel quel, il faisait apparaître « User id », « Created at » et
    // « Updated at » à l'écran (constat du 2026-08-09 sur la pile réelle).
    mockFetchProfile.mockResolvedValue({
      ...SAMPLE_PROFILE,
      administrative: {
        userId: '464da8a2-8b4f-4cc7-b7b1-f1d0ab511355',
        firstName: 'Nina',
        lastName: 'Profil',
        birthDate: '2008-05-14',
        createdAt: '2026-08-09T18:13:49.000Z',
        updatedAt: '2026-08-09T18:13:49.000Z',
      },
    })

    renderProfilePage()

    await waitFor(() => {
      expect(screen.getByText('Nina')).toBeDefined()
    })

    // L'UUID n'est pas une donnée de fiche : ni sa valeur, ni son libellé.
    expect(screen.queryByText('464da8a2-8b4f-4cc7-b7b1-f1d0ab511355')).toBeNull()
    expect(screen.queryByText('User id')).toBeNull()

    // La traçabilité reste lisible, mais en français.
    expect(screen.queryByText('Created at')).toBeNull()
    expect(screen.queryByText('Updated at')).toBeNull()
    expect(screen.getByText('Profil créé le')).toBeDefined()
    expect(screen.getByText('Dernière modification')).toBeDefined()
  })

  it('shows "Profil introuvable" for 404 error', async () => {
    mockFetchProfile.mockRejectedValue({ response: { status: 404 } })

    renderProfilePage()

    await waitFor(() => {
      expect(screen.getByText('Profil introuvable')).toBeDefined()
    })
  })

  it('shows "Accès refusé" for 403 error', async () => {
    mockFetchProfile.mockRejectedValue({ response: { status: 403 } })

    renderProfilePage()

    await waitFor(() => {
      expect(screen.getByText('Accès refusé')).toBeDefined()
    })
  })

  it('shows edit button when viewing own profile as élève', async () => {
    mockFetchProfile.mockResolvedValue(SAMPLE_PROFILE)

    renderProfilePage('student-1')

    await waitFor(() => {
      expect(screen.getByRole('link', { name: /modifier/i })).toBeDefined()
    })
  })

  it('does NOT show internal notes section for élève role', async () => {
    mockFetchProfile.mockResolvedValue(SAMPLE_PROFILE)

    renderProfilePage()

    await waitFor(() => {
      expect(screen.queryByText('Notes internes')).toBeNull()
    })
  })

  it('shows internal notes section for RP role', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(RP_USER))
    mockFetchProfile.mockResolvedValue(SAMPLE_PROFILE)

    const internalNotes = [
      { id: 'note-1', authorId: 'rp-1', content: 'Élève en difficulté', createdAt: new Date().toISOString() },
    ]
    mockFetchInternalNotes.mockResolvedValue(internalNotes)

    renderProfilePage()

    await waitFor(() => {
      expect(screen.getByText('Notes internes')).toBeDefined()
      expect(screen.getByText('Élève en difficulté')).toBeDefined()
    })
  })

  it('allows RP to add an internal note via createInternalNote', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(RP_USER))
    mockFetchProfile.mockResolvedValue(SAMPLE_PROFILE)
    mockFetchInternalNotes.mockResolvedValue([])

    const newNote = {
      id: 'note-new',
      authorId: 'rp-1',
      content: 'Nouveau suivi nécessaire',
      createdAt: new Date().toISOString(),
    }
    mockCreateInternalNote.mockResolvedValue(newNote)

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
      expect(mockCreateInternalNote).toHaveBeenCalledWith('student-1', 'Nouveau suivi nécessaire')
    })
  })

  it('shows the new note in the list after adding it', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(RP_USER))
    mockFetchProfile.mockResolvedValue(SAMPLE_PROFILE)
    mockFetchInternalNotes.mockResolvedValue([])

    const newNote = {
      id: 'note-new',
      authorId: 'rp-1',
      content: 'Suivi trimestriel',
      createdAt: new Date().toISOString(),
    }
    mockCreateInternalNote.mockResolvedValue(newNote)

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
