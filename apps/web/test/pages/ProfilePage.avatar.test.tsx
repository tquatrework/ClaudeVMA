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
 * dans l'onglet administratif — alors que `avatarUrl` est un champ du profil,
 * donc une donnée de la **page**. Quitter l'onglet démontait ce panneau et
 * perdait cet état ; y revenir le remontait avec l'`avatarUrl` d'avant l'envoi.
 *
 * Corrigé le 2026-08-10 à son vrai niveau : la page détient l'`avatarUrl` et la
 * met à jour avec **celle que le serveur a déjà renvoyée** dans la réponse du
 * `POST`. Une première tentative relisait le profil à chaque clic d'onglet —
 * du réseau pour compenser une erreur d'appartenance d'état ; elle a été
 * retirée.
 *
 * Ce que ces tests gardent :
 *
 * 1. un envoi réussi met à jour la source de vérité de la page **sans second
 *    aller-retour** : `GET /profiles/:userId` n'est pas rejoué ;
 * 2. un aller-retour d'onglet, puis un remontage complet de la page, affichent la
 *    **nouvelle** photo ;
 * 3. symptôme inverse, même cause : après une suppression, un retour ne fait pas
 *    réapparaître la photo depuis une copie périmée ;
 * 4. la photo affichée n'est écrasée ni par la saisie du formulaire
 *    administratif ni par son enregistrement.
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
  it("affiche la nouvelle photo sans redemander le profil au serveur", async () => {
    mockFetchProfile.mockResolvedValue(PROFILE_WITHOUT_PHOTO)
    mockUploadProfileAvatar.mockResolvedValue({ avatarUrl: UPLOADED_AVATAR_URL })

    renderProfilePage()
    await screen.findByLabelText('Ajouter une photo')
    expect(mockFetchProfile).toHaveBeenCalledTimes(1)

    selectPhotoFile()

    // La photo apparaît parce que la page a **reçu** l'URL renvoyée par le
    // `POST`, pas parce qu'elle est allée la rechercher. Le serveur ne renvoie
    // ici que le profil SANS photo : si l'écran relisait le profil, il
    // effacerait l'image qu'il vient d'afficher.
    expect(await screen.findByRole('img', { name: /Marie Dupont/ })).toBeDefined()
    expect(mockFetchProfile).toHaveBeenCalledTimes(1)
  })

  it("affiche encore la photo après un aller-retour d'onglet", async () => {
    mockFetchProfile.mockResolvedValueOnce(PROFILE_WITHOUT_PHOTO)
    mockFetchProfile.mockResolvedValue(PROFILE_WITH_PHOTO)
    mockUploadProfileAvatar.mockResolvedValue({ avatarUrl: UPLOADED_AVATAR_URL })

    renderProfilePage()
    await screen.findByLabelText('Ajouter une photo')

    selectPhotoFile()
    await screen.findByRole('img', { name: /Marie Dupont/ })

    // Le panneau reste monté, et la donnée qui l'alimente vit de toute façon
    // au-dessus de lui : rien à reconstruire, rien à retrouver.
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
  it('retire la photo sans redemander le profil au serveur', async () => {
    // Le serveur continuerait de renvoyer la photo : une relecture la ferait
    // réapparaître. La suppression est connue de la page, il n'y a rien à
    // demander.
    mockFetchProfile.mockResolvedValue(PROFILE_WITH_PHOTO)
    mockDeleteProfileAvatar.mockResolvedValue(undefined)

    renderProfilePage()
    await screen.findByRole('img', { name: /Marie Dupont/ })

    fireEvent.click(screen.getByRole('button', { name: /supprimer/i }))

    await waitFor(() => {
      expect(screen.getByTestId('profile-avatar-initials')).toBeDefined()
    })
    expect(mockFetchProfile).toHaveBeenCalledTimes(1)
  })

  it("ne fait pas réapparaître la photo supprimée après un aller-retour d'onglet", async () => {
    mockFetchProfile.mockResolvedValue(PROFILE_WITH_PHOTO)
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

describe('ProfilePage — la photo et le formulaire administratif cohabitent', () => {
  it("conserve la saisie en cours pendant l'envoi d'une photo", async () => {
    mockFetchProfile.mockResolvedValue(PROFILE_WITHOUT_PHOTO)
    mockUploadProfileAvatar.mockResolvedValue({ avatarUrl: UPLOADED_AVATAR_URL })

    renderProfilePage()
    const firstNameInput = (await screen.findByLabelText('Prénom')) as HTMLInputElement

    fireEvent.change(firstNameInput, { target: { value: 'Marion' } })
    selectPhotoFile()

    await screen.findByRole('img', { name: /Marie Dupont/ })
    // La photo n'est pas un champ de ce formulaire : la changer ne doit pas
    // effacer ce que l'utilisateur est en train d'écrire.
    expect((screen.getByLabelText('Prénom') as HTMLInputElement).value).toBe('Marion')
  })

  it("garde la photo affichée après l'enregistrement du formulaire administratif", async () => {
    mockFetchProfile.mockResolvedValue(PROFILE_WITHOUT_PHOTO)
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
