/**
 * Tests de comportement de `ConsentsPage` (route `/consents`).
 *
 * Le contrat couvert est celui de `docs/routes.md` > « Consentements RGPD » :
 * `GET /consents` renvoie **toujours les trois types** avec leur état courant
 * (`granted` | `withdrawn` | `never_granted`), `POST /consents` donne ou redonne un
 * consentement, `POST /consents/:consentType/withdraw` retire un consentement optionnel.
 *
 * Ce que ces tests protègent, au-delà du câblage des appels :
 * - un consentement **retiré ne s'affiche jamais « Signé »** — c'était le mensonge que
 *   l'arbitrage du 2026-08-09 vise explicitement ;
 * - le retrait n'est proposé que si le serveur le dit (`isWithdrawable`), jamais déduit ;
 * - un retrait passe par une confirmation, et son refus (`403`) reste visible ;
 * - retirer le consentement marketing ne laisse **pas croire** que le compte est désactivé.
 */

import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ConsentsPage from '../../src/pages/ConsentsPage'
import type { ConsentState, ConsentType } from '../../src/types/accounts'

vi.mock('../../src/api/accounts')
vi.mock('../../src/hooks/useAuth')

import { fetchConsents, grantConsent, withdrawConsent } from '../../src/api/accounts'
import { useAuth } from '../../src/hooks/useAuth'

const mockFetchConsents = vi.mocked(fetchConsents)
const mockGrantConsent = vi.mocked(grantConsent)
const mockWithdrawConsent = vi.mocked(withdrawConsent)
const mockUseAuth = vi.mocked(useAuth)

// ─── Fixtures d'état courant, au format exact de `GET /consents` ────────────────

const GRANTED_AT = '2026-01-05T10:00:00.000Z'
const WITHDRAWN_AT = '2026-02-10T09:30:00.000Z'

/** Consentement obligatoire accordé : `rgpd`/`cgu` ne sont jamais retirables ici. */
function buildMandatoryGranted(consentType: ConsentType): ConsentState {
  return {
    consentType,
    status: 'granted',
    isGranted: true,
    isMandatory: true,
    isWithdrawable: false,
    version: '1.0',
    grantedAt: GRANTED_AT,
    withdrawnAt: null,
    updatedAt: GRANTED_AT,
  }
}

/** Consentement obligatoire jamais donné — compte encore `pending`. */
function buildMandatoryNeverGranted(consentType: ConsentType): ConsentState {
  return {
    consentType,
    status: 'never_granted',
    isGranted: false,
    isMandatory: true,
    isWithdrawable: false,
    version: null,
    grantedAt: null,
    withdrawnAt: null,
    updatedAt: null,
  }
}

/**
 * Consentement marketing dans l'un de ses trois états.
 * `isWithdrawable` reste `true` : c'est une propriété du type (optionnel), pas de l'état.
 */
function buildMarketing(status: ConsentState['status']): ConsentState {
  return {
    consentType: 'marketing',
    status,
    isGranted: status === 'granted',
    isMandatory: false,
    isWithdrawable: true,
    version: status === 'never_granted' ? null : '1.0',
    grantedAt: status === 'never_granted' ? null : GRANTED_AT,
    withdrawnAt: status === 'withdrawn' ? WITHDRAWN_AT : null,
    updatedAt: status === 'withdrawn' ? WITHDRAWN_AT : GRANTED_AT,
  }
}

/** Les trois types, comme le serveur les renvoie toujours. */
function buildAllConsents(marketingStatus: ConsentState['status']): ConsentState[] {
  return [
    buildMandatoryGranted('rgpd'),
    buildMandatoryGranted('cgu'),
    buildMarketing(marketingStatus),
  ]
}

function renderConsentsPage() {
  return render(
    <MemoryRouter initialEntries={['/consents']}>
      <Routes>
        <Route path="/consents" element={<ConsentsPage />} />
        <Route path="/dashboard" element={<div>Dashboard Page</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

const mockRefreshUser = vi.fn().mockResolvedValue(undefined)

function mockAuthenticatedUser(validationStatus: 'pending' | 'active') {
  mockUseAuth.mockReturnValue({
    user: {
      id: 'student-1',
      loginIdentifier: 'marie.dupont',
      email: 'eleve@test.com',
      role: 'eleve',
      validationStatus,
    },
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    refreshUser: mockRefreshUser,
    hasRole: vi.fn().mockReturnValue(false),
    isInternalRole: vi.fn().mockReturnValue(false),
  } as unknown as ReturnType<typeof useAuth>)
}

beforeEach(() => {
  vi.clearAllMocks()
  mockAuthenticatedUser('active')
})

describe('ConsentsPage — chargement', () => {
  it('affiche un état de chargement pendant la récupération des consentements', () => {
    mockFetchConsents.mockReturnValue(new Promise(() => {})) // ne se résout jamais
    renderConsentsPage()

    expect(screen.getByText(/chargement/i)).toBeDefined()
  })

  it("affiche un message d'erreur quand le chargement initial échoue", async () => {
    mockFetchConsents.mockRejectedValue({
      response: { data: { message: 'Service indisponible' } },
    })
    renderConsentsPage()

    await waitFor(() => {
      expect(screen.getByText('Service indisponible')).toBeDefined()
    })
  })

  it('affiche un état vide explicite si le serveur ne renvoie aucun consentement', async () => {
    mockFetchConsents.mockResolvedValue([])
    renderConsentsPage()

    await waitFor(() => {
      expect(screen.getByText(/aucun consentement n'est enregistré/i)).toBeDefined()
    })
    expect(screen.queryByRole('button', { name: /accéder à mon espace/i })).toBeNull()
  })
})

describe('ConsentsPage — affichage des trois statuts', () => {
  it('distingue accordé, retiré et non donné, sans jamais afficher « Signé » pour un retrait', async () => {
    mockFetchConsents.mockResolvedValue([
      buildMandatoryGranted('rgpd'),
      buildMarketing('withdrawn'),
      buildMandatoryNeverGranted('cgu'),
    ])
    renderConsentsPage()

    await waitFor(() => {
      expect(screen.getByText('Accordé')).toBeDefined()
    })
    expect(screen.getByText('Retiré')).toBeDefined()
    expect(screen.getByText('Non donné')).toBeDefined()
    expect(screen.queryByText(/^signé$/i)).toBeNull()
  })

  it("résume l'historique d'un consentement retiré (accepté le X, retiré le Y)", async () => {
    mockFetchConsents.mockResolvedValue(buildAllConsents('withdrawn'))
    renderConsentsPage()

    await waitFor(() => {
      expect(screen.getByText(/accepté le .+, retiré le .+/i)).toBeDefined()
    })
  })

  it('propose de redonner un consentement précédemment retiré', async () => {
    mockFetchConsents.mockResolvedValue(buildAllConsents('withdrawn'))
    renderConsentsPage()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /redonner mon accord/i })).toBeDefined()
    })
    // Un consentement retiré ne se retire pas une seconde fois.
    expect(screen.queryByRole('button', { name: /^retirer$/i })).toBeNull()
  })
})

describe('ConsentsPage — le retrait suit `isWithdrawable`', () => {
  it('propose le retrait du seul consentement que le serveur déclare retirable', async () => {
    mockFetchConsents.mockResolvedValue(buildAllConsents('granted'))
    renderConsentsPage()

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /^retirer$/i })).toHaveLength(1)
    })
  })

  it("n'offre aucun retrait sur un consentement accordé non retirable, et explique pourquoi", async () => {
    mockFetchConsents.mockResolvedValue([
      buildMandatoryGranted('rgpd'),
      buildMandatoryGranted('cgu'),
      buildMarketing('never_granted'),
    ])
    renderConsentsPage()

    await waitFor(() => {
      expect(screen.getAllByText(/non retirable/i).length).toBeGreaterThan(0)
    })
    expect(screen.queryByRole('button', { name: /^retirer$/i })).toBeNull()

    // L'explication oriente vers le support, sans lien vers un parcours inexistant.
    const explanation = screen.getByText(/conditionne le fonctionnement de votre compte/i)
    expect(explanation.textContent).toMatch(/support/i)
    expect(screen.queryByRole('link', { name: /fermer/i })).toBeNull()
  })
})

describe('ConsentsPage — retrait d\'un consentement', () => {
  it('demande confirmation avant tout appel de retrait', async () => {
    mockFetchConsents.mockResolvedValue(buildAllConsents('granted'))
    renderConsentsPage()

    await waitFor(() => screen.getByRole('button', { name: /^retirer$/i }))
    await userEvent.click(screen.getByRole('button', { name: /^retirer$/i }))

    expect(screen.getByRole('dialog')).toBeDefined()
    expect(mockWithdrawConsent).not.toHaveBeenCalled()
  })

  it("n'appelle rien si l'utilisateur annule la confirmation", async () => {
    mockFetchConsents.mockResolvedValue(buildAllConsents('granted'))
    renderConsentsPage()

    await waitFor(() => screen.getByRole('button', { name: /^retirer$/i }))
    await userEvent.click(screen.getByRole('button', { name: /^retirer$/i }))
    await userEvent.click(screen.getByRole('button', { name: /annuler/i }))

    expect(mockWithdrawConsent).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('retire le consentement après confirmation, recharge et confirme sans alarmer', async () => {
    mockFetchConsents
      .mockResolvedValueOnce(buildAllConsents('granted'))
      .mockResolvedValue(buildAllConsents('withdrawn'))
    mockWithdrawConsent.mockResolvedValue({
      id: 'event-1',
      consentType: 'marketing',
      action: 'withdrawn',
      version: '1.0',
      recordedAt: WITHDRAWN_AT,
    })
    renderConsentsPage()

    await waitFor(() => screen.getByRole('button', { name: /^retirer$/i }))
    await userEvent.click(screen.getByRole('button', { name: /^retirer$/i }))
    await userEvent.click(screen.getByRole('button', { name: /retirer le consentement/i }))

    await waitFor(() => {
      expect(mockWithdrawConsent).toHaveBeenCalledWith('marketing')
    })
    // La liste est rechargée depuis le serveur, jamais devinée localement.
    await waitFor(() => {
      expect(mockFetchConsents).toHaveBeenCalledTimes(2)
    })
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull()
    })
    expect(screen.getByText('Retiré')).toBeDefined()
  })

  it('affiche le refus du serveur sur un consentement obligatoire (403) sans le traiter en succès', async () => {
    mockFetchConsents.mockResolvedValue(buildAllConsents('granted'))
    mockWithdrawConsent.mockRejectedValue({ response: { status: 403 } })
    renderConsentsPage()

    await waitFor(() => screen.getByRole('button', { name: /^retirer$/i }))
    await userEvent.click(screen.getByRole('button', { name: /^retirer$/i }))
    await userEvent.click(screen.getByRole('button', { name: /retirer le consentement/i }))

    // La boîte reste ouverte et porte le refus : pas de confirmation trompeuse.
    const dialog = await screen.findByRole('dialog')
    await waitFor(() => {
      expect(within(dialog).getByText(/conditionne le fonctionnement de votre compte/i)).toBeDefined()
    })
    const refusal = within(dialog).getByText(/conditionne le fonctionnement de votre compte/i)
    expect(refusal.textContent).toMatch(/support/i)
    // Le parcours de fermeture de compte n'existe pas encore : aucun lien ne doit y mener.
    expect(within(dialog).queryByRole('link')).toBeNull()
    expect(screen.queryByText(/retiré\./i)).toBeNull()
  })

  it('traduit un retrait déjà enregistré (409) en invitation à recharger', async () => {
    mockFetchConsents.mockResolvedValue(buildAllConsents('granted'))
    mockWithdrawConsent.mockRejectedValue({ response: { status: 409 } })
    renderConsentsPage()

    await waitFor(() => screen.getByRole('button', { name: /^retirer$/i }))
    await userEvent.click(screen.getByRole('button', { name: /^retirer$/i }))
    await userEvent.click(screen.getByRole('button', { name: /retirer le consentement/i }))

    const dialog = await screen.findByRole('dialog')
    await waitFor(() => {
      expect(within(dialog).getByText(/déjà retiré/i)).toBeDefined()
    })
  })

  it("retirer le marketing ne laisse pas croire que le compte est désactivé", async () => {
    mockFetchConsents
      .mockResolvedValueOnce(buildAllConsents('granted'))
      .mockResolvedValue(buildAllConsents('withdrawn'))
    mockWithdrawConsent.mockResolvedValue({
      id: 'event-1',
      consentType: 'marketing',
      action: 'withdrawn',
      version: '1.0',
      recordedAt: WITHDRAWN_AT,
    })
    renderConsentsPage()

    await waitFor(() => screen.getByRole('button', { name: /^retirer$/i }))
    await userEvent.click(screen.getByRole('button', { name: /^retirer$/i }))
    await userEvent.click(screen.getByRole('button', { name: /retirer le consentement/i }))

    await waitFor(() => {
      expect(screen.getByText(/votre compte reste actif/i)).toBeDefined()
    })
    // Les consentements obligatoires restent signés : le compte est toujours annoncé actif.
    expect(screen.getByText(/consentements obligatoires signés/i)).toBeDefined()
    expect(screen.getByRole('button', { name: /accéder à mon espace/i })).toBeDefined()
    expect(screen.queryByText(/désactivé/i)).toBeNull()
    expect(screen.queryByText(/suspendu/i)).toBeNull()
  })
})

describe('ConsentsPage — octroi et ré-acceptation', () => {
  it('accorde un consentement jamais donné', async () => {
    mockFetchConsents
      .mockResolvedValueOnce(buildAllConsents('never_granted'))
      .mockResolvedValue(buildAllConsents('granted'))
    mockGrantConsent.mockResolvedValue(undefined)
    renderConsentsPage()

    await waitFor(() => screen.getByRole('button', { name: /donner mon accord/i }))
    await userEvent.click(screen.getByRole('button', { name: /donner mon accord/i }))

    await waitFor(() => {
      expect(mockGrantConsent).toHaveBeenCalledWith('marketing')
    })
    await waitFor(() => {
      expect(screen.getByText(/consentement .+ enregistré/i)).toBeDefined()
    })
  })

  it('ré-accepte un consentement retiré via POST /consents, sans conflit', async () => {
    mockFetchConsents
      .mockResolvedValueOnce(buildAllConsents('withdrawn'))
      .mockResolvedValue(buildAllConsents('granted'))
    mockGrantConsent.mockResolvedValue(undefined)
    renderConsentsPage()

    await waitFor(() => screen.getByRole('button', { name: /redonner mon accord/i }))
    await userEvent.click(screen.getByRole('button', { name: /redonner mon accord/i }))

    await waitFor(() => {
      expect(mockGrantConsent).toHaveBeenCalledWith('marketing')
    })
    // L'état revient à « Accordé » après rechargement, et le retrait redevient proposable.
    await waitFor(() => {
      expect(screen.getAllByText('Accordé').length).toBe(3)
    })
    expect(screen.getByRole('button', { name: /^retirer$/i })).toBeDefined()
  })

  it("signe un consentement obligatoire manquant et affiche l'accès à l'espace une fois complet", async () => {
    mockAuthenticatedUser('pending')
    mockFetchConsents
      .mockResolvedValueOnce([
        buildMandatoryGranted('rgpd'),
        buildMandatoryNeverGranted('cgu'),
        buildMarketing('never_granted'),
      ])
      .mockResolvedValue(buildAllConsents('never_granted'))
    mockGrantConsent.mockResolvedValue(undefined)
    renderConsentsPage()

    await waitFor(() => screen.getAllByRole('button', { name: /donner mon accord/i }))
    const grantButtons = screen.getAllByRole('button', { name: /donner mon accord/i })
    await userEvent.click(grantButtons[0])

    await waitFor(() => {
      expect(mockGrantConsent).toHaveBeenCalledWith('cgu')
    })
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /accéder à mon espace/i })).toBeDefined()
    })
  })

  it("affiche l'échec d'un octroi sans le confondre avec un succès", async () => {
    mockFetchConsents.mockResolvedValue(buildAllConsents('never_granted'))
    mockGrantConsent.mockRejectedValue({ response: { status: 409 } })
    renderConsentsPage()

    await waitFor(() => screen.getByRole('button', { name: /donner mon accord/i }))
    await userEvent.click(screen.getByRole('button', { name: /donner mon accord/i }))

    await waitFor(() => {
      expect(screen.getByText(/déjà accordé/i)).toBeDefined()
    })
    expect(screen.queryByText(/enregistré\./i)).toBeNull()
  })
})

describe('ConsentsPage — accès à l\'espace', () => {
  it('navigue vers le tableau de bord après rafraîchissement de la session', async () => {
    mockFetchConsents.mockResolvedValue(buildAllConsents('never_granted'))
    renderConsentsPage()

    await waitFor(() => screen.getByRole('button', { name: /accéder à mon espace/i }))
    await userEvent.click(screen.getByRole('button', { name: /accéder à mon espace/i }))

    await waitFor(() => {
      expect(screen.getByText('Dashboard Page')).toBeDefined()
    })
    expect(mockRefreshUser).toHaveBeenCalled()
  })
})
