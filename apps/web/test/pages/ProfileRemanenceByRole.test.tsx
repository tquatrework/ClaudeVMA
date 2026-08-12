/**
 * Rémanence des informations — **vérification rôle par rôle**.
 *
 * Demande de l'utilisateur (2026-08-11) : « Vérifie que les autres profils,
 * parents, professeurs, AP, RP sont traités de la même manière pour la
 * permanence des informations. »
 *
 * Le mécanisme corrigé le 2026-08-10 est générique — l'état appartient à la
 * page, la réponse du serveur y est fusionnée bloc par bloc — mais « écrit
 * générique » n'est pas « vérifié pour chaque rôle » : les écrans diffèrent par
 * les onglets affichés, par la forme du profil pédagogique (élève / formateur)
 * et par les panneaux réservés à certains rôles.
 *
 * Chaque cas vérifie les quatre mêmes propriétés :
 * 1. l'écran affiche **la réponse du serveur**, pas le corps envoyé (le serveur
 *    simulé répond volontairement autre chose que ce qui est saisi) ;
 * 2. un aller-retour d'onglet ne perd rien ;
 * 3. aucune relecture : `GET /profiles/:userId` n'est appelé qu'une fois ;
 * 4. un échec d'enregistrement laisse la saisie à l'écran et affiche l'erreur —
 *    un formulaire vidé après un refus serveur ferait perdre le travail.
 */

import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ProfilePage from '../../src/pages/ProfilePage'

vi.mock('../../src/hooks/useAuth')
vi.mock('../../src/api/client')
vi.mock('../../src/api/profile')
vi.mock('../../src/api/relations')
vi.mock('../../src/api/teacherRequests')

import { useAuth } from '../../src/hooks/useAuth'
import apiClient from '../../src/api/client'
import {
  fetchInternalNotes,
  fetchProfile,
  fetchProfileAvatarBlob,
  fetchProfileAvatarConstraints,
  fetchProfileStatistics,
  fetchTeacherValidationStatus,
  updateAdministrativeProfile,
  updatePedagogicalProfile,
  updateTeacherValidationStatus,
} from '../../src/api/profile'
import {
  fetchLinkedStudents,
  fetchTeacherStudentRelations,
} from '../../src/api/relations'

const mockUseAuth = vi.mocked(useAuth)
const mockApiClient = vi.mocked(apiClient)
const mockFetchProfile = vi.mocked(fetchProfile)
const mockUpdateAdministrativeProfile = vi.mocked(updateAdministrativeProfile)
const mockUpdatePedagogicalProfile = vi.mocked(updatePedagogicalProfile)
const mockUpdateTeacherValidationStatus = vi.mocked(updateTeacherValidationStatus)

// ─── Comptes ─────────────────────────────────────────────────────────────────

const PARENT_USER = {
  id: 'parent-1',
  email: 'parent@test.com',
  role: 'parent_financeur' as const,
  validationStatus: 'active' as const,
}

const TEACHER_USER = {
  id: 'teacher-1',
  email: 'formateur@test.com',
  role: 'formateur' as const,
  validationStatus: 'active' as const,
}

const ANIMATOR_USER = {
  id: 'ap-1',
  email: 'ap@test.com',
  role: 'animateur_pedagogique' as const,
  validationStatus: 'active' as const,
}

const PEDAGOGICAL_MANAGER_USER = {
  id: 'rp-1',
  email: 'rp@test.com',
  role: 'responsable_pedagogique' as const,
  validationStatus: 'active' as const,
}

type TestUser = typeof PARENT_USER | typeof TEACHER_USER

/** Bloc administratif chargé, identique pour tous les rôles testés. */
const LOADED_ADMINISTRATIVE = {
  firstName: 'Claire',
  lastName: 'Bernard',
  phone: '0612345678',
}

/** Réponse du `PUT` : le serveur normalise et pose `updatedAt`. */
const SAVED_ADMINISTRATIVE = {
  userId: 'peu-importe',
  firstName: 'Claire-Marie',
  lastName: 'BERNARD',
  phone: '06 12 34 56 78',
  updatedAt: '2026-08-11T09:30:00.000Z',
}

/** Profil pédagogique formateur, sections confondues comme le serveur les renvoie. */
const LOADED_TEACHER_PEDAGOGICAL = {
  levels: ['Seconde'],
  subjects: ['Mathématiques'],
  experience: '8 ans en lycée',
  // Section prescription — écrite par le RP, jamais renvoyée par le formulaire.
  maxValidatedLevel: 'Terminale spécialité mathématiques',
}

const SAVED_TEACHER_PEDAGOGICAL = {
  userId: 'teacher-1',
  levels: ['Seconde', 'Première', 'Terminale'],
  subjects: ['Mathématiques'],
  experience: '8 ans en lycée, dont 3 en préparation aux concours',
}

function buildProfile(userId: string, pedagogical: Record<string, unknown> | null) {
  return {
    userId,
    pedagogicalType: pedagogical ? ('teacher' as const) : null,
    administrative: { userId, ...LOADED_ADMINISTRATIVE },
    pedagogical,
  }
}

function buildAuthMock(user: TestUser | typeof ANIMATOR_USER | typeof PEDAGOGICAL_MANAGER_USER) {
  return {
    user,
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    hasRole: vi.fn((...roles: string[]) => roles.includes(user.role)),
    isInternalRole: vi.fn(() =>
      (
        [
          'responsable_pedagogique',
          'animateur_pedagogique',
          'technicien_informatique',
          'administrateur_financier',
        ] as string[]
      ).includes(user.role),
    ),
  }
}

function renderProfilePage(userId: string) {
  return render(
    <MemoryRouter initialEntries={[`/profiles/${userId}`]}>
      <Routes>
        <Route path="/profiles/:userId" element={<ProfilePage />} />
      </Routes>
    </MemoryRouter>,
  )
}

const clickTab = (tabLabel: string) =>
  fireEvent.click(screen.getByRole('tab', { name: tabLabel }))

const typeIn = (fieldLabel: string, value: string) =>
  fireEvent.change(screen.getByLabelText(fieldLabel), { target: { value } })

const valueOf = (fieldLabel: string): string =>
  (screen.getByLabelText(fieldLabel) as HTMLInputElement).value

const submitFormOf = (fieldLabel: string) =>
  fireEvent.submit(screen.getByLabelText(fieldLabel).closest('form') as HTMLFormElement)

beforeEach(() => {
  vi.clearAllMocks()
  mockApiClient.get = vi.fn().mockResolvedValue({ data: [] })
  vi.mocked(fetchTeacherStudentRelations).mockResolvedValue([])
  vi.mocked(fetchLinkedStudents).mockResolvedValue([])
  vi.mocked(fetchInternalNotes).mockResolvedValue([])
  vi.mocked(fetchProfileStatistics).mockResolvedValue({})
  vi.mocked(fetchProfileAvatarConstraints).mockResolvedValue({
    maxUploadBytes: 1_000_000,
    acceptedContentTypes: ['image/jpeg', 'image/png', 'image/webp'],
    outputContentType: 'image/webp',
    maxDimensionPixels: 512,
  })
  vi.mocked(fetchProfileAvatarBlob).mockResolvedValue(
    new Blob(['octets'], { type: 'image/webp' }),
  )
  vi.mocked(fetchTeacherValidationStatus).mockResolvedValue({
    teacherId: 'teacher-1',
    status: 'in_review',
  } as never)
  mockUpdateAdministrativeProfile.mockResolvedValue(SAVED_ADMINISTRATIVE)
  mockUpdatePedagogicalProfile.mockResolvedValue(SAVED_TEACHER_PEDAGOGICAL)
})

// ─── Bloc administratif — tous les rôles ─────────────────────────────────────

describe.each([
  ['parent financeur', PARENT_USER, 'Mes élèves / enfants'],
  ['formateur', TEACHER_USER, 'Profil pédagogique'],
  ['animateur pédagogique', ANIMATOR_USER, 'Profil pédagogique'],
  ['responsable pédagogique', PEDAGOGICAL_MANAGER_USER, 'Confidentialité'],
])('profil administratif — %s sur son propre profil', (_roleLabel, user, otherTabLabel) => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue(buildAuthMock(user) as never)
    mockFetchProfile.mockResolvedValue(
      buildProfile(user.id, user.role === 'parent_financeur' ? null : LOADED_TEACHER_PEDAGOGICAL),
    )
  })

  it('réaffiche la réponse du serveur, pas la saisie', async () => {
    renderProfilePage(user.id)
    await screen.findByLabelText('Prénom')

    typeIn('Prénom', 'claire-marie')
    submitFormOf('Prénom')

    await waitFor(() => {
      expect(valueOf('Prénom')).toBe('Claire-Marie')
    })
    expect(valueOf('Nom')).toBe('BERNARD')
    expect(valueOf('Téléphone')).toBe('06 12 34 56 78')
  })

  it("conserve les valeurs enregistrées après un aller-retour d'onglet, sans relecture", async () => {
    renderProfilePage(user.id)
    await screen.findByLabelText('Prénom')

    typeIn('Prénom', 'claire-marie')
    submitFormOf('Prénom')
    await waitFor(() => {
      expect(valueOf('Prénom')).toBe('Claire-Marie')
    })

    clickTab(otherTabLabel)
    clickTab('Profil administratif')

    expect(valueOf('Prénom')).toBe('Claire-Marie')
    expect(valueOf('Nom')).toBe('BERNARD')
    expect(mockFetchProfile).toHaveBeenCalledTimes(1)
  })

  it('garde la saisie à l’écran quand le serveur refuse l’enregistrement', async () => {
    mockUpdateAdministrativeProfile.mockRejectedValueOnce({
      response: { status: 400, data: { message: 'property department should not exist' } },
    })

    renderProfilePage(user.id)
    await screen.findByLabelText('Prénom')

    typeIn('Prénom', 'claire-marie')
    submitFormOf('Prénom')

    // L'erreur est affichée **en français** — le détail technique du serveur
    // reste en console —, la frappe survit : rien n'est enregistré, rien n'est
    // perdu, et l'écran n'affiche pas une valeur que le serveur a refusée.
    await screen.findByText(/n'ont pas été acceptées/i)
    expect(valueOf('Prénom')).toBe('claire-marie')
    expect(mockFetchProfile).toHaveBeenCalledTimes(1)
  })
})

// ─── Profil pédagogique formateur — formateur et AP ──────────────────────────

describe.each([
  ['formateur', TEACHER_USER],
  ['animateur pédagogique', ANIMATOR_USER],
])('profil pédagogique formateur — %s sur son propre profil', (_roleLabel, user) => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue(buildAuthMock(user) as never)
    mockFetchProfile.mockResolvedValue(buildProfile(user.id, LOADED_TEACHER_PEDAGOGICAL))
  })

  it('réaffiche la section déclarative enregistrée et la conserve entre onglets', async () => {
    renderProfilePage(user.id)
    await screen.findByLabelText('Prénom')

    clickTab('Profil pédagogique')
    await screen.findByLabelText('Niveaux enseignés')

    typeIn('Niveaux enseignés', 'seconde, premiere, terminale')
    submitFormOf('Niveaux enseignés')

    await waitFor(() => {
      expect(valueOf('Niveaux enseignés')).toBe('Seconde, Première, Terminale')
    })
    expect(valueOf('Expérience pédagogique')).toBe(
      '8 ans en lycée, dont 3 en préparation aux concours',
    )

    clickTab('Profil administratif')
    clickTab('Profil pédagogique')

    expect(valueOf('Niveaux enseignés')).toBe('Seconde, Première, Terminale')
    expect(mockFetchProfile).toHaveBeenCalledTimes(1)
  })

  it("n'efface pas la prescription du RP en enregistrant sa propre section", async () => {
    // La réponse du `PUT .../pedagogical` ne porte que le déclaratif : fusionnée
    // dans le bloc, pas substituée à lui, sinon le niveau validé par le RP
    // disparaîtrait de l'écran sans que rien ne l'ait effacé en base.
    renderProfilePage(user.id)
    await screen.findByLabelText('Prénom')

    clickTab('Profil pédagogique')
    await screen.findByLabelText('Niveaux enseignés')

    typeIn('Niveaux enseignés', 'seconde, premiere, terminale')
    submitFormOf('Niveaux enseignés')

    await waitFor(() => {
      expect(valueOf('Niveaux enseignés')).toBe('Seconde, Première, Terminale')
    })
    expect(screen.getByText('Terminale spécialité mathématiques')).toBeDefined()
  })
})

// ─── Écrans du RP sur le profil d'un tiers ───────────────────────────────────

describe('responsable pédagogique sur la fiche d’un formateur', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue(buildAuthMock(PEDAGOGICAL_MANAGER_USER) as never)
    mockFetchProfile.mockResolvedValue(
      buildProfile(TEACHER_USER.id, LOADED_TEACHER_PEDAGOGICAL),
    )
  })

  it('conserve les champs administratifs qu’il vient d’enregistrer sur ce formateur', async () => {
    renderProfilePage(TEACHER_USER.id)
    await screen.findByLabelText('Prénom')

    typeIn('Prénom', 'claire-marie')
    submitFormOf('Prénom')
    await waitFor(() => {
      expect(valueOf('Prénom')).toBe('Claire-Marie')
    })

    clickTab('Profil pédagogique')
    clickTab('Profil administratif')

    expect(valueOf('Prénom')).toBe('Claire-Marie')
    expect(mockFetchProfile).toHaveBeenCalledTimes(1)
  })

  it('conserve le statut de validation formateur après un aller-retour d’onglet', async () => {
    // Panneau réservé RP/TI, monté dans l'onglet administratif : son statut vient
    // de la réponse du `PATCH`, et l'onglet reste monté — le statut ne doit ni
    // être rechargé ni retomber sur la valeur d'avant l'action.
    mockUpdateTeacherValidationStatus.mockResolvedValue({
      teacherId: TEACHER_USER.id,
      status: 'validated',
      updatedAt: '2026-08-11T09:45:00.000Z',
    } as never)

    renderProfilePage(TEACHER_USER.id)
    await screen.findByRole('button', { name: /valider le formateur/i })

    fireEvent.click(screen.getByRole('button', { name: /valider le formateur/i }))
    await screen.findByText('Validé')

    clickTab('Profil pédagogique')
    clickTab('Profil administratif')

    expect(screen.getByText('Validé')).toBeDefined()
    expect(vi.mocked(fetchTeacherValidationStatus)).toHaveBeenCalledTimes(1)
  })
})
