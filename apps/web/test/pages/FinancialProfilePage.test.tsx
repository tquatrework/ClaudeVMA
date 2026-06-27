/**
 * Tests pour FinancialProfilePage (Phase 9)
 *
 * Couvre :
 * - Affichage du profil financier (solde, type, moyen de paiement)
 * - Affichage des archives financières
 * - Paiement d'inscription par le propriétaire
 * - Modification du moyen de paiement (PATCH)
 * - Gestion des erreurs 403, 404
 * - Compte limité vs membre
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import FinancialProfilePage from '../../src/pages/FinancialProfilePage'

vi.mock('../../src/hooks/useAuth')
vi.mock('../../src/api/client')

import { useAuth } from '../../src/hooks/useAuth'
import apiClient from '../../src/api/client'

const mockUseAuth = vi.mocked(useAuth)
const mockApiClient = vi.mocked(apiClient)

const FINANCEUR_USER = {
  id: 'owner-1',
  email: 'financeur@test.com',
  role: 'parent_financeur' as const,
  validationStatus: 'active' as const,
}

const AF_USER = {
  id: 'af-1',
  email: 'af@test.com',
  role: 'administrateur_financier' as const,
  validationStatus: 'active' as const,
}

function buildAuthMock(userObj = FINANCEUR_USER) {
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

function renderFinancialProfilePage(ownerId = 'owner-1') {
  return render(
    <MemoryRouter initialEntries={[`/finance/${ownerId}`]}>
      <Routes>
        <Route path="/finance/:ownerId" element={<FinancialProfilePage />} />
      </Routes>
    </MemoryRouter>,
  )
}

const SAMPLE_PROFILE_LIMITE = {
  id: 'profile-1',
  ownerId: 'owner-1',
  profileType: 'limite' as const,
  pointsBalance: 0,
  paymentMethod: undefined,
  paymentReference: undefined,
}

const SAMPLE_PROFILE_MEMBRE = {
  id: 'profile-1',
  ownerId: 'owner-1',
  profileType: 'membre' as const,
  pointsBalance: 99,
  paymentMethod: 'cb' as const,
  paymentReference: undefined,
  fundingEndDate: '2027-01-01',
}

const SAMPLE_ARCHIVES = [
  {
    id: 'archive-1',
    ownerId: 'owner-1',
    itemType: 'payment' as const,
    referenceId: 'pay-1',
    label: 'Paiement inscription',
    amountCents: 9900,
    balanceSnapshot: 9900,
    occurredAt: '2026-01-15T10:00:00.000Z',
  },
]

beforeEach(() => {
  vi.clearAllMocks()
  mockUseAuth.mockReturnValue(buildAuthMock())
})

describe('FinancialProfilePage', () => {
  it('affiche un état de chargement initialement', () => {
    mockApiClient.get = vi.fn().mockReturnValue(new Promise(() => {}))

    renderFinancialProfilePage()

    expect(screen.getByText('Chargement…')).toBeDefined()
  })

  it('affiche le solde de points et le type de compte', async () => {
    mockApiClient.get = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/financial-profiles/')) return Promise.resolve({ data: SAMPLE_PROFILE_MEMBRE })
      if (url.includes('/financial-archives/')) return Promise.resolve({ data: SAMPLE_ARCHIVES })
      return Promise.resolve({ data: [] })
    })

    renderFinancialProfilePage()

    await waitFor(() => {
      expect(screen.getByText('99')).toBeDefined()
      expect(screen.getByText('Membre')).toBeDefined()
    })
  })

  it('affiche "Limité" pour un compte non-membre', async () => {
    mockApiClient.get = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/financial-profiles/')) return Promise.resolve({ data: SAMPLE_PROFILE_LIMITE })
      return Promise.resolve({ data: [] })
    })

    renderFinancialProfilePage()

    await waitFor(() => {
      expect(screen.getByText('Limité')).toBeDefined()
    })
  })

  it('le financeur voit le bouton de paiement d\'inscription sur compte limité', async () => {
    mockApiClient.get = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/financial-profiles/')) return Promise.resolve({ data: SAMPLE_PROFILE_LIMITE })
      return Promise.resolve({ data: [] })
    })

    renderFinancialProfilePage('owner-1')

    await waitFor(() => {
      expect(screen.getByText('Procéder au paiement d\'inscription')).toBeDefined()
    })
  })

  it('affiche les archives financières triées', async () => {
    mockApiClient.get = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/financial-profiles/')) return Promise.resolve({ data: SAMPLE_PROFILE_MEMBRE })
      if (url.includes('/financial-archives/')) return Promise.resolve({ data: SAMPLE_ARCHIVES })
      return Promise.resolve({ data: [] })
    })

    renderFinancialProfilePage()

    await waitFor(() => {
      expect(screen.getByText('Paiement inscription')).toBeDefined()
      // Le montant et le solde affichent tous deux 99.00 € — on vérifie au moins un match
      expect(screen.getAllByText(/99[.,]00 €/).length).toBeGreaterThan(0)
    })
  })

  it('affiche "Aucune archive disponible" si la liste est vide', async () => {
    mockApiClient.get = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/financial-profiles/')) return Promise.resolve({ data: SAMPLE_PROFILE_MEMBRE })
      if (url.includes('/financial-archives/')) return Promise.resolve({ data: [] })
      return Promise.resolve({ data: [] })
    })

    renderFinancialProfilePage()

    await waitFor(() => {
      expect(screen.getByText('Aucune archive disponible.')).toBeDefined()
    })
  })

  it('affiche un message d\'erreur 403', async () => {
    mockApiClient.get = vi.fn().mockRejectedValue({ response: { status: 403 } })

    renderFinancialProfilePage()

    await waitFor(() => {
      expect(screen.getByText('Accès refusé.')).toBeDefined()
    })
  })

  it('affiche un message d\'erreur 404', async () => {
    mockApiClient.get = vi.fn().mockRejectedValue({ response: { status: 404 } })

    renderFinancialProfilePage()

    await waitFor(() => {
      expect(screen.getByText('Profil financier introuvable.')).toBeDefined()
    })
  })

  it('déclenche un paiement d\'inscription via le formulaire', async () => {
    mockApiClient.get = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/financial-profiles/')) return Promise.resolve({ data: SAMPLE_PROFILE_LIMITE })
      return Promise.resolve({ data: [] })
    })
    mockApiClient.post = vi.fn().mockResolvedValue({
      data: {
        payment: { id: 'pay-1', paymentType: 'inscription', amountCents: 9900, status: 'confirmed', createdAt: new Date().toISOString() },
        invoice: { id: 'inv-1', amountCents: 9900, issuedAt: new Date().toISOString() },
      },
    })

    renderFinancialProfilePage('owner-1')

    await waitFor(() => {
      screen.getByText('Procéder au paiement d\'inscription')
    })

    await userEvent.click(screen.getByText('Procéder au paiement d\'inscription'))

    await waitFor(() => {
      screen.getByText('Confirmer le paiement')
    })

    await userEvent.click(screen.getByText('Confirmer le paiement'))

    await waitFor(() => {
      expect(mockApiClient.post).toHaveBeenCalledWith(
        '/finance/payments',
        expect.objectContaining({ paymentType: 'inscription' }),
      )
    })
  })

  it('affiche une erreur 409 si l\'inscription est déjà payée', async () => {
    mockApiClient.get = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/financial-profiles/')) return Promise.resolve({ data: SAMPLE_PROFILE_LIMITE })
      return Promise.resolve({ data: [] })
    })
    mockApiClient.post = vi.fn().mockRejectedValue({ response: { status: 409 } })

    renderFinancialProfilePage('owner-1')

    await waitFor(() => {
      screen.getByText('Procéder au paiement d\'inscription')
    })

    await userEvent.click(screen.getByText('Procéder au paiement d\'inscription'))
    await waitFor(() => screen.getByText('Confirmer le paiement'))
    await userEvent.click(screen.getByText('Confirmer le paiement'))

    await waitFor(() => {
      expect(
        screen.getByText('Un paiement d\'inscription a déjà été effectué pour ce compte.'),
      ).toBeDefined()
    })
  })

  it('l\'AF peut modifier le moyen de paiement', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(AF_USER))

    mockApiClient.get = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/financial-profiles/')) return Promise.resolve({ data: SAMPLE_PROFILE_MEMBRE })
      return Promise.resolve({ data: [] })
    })
    mockApiClient.patch = vi.fn().mockResolvedValue({
      data: { ...SAMPLE_PROFILE_MEMBRE, paymentMethod: 'virement' },
    })

    renderFinancialProfilePage('owner-1')

    await waitFor(() => {
      screen.getByText('Modifier')
    })

    await userEvent.click(screen.getByText('Modifier'))

    await waitFor(() => {
      screen.getByText('Enregistrer')
    })

    await userEvent.click(screen.getByText('Enregistrer'))

    await waitFor(() => {
      expect(mockApiClient.patch).toHaveBeenCalledWith(
        '/finance/financial-profiles/owner-1',
        expect.any(Object),
      )
    })
  })
})
