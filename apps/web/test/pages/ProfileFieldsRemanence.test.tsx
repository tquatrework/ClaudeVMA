/**
 * Rémanence des champs enregistrés — généralisation du correctif de la photo.
 *
 * Demande de l'utilisateur, 2026-08-10 : « ce qui est valable pour la photo doit
 * être valable pour les autres champs (au minimum une fois enregistrés), ils
 * doivent rester rémanents, c'est-à-dire qu'un changement d'onglet doit les
 * conserver si l'on revient en arrière (même s'il n'y a pas d'appel) ».
 *
 * Cause commune : les trois écritures de profil renvoient la ressource **à
 * jour**, et le front jetait cette réponse (`await update…` suivi d'un simple
 * `return true`). L'écran restait donc sur les valeurs d'avant l'enregistrement,
 * exactement comme la photo avant le 2026-08-10.
 *
 * Ces tests durcissent volontairement le serveur simulé : il répond des valeurs
 * **différentes** de celles envoyées (normalisation, mise en majuscules,
 * traçabilité, `filledBy`/`filledAt`). C'est la seule façon de distinguer
 * « j'affiche la réponse du serveur » de « j'affiche mon propre corps de
 * requête » — cette seconde lecture serait la même famille de mensonge à l'écran
 * que celle corrigée pour la photo.
 *
 * Et rémanence veut dire **sans nouvelle requête** : `GET /profiles/:userId`
 * n'est jamais rejoué, ni après l'enregistrement, ni au changement d'onglet.
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
  updateAdministrativeProfile,
  updatePedagogicalProfile,
  updatePrescription,
} from '../../src/api/profile'
import { fetchTeacherStudentRelations } from '../../src/api/relations'

const mockUseAuth = vi.mocked(useAuth)
const mockApiClient = vi.mocked(apiClient)
const mockFetchProfile = vi.mocked(fetchProfile)
const mockFetchProfileAvatarBlob = vi.mocked(fetchProfileAvatarBlob)
const mockUpdateAdministrativeProfile = vi.mocked(updateAdministrativeProfile)
const mockUpdatePedagogicalProfile = vi.mocked(updatePedagogicalProfile)
const mockUpdatePrescription = vi.mocked(updatePrescription)

const USER_ID = 'student-1'
const AVATAR_URL = `/api/v1/profiles/${USER_ID}/avatar?v=1754820000000`

const STUDENT_USER = {
  id: USER_ID,
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

/** `GET /profiles/:userId` avant toute écriture. Aucune traçabilité posée. */
const LOADED_PROFILE = {
  userId: USER_ID,
  pedagogicalType: 'student' as const,
  administrative: {
    firstName: 'Marie',
    lastName: 'Dupont',
    phone: '0612345678',
    avatarUrl: AVATAR_URL,
  },
  pedagogical: {
    level: 'Première',
    subjects: ['Mathématiques'],
    generalAssessment: 'Bases solides, manque de méthode.',
  },
}

/**
 * Réponse de `PUT /profiles/:userId/administrative` : le serveur normalise la
 * saisie et pose `updatedAt`. Rien de tout cela n'est dans le corps envoyé.
 */
const SAVED_ADMINISTRATIVE = {
  userId: USER_ID,
  firstName: 'Marion',
  lastName: 'DUPONT',
  phone: '06 12 34 56 78',
  updatedAt: '2026-08-10T09:30:00.000Z',
}

/** Réponse de `PUT /profiles/:userId/pedagogical` — section déclarative seule. */
const SAVED_PEDAGOGICAL = {
  userId: USER_ID,
  level: 'Terminale générale',
  subjects: ['Mathématiques', 'Physique'],
}

function buildAuthMock(user: typeof STUDENT_USER | typeof RP_USER) {
  return {
    user,
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    hasRole: vi.fn((...roles: string[]) => roles.includes(user.role)),
    isInternalRole: vi.fn(() => user.role !== 'eleve'),
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

function typeIn(fieldLabel: string, value: string) {
  fireEvent.change(screen.getByLabelText(fieldLabel), { target: { value } })
}

function valueOf(fieldLabel: string): string {
  return (screen.getByLabelText(fieldLabel) as HTMLInputElement).value
}

function submitFormOf(fieldLabel: string) {
  fireEvent.submit(screen.getByLabelText(fieldLabel).closest('form') as HTMLFormElement)
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUseAuth.mockReturnValue(buildAuthMock(STUDENT_USER))
  mockApiClient.get = vi.fn().mockResolvedValue({ data: [] })
  vi.mocked(fetchTeacherStudentRelations).mockResolvedValue([])
  vi.mocked(fetchInternalNotes).mockResolvedValue([])
  vi.mocked(fetchProfileStatistics).mockResolvedValue({})
  vi.mocked(fetchProfileAvatarConstraints).mockResolvedValue({
    maxUploadBytes: 1_000_000,
    acceptedContentTypes: ['image/jpeg', 'image/png', 'image/webp'],
    outputContentType: 'image/webp',
    maxDimensionPixels: 512,
  })
  mockFetchProfileAvatarBlob.mockResolvedValue(new Blob(['octets'], { type: 'image/webp' }))
  mockFetchProfile.mockResolvedValue(LOADED_PROFILE)
  mockUpdateAdministrativeProfile.mockResolvedValue(SAVED_ADMINISTRATIVE)
  mockUpdatePedagogicalProfile.mockResolvedValue(SAVED_PEDAGOGICAL)
})

describe('Fiche profil — les champs enregistrés restent à l’écran', () => {
  it('affiche les valeurs renvoyées par le serveur, pas celles qui ont été saisies', async () => {
    renderProfilePage()
    await screen.findByLabelText('Prénom')

    typeIn('Prénom', 'marion')
    typeIn('Nom', 'dupont')
    submitFormOf('Prénom')

    await waitFor(() => {
      expect(mockUpdateAdministrativeProfile).toHaveBeenCalled()
    })

    // Le serveur a normalisé : c'est sa réponse qui fait foi, pas la frappe.
    await waitFor(() => {
      expect(valueOf('Prénom')).toBe('Marion')
    })
    expect(valueOf('Nom')).toBe('DUPONT')
    expect(valueOf('Téléphone')).toBe('06 12 34 56 78')
  })

  it('conserve les champs administratifs enregistrés après un aller-retour d’onglet', async () => {
    renderProfilePage()
    await screen.findByLabelText('Prénom')

    typeIn('Prénom', 'marion')
    submitFormOf('Prénom')
    await waitFor(() => {
      expect(valueOf('Prénom')).toBe('Marion')
    })

    const readsBeforeTabs = mockFetchProfile.mock.calls.length

    clickTab('Profil pédagogique')
    clickTab('Profil administratif')

    expect(valueOf('Prénom')).toBe('Marion')
    expect(valueOf('Nom')).toBe('DUPONT')
    // Rémanence sans réseau : aucune relecture pour retrouver ces valeurs.
    expect(mockFetchProfile.mock.calls.length).toBe(readsBeforeTabs)
    expect(mockFetchProfile).toHaveBeenCalledTimes(1)
  })

  it('fait suivre la traçabilité et le nom affiché sous la photo', async () => {
    renderProfilePage()
    await screen.findByLabelText('Prénom')
    await screen.findByRole('img', { name: /Marie Dupont/ })

    // Rien à afficher avant : le profil chargé ne porte aucune date de
    // modification, et deux lignes « Non renseigné » n'apprendraient rien.
    expect(screen.queryByText('Dernière modification')).toBeNull()

    typeIn('Prénom', 'marion')
    submitFormOf('Prénom')

    // Le nom sous la photo vient du bloc administratif de la page : il suit
    // l'enregistrement, sans relire le profil.
    await screen.findByRole('img', { name: /Marion DUPONT/ })
    expect(screen.getByText('Dernière modification')).toBeDefined()
    expect(mockFetchProfile).toHaveBeenCalledTimes(1)
  })

  it('conserve le profil pédagogique enregistré, sans écraser la prescription', async () => {
    renderProfilePage()
    await screen.findByLabelText('Prénom')

    clickTab('Profil pédagogique')
    await screen.findByLabelText('Niveau scolaire')

    typeIn('Niveau scolaire', 'terminale')
    submitFormOf('Niveau scolaire')

    await waitFor(() => {
      expect(valueOf('Niveau scolaire')).toBe('Terminale générale')
    })
    expect(valueOf('Matières')).toBe('Mathématiques, Physique')

    // La réponse du `PUT .../pedagogical` ne porte que la section déclarative :
    // fusionnée, pas substituée, sans quoi les préconisations du RP
    // disparaîtraient de l'écran.
    expect(screen.getByText('Bases solides, manque de méthode.')).toBeDefined()

    clickTab('Profil administratif')
    clickTab('Profil pédagogique')

    expect(valueOf('Niveau scolaire')).toBe('Terminale générale')
    expect(screen.getByText('Bases solides, manque de méthode.')).toBeDefined()
    expect(mockFetchProfile).toHaveBeenCalledTimes(1)
  })
})

describe('Écran d’édition — même règle sur les trois routes', () => {
  it('réaffiche les champs administratifs tels que le serveur les a enregistrés', async () => {
    renderEditPage()
    await screen.findByLabelText('Prénom')

    typeIn('Prénom', 'marion')
    submitFormOf('Prénom')

    await waitFor(() => {
      expect(valueOf('Prénom')).toBe('Marion')
    })

    clickTab('Profil pédagogique')
    clickTab('Profil administratif')

    expect(valueOf('Prénom')).toBe('Marion')
    expect(valueOf('Nom')).toBe('DUPONT')
    expect(mockFetchProfile).toHaveBeenCalledTimes(1)
  })

  it('réaffiche la prescription telle que le serveur l’a enregistrée', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(RP_USER))
    mockUpdatePrescription.mockResolvedValue({
      userId: USER_ID,
      // Profil pédagogique complet : le serveur renvoie aussi le déclaratif…
      level: 'Première',
      subjects: ['Mathématiques'],
      // …la prescription normalisée…
      generalAssessment: 'Bases solides, méthode à consolider.',
      recommendedPace: 'Deux séances hebdomadaires',
      // …et la traçabilité qu'il pose lui-même.
      filledBy: RP_USER.id,
      filledAt: '2026-08-10T10:15:00.000Z',
    })

    renderEditPage()
    await screen.findByLabelText('Prénom')

    clickTab('Préconisations')
    await screen.findByLabelText('Considération générale')

    typeIn('Considération générale', 'bases solides, methode a consolider')
    typeIn('Rythme préconisé', 'deux seances hebdo')
    submitFormOf('Considération générale')

    await waitFor(() => {
      expect(mockUpdatePrescription).toHaveBeenCalled()
    })

    // Ce que le RP lit après enregistrement est le texte enregistré, pas sa
    // frappe : le serveur reste seul juge de ce qui est en base.
    await waitFor(() => {
      expect(valueOf('Considération générale')).toBe('Bases solides, méthode à consolider.')
    })
    expect(valueOf('Rythme préconisé')).toBe('Deux séances hebdomadaires')

    clickTab('Profil administratif')
    clickTab('Préconisations')

    expect(valueOf('Considération générale')).toBe('Bases solides, méthode à consolider.')
    expect(mockFetchProfile).toHaveBeenCalledTimes(1)
  })
})
