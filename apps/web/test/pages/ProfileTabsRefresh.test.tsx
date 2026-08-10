/**
 * Relecture des données à l'activation d'un onglet.
 *
 * Règle générale du front, posée le 2026-08-10 : cliquer sur « Profil
 * administratif » redemande le profil administratif, cliquer sur « Profil
 * pédagogique » redemande le profil pédagogique, et il en ira de même de tout
 * menu. Un écran ne montre jamais une donnée dont il ne sait plus si le serveur
 * la confirme encore.
 *
 * **Aucun cache** : arbitrage explicite de l'utilisateur, en connaissance de
 * cause. La requête repart à chaque clic, même si la précédente vient d'aboutir.
 * Ces tests l'imposent — introduire un cache, même « léger », les ferait tomber.
 *
 * Trois pièges gardés en même temps que la règle :
 *
 * 1. **pas de requête en double au premier affichage** : le montage charge déjà
 *    les données, l'affichage du premier onglet ne doit pas en redemander autant ;
 * 2. **pas de clignotement** : l'écran ne repasse pas sur « Chargement… » à
 *    chaque clic, les données déjà affichées restent visibles ;
 * 3. **pas de saisie effacée** : une relecture qui renvoie les mêmes valeurs ne
 *    réinitialise pas le formulaire sous les doigts de l'utilisateur.
 */

import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ProfilePage from '../../src/pages/ProfilePage'
import ProfileEditPage from '../../src/pages/ProfileEditPage'

vi.mock('../../src/hooks/useAuth')
vi.mock('../../src/api/client')
vi.mock('../../src/api/profile')
vi.mock('../../src/api/relations')

import { useAuth } from '../../src/hooks/useAuth'
import apiClient from '../../src/api/client'
import {
  fetchInternalNotes,
  fetchProfile,
  fetchProfileAvatarConstraints,
  fetchProfileStatistics,
} from '../../src/api/profile'
import { fetchTeacherStudentRelations } from '../../src/api/relations'

const mockUseAuth = vi.mocked(useAuth)
const mockApiClient = vi.mocked(apiClient)
const mockFetchProfile = vi.mocked(fetchProfile)
const mockFetchInternalNotes = vi.mocked(fetchInternalNotes)
const mockFetchProfileStatistics = vi.mocked(fetchProfileStatistics)
const mockFetchTeacherStudentRelations = vi.mocked(fetchTeacherStudentRelations)
const mockFetchProfileAvatarConstraints = vi.mocked(fetchProfileAvatarConstraints)

const USER_ID = 'student-1'

const STUDENT_USER = {
  id: USER_ID,
  email: 'eleve@test.com',
  role: 'eleve' as const,
  validationStatus: 'active' as const,
}

const SAMPLE_PROFILE = {
  userId: USER_ID,
  pedagogicalType: 'student' as const,
  administrative: { firstName: 'Marie', lastName: 'Dupont', phone: '0612345678' },
  pedagogical: { level: 'Terminale', subjects: ['Mathématiques'] },
}

function buildAuthMock() {
  return {
    user: STUDENT_USER,
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    hasRole: vi.fn((...roles: string[]) => roles.includes(STUDENT_USER.role)),
    isInternalRole: vi.fn(() => false),
  }
}

function renderProfilePage() {
  return render(
    <MemoryRouter initialEntries={[`/profiles/${USER_ID}`]}>
      <Routes>
        <Route path="/profiles/:userId" element={<ProfilePage />} />
      </Routes>
    </MemoryRouter>,
  )
}

function renderEditPage() {
  return render(
    <MemoryRouter initialEntries={[`/profiles/${USER_ID}/edit`]}>
      <Routes>
        <Route path="/profiles/:userId/edit" element={<ProfileEditPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

function clickTab(tabLabel: string) {
  fireEvent.click(screen.getByRole('tab', { name: tabLabel }))
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUseAuth.mockReturnValue(buildAuthMock())
  mockApiClient.get = vi.fn().mockResolvedValue({ data: [] })
  mockFetchTeacherStudentRelations.mockResolvedValue([])
  mockFetchInternalNotes.mockResolvedValue([])
  mockFetchProfileStatistics.mockResolvedValue({})
  mockFetchProfileAvatarConstraints.mockResolvedValue({
    maxUploadBytes: 1_000_000,
    acceptedContentTypes: ['image/jpeg', 'image/png', 'image/webp'],
    outputContentType: 'image/webp',
    maxDimensionPixels: 512,
  })
  mockFetchProfile.mockResolvedValue(SAMPLE_PROFILE)
})

describe('Fiche profil — relecture à chaque activation d’onglet', () => {
  it('ne demande le profil qu’une seule fois au premier affichage', async () => {
    renderProfilePage()
    await screen.findByLabelText('Prénom')

    // L'onglet administratif est affiché d'emblée : son activation ne doit pas
    // rejouer la requête que le montage vient de faire.
    expect(mockFetchProfile).toHaveBeenCalledTimes(1)
  })

  it('redemande le profil à chaque clic d’onglet, aller comme retour', async () => {
    renderProfilePage()
    await screen.findByLabelText('Prénom')

    clickTab('Profil pédagogique')
    await waitFor(() => {
      expect(mockFetchProfile).toHaveBeenCalledTimes(2)
    })

    // Le retour sur un onglet déjà visité relit lui aussi : c'est le cas qui
    // faisait disparaître la photo envoyée entre-temps.
    clickTab('Profil administratif')
    await waitFor(() => {
      expect(mockFetchProfile).toHaveBeenCalledTimes(3)
    })
  })

  it('redemande le profil même quand on reclique l’onglet déjà actif', async () => {
    renderProfilePage()
    await screen.findByLabelText('Prénom')

    clickTab('Profil administratif')

    await waitFor(() => {
      expect(mockFetchProfile).toHaveBeenCalledTimes(2)
    })
  })

  it('relit les statistiques à chaque ouverture de l’onglet pédagogique', async () => {
    renderProfilePage()
    await screen.findByLabelText('Prénom')

    clickTab('Profil pédagogique')
    await waitFor(() => {
      expect(mockFetchProfileStatistics).toHaveBeenCalledTimes(1)
    })

    clickTab('Profil administratif')
    clickTab('Profil pédagogique')

    await waitFor(() => {
      expect(mockFetchProfileStatistics).toHaveBeenCalledTimes(2)
    })
  })

  it('ne repasse pas l’écran sur « Chargement… » pendant la relecture', async () => {
    renderProfilePage()
    await screen.findByLabelText('Prénom')

    // Re-clic sur l'onglet actif : la relecture part, et rien d'autre ne se
    // monte — le moindre « Chargement… » ne pourrait venir que de la page
    // elle-même. (Un panneau qui vient de se monter, lui, a le droit d'annoncer
    // son propre chargement.)
    clickTab('Profil administratif')

    // La fiche déjà chargée reste à l'écran : sinon la mise en page sauterait à
    // chaque clic d'onglet.
    expect(screen.queryByText('Chargement…')).toBeNull()
    expect((screen.getByLabelText('Prénom') as HTMLInputElement).value).toBe('Marie')

    await waitFor(() => {
      expect(mockFetchProfile).toHaveBeenCalledTimes(2)
    })
    expect(screen.queryByText('Chargement…')).toBeNull()
  })

  it('conserve la saisie en cours quand la relecture vient d’un clic d’onglet', async () => {
    renderProfilePage()
    const firstNameInput = (await screen.findByLabelText('Prénom')) as HTMLInputElement

    fireEvent.change(firstNameInput, { target: { value: 'Marion' } })
    // Re-clic sur l'onglet actif : le formulaire reste monté, la relecture part.
    clickTab('Profil administratif')

    await waitFor(() => {
      expect(mockFetchProfile).toHaveBeenCalledTimes(2)
    })
    expect((screen.getByLabelText('Prénom') as HTMLInputElement).value).toBe('Marion')
  })
})

describe('Écran d’édition — relecture à chaque activation d’onglet', () => {
  it('ne demande le profil qu’une seule fois au premier affichage', async () => {
    renderEditPage()
    await screen.findByLabelText('Prénom')

    expect(mockFetchProfile).toHaveBeenCalledTimes(1)
  })

  it('redemande le profil à chaque clic d’onglet, aller comme retour', async () => {
    renderEditPage()
    await screen.findByLabelText('Prénom')

    clickTab('Profil pédagogique')
    await waitFor(() => {
      expect(mockFetchProfile).toHaveBeenCalledTimes(2)
    })

    clickTab('Profil administratif')
    await waitFor(() => {
      expect(mockFetchProfile).toHaveBeenCalledTimes(3)
    })
  })

  it('ne repasse pas l’écran sur « Chargement… » pendant la relecture', async () => {
    renderEditPage()
    await screen.findByLabelText('Prénom')

    clickTab('Profil pédagogique')

    expect(screen.queryByText('Chargement…')).toBeNull()
    expect(await screen.findByLabelText('Niveau scolaire')).toBeDefined()
  })
})
