/**
 * Fraîcheur de la photo de profil sur la fiche (`ProfilePage`).
 *
 * Défaut reproduit en production le 2026-08-10 : « je choisis une photo, je la
 * vois apparaître ; je change de page et je reviens, elle a disparu ». Les
 * journaux de la passerelle montraient `POST /profiles/:id/avatar` en `200`, la
 * clé de stockage bien écrite en base… et **plus aucun** `GET /profiles/:userId`
 * après l'envoi.
 *
 * Cause : la photo n'existait que dans l'état local de `useProfileAvatar`, monté
 * dans l'onglet administratif. Quitter l'onglet **démonte** ce panneau
 * (`TabPanel` renvoie `null`), donc perd cet état ; y revenir le remonte avec
 * l'`avatarUrl` du profil chargé **avant** l'envoi, qui vaut `null`. La page
 * n'ayant jamais relu sa source de vérité, l'écran affichait durablement une
 * donnée que le serveur contredit.
 *
 * Ce que ces tests gardent :
 *
 * 1. un envoi réussi **redemande** `GET /profiles/:userId` — un test qui se
 *    contenterait de vérifier l'état local du hook serait resté vert pendant tout
 *    le défaut, c'est exactement ce qui existait ;
 * 2. un aller-retour d'onglet, puis un remontage complet de la page, affichent la
 *    **nouvelle** photo ;
 * 3. symptôme inverse, même cause : après une suppression, un retour ne fait pas
 *    réapparaître la photo depuis une copie périmée ;
 * 4. le rafraîchissement ne doit pas écraser la saisie en cours du formulaire
 *    administratif, ni être annulé par l'enregistrement de ce formulaire.
 */

import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ProfilePage from '../../src/pages/ProfilePage'

vi.mock('../../src/hooks/useAuth')
vi.mock('../../src/api/client')
vi.mock('../../src/api/profile')
vi.mock('../../src/api/relations')

import { useAuth } from '../../src/hooks/useAuth'
import apiClient from '../../src/api/client'
import {
  deleteProfileAvatar,
  fetchInternalNotes,
  fetchProfile,
  fetchProfileAvatarBlob,
  fetchProfileAvatarConstraints,
  fetchProfileStatistics,
  updateAdministrativeProfile,
  uploadProfileAvatar,
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
const mockUploadProfileAvatar = vi.mocked(uploadProfileAvatar)
const mockDeleteProfileAvatar = vi.mocked(deleteProfileAvatar)
const mockUpdateAdministrativeProfile = vi.mocked(updateAdministrativeProfile)

const USER_ID = 'student-1'
const UPLOADED_AVATAR_URL = `/api/v1/profiles/${USER_ID}/avatar?v=1754899999999`

const STUDENT_USER = {
  id: USER_ID,
  email: 'eleve@test.com',
  role: 'eleve' as const,
  validationStatus: 'active' as const,
}

const ADMINISTRATIVE_WITHOUT_PHOTO = {
  firstName: 'Marie',
  lastName: 'Dupont',
  phone: '0612345678',
}

/** `GET /profiles/:userId` tel que le serveur le renvoie avant tout envoi. */
const PROFILE_WITHOUT_PHOTO = {
  userId: USER_ID,
  administrative: ADMINISTRATIVE_WITHOUT_PHOTO,
  pedagogical: null,
}

/** Le même, une fois la photo enregistrée : `avatarUrl` est posé par le serveur. */
const PROFILE_WITH_PHOTO = {
  userId: USER_ID,
  administrative: { ...ADMINISTRATIVE_WITHOUT_PHOTO, avatarUrl: UPLOADED_AVATAR_URL },
  pedagogical: null,
}

const SERVER_CONSTRAINTS = {
  maxUploadBytes: 1_000_000,
  acceptedContentTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'],
  outputContentType: 'image/webp',
  maxDimensionPixels: 512,
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

function makePhotoBlob() {
  return new Blob(['octets'], { type: 'image/webp' })
}

function makePhotoFile() {
  return new File([new Uint8Array([1, 2, 3])], 'photo.jpg', { type: 'image/jpeg' })
}

function selectPhotoFile() {
  const fileInput = screen.getByLabelText(/photo/i) as HTMLInputElement
  fireEvent.change(fileInput, { target: { files: [makePhotoFile()] } })
}

/** Quitte l'onglet administratif puis y revient : le panneau est démonté entre-temps. */
function switchTabsBackAndForth() {
  fireEvent.click(screen.getByRole('tab', { name: 'Profil pédagogique' }))
  fireEvent.click(screen.getByRole('tab', { name: 'Profil administratif' }))
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUseAuth.mockReturnValue(buildAuthMock())
  mockApiClient.get = vi.fn().mockResolvedValue({ data: [] })
  mockFetchTeacherStudentRelations.mockResolvedValue([])
  mockFetchInternalNotes.mockResolvedValue([])
  mockFetchProfileStatistics.mockResolvedValue({})
  mockFetchProfileAvatarConstraints.mockResolvedValue(SERVER_CONSTRAINTS)
  mockFetchProfileAvatarBlob.mockResolvedValue(makePhotoBlob())
})

describe('ProfilePage — la photo enregistrée survit à la navigation', () => {
  it('redemande le profil au serveur après un envoi réussi', async () => {
    mockFetchProfile.mockResolvedValueOnce(PROFILE_WITHOUT_PHOTO)
    mockFetchProfile.mockResolvedValue(PROFILE_WITH_PHOTO)
    mockUploadProfileAvatar.mockResolvedValue({ avatarUrl: UPLOADED_AVATAR_URL })

    renderProfilePage()
    await screen.findByLabelText('Ajouter une photo')
    expect(mockFetchProfile).toHaveBeenCalledTimes(1)

    selectPhotoFile()

    // C'est le point qui manquait : sans cette relecture, la source de vérité de
    // la page reste la copie d'avant l'envoi, où `avatarUrl` vaut `null`.
    await waitFor(() => {
      expect(mockFetchProfile).toHaveBeenCalledTimes(2)
    })
  })

  it("affiche encore la photo après un aller-retour d'onglet", async () => {
    mockFetchProfile.mockResolvedValueOnce(PROFILE_WITHOUT_PHOTO)
    mockFetchProfile.mockResolvedValue(PROFILE_WITH_PHOTO)
    mockUploadProfileAvatar.mockResolvedValue({ avatarUrl: UPLOADED_AVATAR_URL })

    renderProfilePage()
    await screen.findByLabelText('Ajouter une photo')

    selectPhotoFile()
    await screen.findByRole('img', { name: /Marie Dupont/ })

    // Le panneau administratif est démonté puis remonté : il repart de
    // l'`avatarUrl` porté par la page, pas de son état local perdu.
    switchTabsBackAndForth()

    expect(await screen.findByRole('img', { name: /Marie Dupont/ })).toBeDefined()
  })

  it('affiche encore la photo après un remontage complet de la page', async () => {
    mockFetchProfile.mockResolvedValueOnce(PROFILE_WITHOUT_PHOTO)
    mockFetchProfile.mockResolvedValue(PROFILE_WITH_PHOTO)
    mockUploadProfileAvatar.mockResolvedValue({ avatarUrl: UPLOADED_AVATAR_URL })

    const { unmount } = renderProfilePage()
    await screen.findByLabelText('Ajouter une photo')

    selectPhotoFile()
    await screen.findByRole('img', { name: /Marie Dupont/ })

    // Quitter la page puis y revenir, comme le ferait la navigation.
    unmount()
    renderProfilePage()

    expect(await screen.findByRole('img', { name: /Marie Dupont/ })).toBeDefined()
  })
})

describe('ProfilePage — la suppression survit elle aussi à la navigation', () => {
  it('redemande le profil au serveur après une suppression réussie', async () => {
    mockFetchProfile.mockResolvedValueOnce(PROFILE_WITH_PHOTO)
    mockFetchProfile.mockResolvedValue(PROFILE_WITHOUT_PHOTO)
    mockDeleteProfileAvatar.mockResolvedValue(undefined)

    renderProfilePage()
    await screen.findByRole('img', { name: /Marie Dupont/ })

    fireEvent.click(screen.getByRole('button', { name: /supprimer/i }))

    await waitFor(() => {
      expect(mockFetchProfile).toHaveBeenCalledTimes(2)
    })
  })

  it("ne fait pas réapparaître la photo supprimée après un aller-retour d'onglet", async () => {
    mockFetchProfile.mockResolvedValueOnce(PROFILE_WITH_PHOTO)
    mockFetchProfile.mockResolvedValue(PROFILE_WITHOUT_PHOTO)
    mockDeleteProfileAvatar.mockResolvedValue(undefined)

    renderProfilePage()
    await screen.findByRole('img', { name: /Marie Dupont/ })

    fireEvent.click(screen.getByRole('button', { name: /supprimer/i }))
    await waitFor(() => {
      expect(screen.getByTestId('profile-avatar-initials')).toBeDefined()
    })

    switchTabsBackAndForth()

    // Symptôme inverse, même cause : une copie périmée ressusciterait la photo.
    await waitFor(() => {
      expect(screen.getByTestId('profile-avatar-initials')).toBeDefined()
    })
    expect(screen.queryByRole('img', { name: /Marie Dupont/ })).toBeNull()
  })
})

describe('ProfilePage — le rafraîchissement ne casse pas le formulaire administratif', () => {
  it('conserve la saisie en cours pendant la relecture du profil', async () => {
    mockFetchProfile.mockResolvedValueOnce(PROFILE_WITHOUT_PHOTO)
    mockFetchProfile.mockResolvedValue(PROFILE_WITH_PHOTO)
    mockUploadProfileAvatar.mockResolvedValue({ avatarUrl: UPLOADED_AVATAR_URL })

    renderProfilePage()
    const firstNameInput = (await screen.findByLabelText('Prénom')) as HTMLInputElement

    fireEvent.change(firstNameInput, { target: { value: 'Marion' } })
    selectPhotoFile()

    await waitFor(() => {
      expect(mockFetchProfile).toHaveBeenCalledTimes(2)
    })
    // La photo n'est pas un champ de ce formulaire : la relire ne doit pas
    // effacer ce que l'utilisateur est en train d'écrire.
    expect((screen.getByLabelText('Prénom') as HTMLInputElement).value).toBe('Marion')
  })

  it("garde la photo affichée après l'enregistrement du formulaire administratif", async () => {
    mockFetchProfile.mockResolvedValueOnce(PROFILE_WITHOUT_PHOTO)
    mockFetchProfile.mockResolvedValue(PROFILE_WITH_PHOTO)
    mockUploadProfileAvatar.mockResolvedValue({ avatarUrl: UPLOADED_AVATAR_URL })
    mockUpdateAdministrativeProfile.mockResolvedValue(ADMINISTRATIVE_WITHOUT_PHOTO)

    renderProfilePage()
    await screen.findByLabelText('Ajouter une photo')

    selectPhotoFile()
    await screen.findByRole('img', { name: /Marie Dupont/ })

    fireEvent.click(screen.getByRole('button', { name: /enregistrer/i }))

    await waitFor(() => {
      expect(mockUpdateAdministrativeProfile).toHaveBeenCalled()
    })
    // `PUT /administrative` ne renvoie pas `avatarUrl` et ne doit pas réinjecter
    // une version périmée du profil dans l'état de la page.
    expect(await screen.findByRole('img', { name: /Marie Dupont/ })).toBeDefined()
    expect(screen.queryByTestId('profile-avatar-initials')).toBeNull()
  })
})
