/**
 * Changer d'onglet ne perd rien, et ne redemande rien.
 *
 * Correction de trajectoire du 2026-08-10. Un premier correctif relisait le
 * profil à **chaque clic d'onglet** : c'était répondre par du réseau à une
 * erreur d'appartenance d'état côté React. La règle retenue à sa place tient en
 * deux lignes :
 *
 * 1. une **page** charge ses données à son montage, et c'est tout ;
 * 2. à l'intérieur d'une page, changer d'onglet ne doit **rien** faire perdre —
 *    ni l'affichage, ni la saisie en cours, ni un object URL de photo.
 *
 * Le moyen : `TabPanel` monte un onglet à sa **première** activation puis le
 * **garde monté**, simplement masqué. On évite ainsi de charger cinq panneaux
 * pour en montrer un, et de tout détruire au premier clic.
 *
 * Ces tests gardent les deux bouts : aucun appel réseau supplémentaire sur un
 * aller-retour d'onglet, et aucun panneau reconstruit.
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
  fetchProfileAvatarBlob,
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
const mockFetchProfileAvatarBlob = vi.mocked(fetchProfileAvatarBlob)
const mockFetchProfileAvatarConstraints = vi.mocked(fetchProfileAvatarConstraints)

const USER_ID = 'student-1'
const AVATAR_URL = `/api/v1/profiles/${USER_ID}/avatar?v=1754820000000`

const STUDENT_USER = {
  id: USER_ID,
  email: 'eleve@test.com',
  role: 'eleve' as const,
  validationStatus: 'active' as const,
}

const SAMPLE_PROFILE = {
  userId: USER_ID,
  pedagogicalType: 'student' as const,
  administrative: {
    firstName: 'Marie',
    lastName: 'Dupont',
    phone: '0612345678',
    avatarUrl: AVATAR_URL,
  },
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

/** Somme de tous les appels réseau simulés de l'écran. */
function countNetworkCalls() {
  return (
    mockFetchProfile.mock.calls.length +
    mockFetchProfileStatistics.mock.calls.length +
    mockFetchTeacherStudentRelations.mock.calls.length +
    mockFetchInternalNotes.mock.calls.length +
    mockFetchProfileAvatarBlob.mock.calls.length +
    mockFetchProfileAvatarConstraints.mock.calls.length +
    (mockApiClient.get as ReturnType<typeof vi.fn>).mock.calls.length
  )
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
  mockFetchProfileAvatarBlob.mockResolvedValue(new Blob(['octets'], { type: 'image/webp' }))
  mockFetchProfile.mockResolvedValue(SAMPLE_PROFILE)
})

describe('Fiche profil — le chargement appartient à la page, pas aux onglets', () => {
  it('ne demande le profil qu’une seule fois au montage', async () => {
    renderProfilePage()
    await screen.findByLabelText('Prénom')

    expect(mockFetchProfile).toHaveBeenCalledTimes(1)
  })

  it('n’émet aucun appel réseau supplémentaire sur un aller-retour d’onglet', async () => {
    renderProfilePage()
    await screen.findByLabelText('Prénom')
    await screen.findByRole('img', { name: /Marie Dupont/ })

    // On laisse retomber tout ce que le montage a déclenché avant de compter.
    await waitFor(() => {
      expect(mockFetchProfileAvatarConstraints).toHaveBeenCalled()
    })
    clickTab('Profil pédagogique')
    // L'onglet pédagogique n'avait jamais été ouvert : son panneau se monte et a
    // le droit de charger ses propres données. C'est le seul appel toléré ici.
    await waitFor(() => {
      expect(mockFetchProfileStatistics).toHaveBeenCalledTimes(1)
    })

    const callsAfterFirstVisit = countNetworkCalls()

    clickTab('Profil administratif')
    clickTab('Profil pédagogique')
    clickTab('Profil administratif')

    // Rien n'a été démonté : ni la photo ni les statistiques ne sont
    // redemandées, et le profil non plus.
    expect(countNetworkCalls()).toBe(callsAfterFirstVisit)
    expect(mockFetchProfile).toHaveBeenCalledTimes(1)
    expect(mockFetchProfileAvatarBlob).toHaveBeenCalledTimes(1)
    expect(mockFetchProfileStatistics).toHaveBeenCalledTimes(1)
  })

  it('ne monte un onglet qu’à sa première ouverture', async () => {
    renderProfilePage()
    await screen.findByLabelText('Prénom')

    // Le panneau pédagogique n'a jamais été affiché : rien n'a été demandé pour
    // lui. Charger tous les onglets d'emblée serait l'excès inverse.
    expect(mockFetchProfileStatistics).not.toHaveBeenCalled()

    clickTab('Profil pédagogique')

    await waitFor(() => {
      expect(mockFetchProfileStatistics).toHaveBeenCalledTimes(1)
    })
  })

  it('conserve la saisie en cours d’un aller-retour d’onglet', async () => {
    renderProfilePage()
    const firstNameInput = (await screen.findByLabelText('Prénom')) as HTMLInputElement

    fireEvent.change(firstNameInput, { target: { value: 'Marion' } })

    clickTab('Profil pédagogique')
    clickTab('Profil administratif')

    expect((screen.getByLabelText('Prénom') as HTMLInputElement).value).toBe('Marion')
  })

  it('ne reconstruit pas le panneau, il le retrouve tel quel', async () => {
    renderProfilePage()
    const firstNameInput = await screen.findByLabelText('Prénom')
    const photo = await screen.findByRole('img', { name: /Marie Dupont/ })
    const photoSource = photo.getAttribute('src')

    clickTab('Profil pédagogique')
    clickTab('Profil administratif')

    // Les mêmes nœuds DOM, pas des équivalents : un panneau démonté puis
    // remonté en produirait de nouveaux, et l'object URL de la photo aurait été
    // révoqué puis reconstruit au passage.
    expect(screen.getByLabelText('Prénom')).toBe(firstNameInput)
    expect(screen.getByRole('img', { name: /Marie Dupont/ })).toBe(photo)
    expect(screen.getByRole('img', { name: /Marie Dupont/ }).getAttribute('src')).toBe(photoSource)
  })

  it('masque le panneau inactif au lieu de le détruire, sans le laisser lisible', async () => {
    renderProfilePage()
    await screen.findByLabelText('Prénom')

    clickTab('Profil pédagogique')

    const inactivePanel = document.getElementById('tabpanel-admin')
    // Toujours dans le document — c'est ce qui préserve son état…
    expect(inactivePanel).not.toBeNull()
    // …mais hors de portée du clavier et des lecteurs d'écran.
    expect(inactivePanel?.hasAttribute('hidden')).toBe(true)
    expect(inactivePanel?.getAttribute('aria-hidden')).toBe('true')

    const activePanel = document.getElementById('tabpanel-pedagogique')
    expect(activePanel?.hasAttribute('hidden')).toBe(false)
    expect(activePanel?.hasAttribute('aria-hidden')).toBe(false)
  })

  it('relie chaque onglet à son panneau dans les deux sens', async () => {
    renderProfilePage()
    await screen.findByLabelText('Prénom')

    const adminTab = screen.getByRole('tab', { name: 'Profil administratif' })
    expect(adminTab.getAttribute('aria-controls')).toBe('tabpanel-admin')
    expect(document.getElementById('tabpanel-admin')?.getAttribute('aria-labelledby')).toBe(
      adminTab.id,
    )
  })
})

describe('Écran d’édition — même règle', () => {
  it('ne demande le profil qu’une seule fois au montage', async () => {
    renderEditPage()
    await screen.findByLabelText('Prénom')

    expect(mockFetchProfile).toHaveBeenCalledTimes(1)
  })

  it('n’émet aucun appel réseau supplémentaire sur un aller-retour d’onglet', async () => {
    renderEditPage()
    await screen.findByLabelText('Prénom')
    await screen.findByRole('img', { name: /Marie Dupont/ })
    await waitFor(() => {
      expect(mockFetchProfileAvatarConstraints).toHaveBeenCalled()
    })

    clickTab('Profil pédagogique')
    await screen.findByLabelText('Niveau scolaire')

    const callsAfterFirstVisit = countNetworkCalls()

    clickTab('Profil administratif')
    clickTab('Profil pédagogique')

    expect(countNetworkCalls()).toBe(callsAfterFirstVisit)
    expect(mockFetchProfile).toHaveBeenCalledTimes(1)
  })

  it('conserve la saisie en cours d’un aller-retour d’onglet', async () => {
    renderEditPage()
    const firstNameInput = (await screen.findByLabelText('Prénom')) as HTMLInputElement

    fireEvent.change(firstNameInput, { target: { value: 'Marion' } })

    clickTab('Profil pédagogique')
    await screen.findByLabelText('Niveau scolaire')
    clickTab('Profil administratif')

    expect((screen.getByLabelText('Prénom') as HTMLInputElement).value).toBe('Marion')
  })
})
