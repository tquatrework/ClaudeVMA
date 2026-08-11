/**
 * Onglet « Profil financier » de la fiche de profil.
 *
 * Demande de l'utilisateur (2026-08-11) : « le profil financier (qui apparait
 * dans le profil administratif avec un bouton gérer, doit en fait être un
 * troisième onglet : profil financier, aussi bien pour les parents que pour les
 * formateurs. »
 *
 * Trois familles de propriétés sont gardées ici :
 *
 * 1. **Qui le voit** — parent financeur, formateur et animateur pédagogique sur
 *    leur propre fiche ; ni l'élève, ni le RP, ni un tiers. Un onglet affiché à
 *    un rôle qui n'a pas de profil financier lui promettrait un écran vide.
 * 2. **Le déplacement, pas le doublon** — la carte « Gérer » a quitté l'onglet
 *    administratif, et plus aucun lien de la fiche ne mène à `/finance`.
 * 3. **La permanence** — le panneau est monté à la première ouverture de son
 *    onglet, puis conservé : un aller-retour ne redemande rien et ne perd rien.
 *
 * S'y ajoute la règle « aucun UUID à l'écran » : l'identifiant du titulaire ne
 * doit apparaître nulle part dans l'onglet.
 */

import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ProfilePage from '../../src/pages/ProfilePage'

vi.mock('../../src/hooks/useAuth')
vi.mock('../../src/api/client')
vi.mock('../../src/api/profile')
vi.mock('../../src/api/relations')
vi.mock('../../src/api/finance')

import { useAuth } from '../../src/hooks/useAuth'
import apiClient from '../../src/api/client'
import {
  fetchInternalNotes,
  fetchProfile,
  fetchProfileAvatarBlob,
  fetchProfileAvatarConstraints,
} from '../../src/api/profile'
import { fetchTeacherStudentRelations } from '../../src/api/relations'
import { fetchFinancialArchives, fetchFinancialProfile } from '../../src/api/finance'
import type { UserRole } from '../../src/types/user'

const mockUseAuth = vi.mocked(useAuth)
const mockApiClient = vi.mocked(apiClient)
const mockFetchProfile = vi.mocked(fetchProfile)
const mockFetchFinancialProfile = vi.mocked(fetchFinancialProfile)
const mockFetchFinancialArchives = vi.mocked(fetchFinancialArchives)

const FINANCIAL_TAB_LABEL = 'Profil financier'

const TEACHER_ID = 'teacher-1'

const FINANCIAL_PROFILE = {
  id: 'financial-1',
  ownerId: TEACHER_ID,
  profileType: 'membre' as const,
  pointsBalance: 42,
  paymentMethod: 'virement' as const,
  paymentReference: 'FR76 1234',
}

const FINANCIAL_ARCHIVES = [
  {
    id: 'archive-1',
    ownerId: TEACHER_ID,
    itemType: 'payment' as const,
    referenceId: 'pay-1',
    label: 'Paiement inscription',
    amountCents: 9900,
    balanceSnapshot: 9900,
    occurredAt: '2026-02-03T10:00:00.000Z',
  },
]

const LOADED_PROFILE = {
  userId: TEACHER_ID,
  pedagogicalType: 'teacher' as const,
  administrative: { firstName: 'Claire', lastName: 'Bernard' },
  pedagogical: { levels: ['Seconde'], subjects: ['Mathématiques'] },
}

function buildAuthMock(userId: string, role: UserRole) {
  return {
    user: {
      id: userId,
      email: `${role}@test.com`,
      role,
      validationStatus: 'active' as const,
    },
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    hasRole: vi.fn((...roles: string[]) => roles.includes(role)),
    isInternalRole: vi.fn(() =>
      (
        [
          'responsable_pedagogique',
          'animateur_pedagogique',
          'technicien_informatique',
          'administrateur_financier',
        ] as string[]
      ).includes(role),
    ),
  }
}

/** Rend la fiche du profil `viewedUserId`, consultée par `viewerUserId`. */
function renderProfilePage(viewedUserId: string, viewerUserId: string, role: UserRole) {
  mockUseAuth.mockReturnValue(buildAuthMock(viewerUserId, role))
  return render(
    <MemoryRouter initialEntries={[`/profiles/${viewedUserId}`]}>
      <Routes>
        <Route path="/profiles/:userId" element={<ProfilePage />} />
      </Routes>
    </MemoryRouter>,
  )
}

function clickTab(tabLabel: string) {
  fireEvent.click(screen.getByRole('tab', { name: tabLabel }))
}

beforeEach(() => {
  vi.clearAllMocks()
  mockApiClient.get = vi.fn().mockResolvedValue({ data: [] })
  vi.mocked(fetchTeacherStudentRelations).mockResolvedValue([])
  vi.mocked(fetchInternalNotes).mockResolvedValue([])
  vi.mocked(fetchProfileAvatarConstraints).mockResolvedValue({
    maxUploadBytes: 1_000_000,
    acceptedContentTypes: ['image/webp'],
    outputContentType: 'image/webp',
    maxDimensionPixels: 512,
  })
  vi.mocked(fetchProfileAvatarBlob).mockResolvedValue(new Blob(['octets'], { type: 'image/webp' }))
  mockFetchProfile.mockResolvedValue(LOADED_PROFILE)
  mockFetchFinancialProfile.mockResolvedValue(FINANCIAL_PROFILE)
  mockFetchFinancialArchives.mockResolvedValue(FINANCIAL_ARCHIVES)
})

describe('Fiche profil — qui voit l’onglet « Profil financier »', () => {
  it('le formateur le voit sur sa propre fiche', async () => {
    renderProfilePage(TEACHER_ID, TEACHER_ID, 'formateur')
    await screen.findByRole('tab', { name: FINANCIAL_TAB_LABEL })
  })

  it('le parent financeur le voit sur sa propre fiche', async () => {
    renderProfilePage('parent-1', 'parent-1', 'parent_financeur')
    await screen.findByRole('tab', { name: FINANCIAL_TAB_LABEL })
  })

  it('l’animateur pédagogique le voit — c’est un formateur promu, rémunéré comme tel', async () => {
    renderProfilePage('ap-1', 'ap-1', 'animateur_pedagogique')
    await screen.findByRole('tab', { name: FINANCIAL_TAB_LABEL })
  })

  it('l’élève ne le voit pas : il ne finance rien, c’est son parent financeur qui paie', async () => {
    renderProfilePage('student-1', 'student-1', 'eleve')
    await screen.findByRole('tab', { name: 'Profil administratif' })

    expect(screen.queryByRole('tab', { name: FINANCIAL_TAB_LABEL })).toBeNull()
  })

  it('le responsable pédagogique ne le voit pas sur sa propre fiche', async () => {
    renderProfilePage('rp-1', 'rp-1', 'responsable_pedagogique')
    await screen.findByRole('tab', { name: 'Profil administratif' })

    expect(screen.queryByRole('tab', { name: FINANCIAL_TAB_LABEL })).toBeNull()
  })

  it('le RP ne le voit pas non plus sur la fiche d’un formateur — il passe par /finance/:ownerId', async () => {
    renderProfilePage(TEACHER_ID, 'rp-1', 'responsable_pedagogique')
    await screen.findByRole('tab', { name: 'Profil administratif' })

    expect(screen.queryByRole('tab', { name: FINANCIAL_TAB_LABEL })).toBeNull()
  })
})

describe('Fiche profil — le profil financier a bien été déplacé', () => {
  it('l’onglet administratif ne propose plus de carte « Gérer » vers /finance', async () => {
    renderProfilePage(TEACHER_ID, TEACHER_ID, 'formateur')
    await screen.findByRole('tab', { name: FINANCIAL_TAB_LABEL })

    const financeLinks = screen
      .queryAllByRole('link')
      .filter((link) => link.getAttribute('href') === '/finance')
    expect(financeLinks).toHaveLength(0)
  })

  it('ne charge rien de financier tant que l’onglet n’a pas été ouvert', async () => {
    renderProfilePage(TEACHER_ID, TEACHER_ID, 'formateur')
    await screen.findByRole('tab', { name: FINANCIAL_TAB_LABEL })

    expect(mockFetchFinancialProfile).not.toHaveBeenCalled()
  })
})

describe('Fiche profil — contenu et permanence de l’onglet financier', () => {
  it('affiche le statut, le solde et l’historique à la première ouverture', async () => {
    renderProfilePage(TEACHER_ID, TEACHER_ID, 'formateur')
    await screen.findByRole('tab', { name: FINANCIAL_TAB_LABEL })

    clickTab(FINANCIAL_TAB_LABEL)

    expect(await screen.findByText('Membre')).toBeDefined()
    expect(screen.getByText('42')).toBeDefined()
    expect(screen.getByText('Paiement inscription')).toBeDefined()
    // Le type d'archive est lisible en français, pas dans sa valeur technique.
    expect(screen.getByText('Paiement')).toBeDefined()
    expect(screen.queryByText('payment')).toBeNull()
  })

  it('n’affiche aucun identifiant technique du titulaire', async () => {
    renderProfilePage(TEACHER_ID, TEACHER_ID, 'formateur')
    await screen.findByRole('tab', { name: FINANCIAL_TAB_LABEL })

    clickTab(FINANCIAL_TAB_LABEL)
    await screen.findByText('Membre')

    expect(screen.queryByText(new RegExp(TEACHER_ID))).toBeNull()
    expect(screen.queryByText(/Identifiant propriétaire/)).toBeNull()
  })

  it('ne redemande rien sur un aller-retour d’onglet', async () => {
    renderProfilePage(TEACHER_ID, TEACHER_ID, 'formateur')
    await screen.findByRole('tab', { name: FINANCIAL_TAB_LABEL })

    clickTab(FINANCIAL_TAB_LABEL)
    await screen.findByText('Membre')

    clickTab('Profil administratif')
    clickTab(FINANCIAL_TAB_LABEL)
    clickTab('Profil administratif')
    clickTab(FINANCIAL_TAB_LABEL)

    await waitFor(() => {
      expect(mockFetchFinancialProfile).toHaveBeenCalledTimes(1)
    })
    expect(mockFetchFinancialArchives).toHaveBeenCalledTimes(1)
    expect(mockFetchProfile).toHaveBeenCalledTimes(1)
    // Le panneau n'a pas été reconstruit : le solde est toujours affiché.
    expect(screen.getByText('42')).toBeDefined()
  })

  it('conserve la saisie du moyen de paiement d’un aller-retour d’onglet', async () => {
    renderProfilePage(TEACHER_ID, TEACHER_ID, 'formateur')
    await screen.findByRole('tab', { name: FINANCIAL_TAB_LABEL })

    clickTab(FINANCIAL_TAB_LABEL)
    await screen.findByText('Membre')

    // « Modifier » de l'éditeur de moyen de paiement — l'en-tête de la fiche
    // porte un lien du même nom vers l'écran d'édition du profil.
    fireEvent.click(screen.getByRole('button', { name: 'Modifier' }))
    const referenceInput = (await screen.findByPlaceholderText(
      /IBAN/,
    )) as HTMLInputElement
    fireEvent.change(referenceInput, { target: { value: 'FR76 9999' } })

    clickTab('Profil administratif')
    clickTab(FINANCIAL_TAB_LABEL)

    expect((screen.getByPlaceholderText(/IBAN/) as HTMLInputElement).value).toBe('FR76 9999')
  })
})

describe('Fiche profil — onglet financier, cas d’erreur', () => {
  it('affiche « Profil financier introuvable. » sur un 404 sans casser la fiche', async () => {
    mockFetchFinancialProfile.mockRejectedValue({ response: { status: 404 } })

    renderProfilePage(TEACHER_ID, TEACHER_ID, 'formateur')
    await screen.findByRole('tab', { name: FINANCIAL_TAB_LABEL })

    clickTab(FINANCIAL_TAB_LABEL)

    expect(await screen.findByText('Profil financier introuvable.')).toBeDefined()
    // Les autres onglets restent utilisables.
    clickTab('Profil administratif')
    expect(screen.getByLabelText('Prénom')).toBeDefined()
  })

  it('affiche « Accès refusé. » sur un 403', async () => {
    mockFetchFinancialProfile.mockRejectedValue({ response: { status: 403 } })

    renderProfilePage(TEACHER_ID, TEACHER_ID, 'formateur')
    await screen.findByRole('tab', { name: FINANCIAL_TAB_LABEL })

    clickTab(FINANCIAL_TAB_LABEL)

    expect(await screen.findByText('Accès refusé.')).toBeDefined()
  })

  it('reste lisible quand seules les archives échouent', async () => {
    mockFetchFinancialArchives.mockRejectedValue({ response: { status: 500 } })

    renderProfilePage(TEACHER_ID, TEACHER_ID, 'formateur')
    await screen.findByRole('tab', { name: FINANCIAL_TAB_LABEL })

    clickTab(FINANCIAL_TAB_LABEL)

    expect(await screen.findByText('Membre')).toBeDefined()
    expect(screen.getByText('Aucune archive disponible.')).toBeDefined()
  })
})
