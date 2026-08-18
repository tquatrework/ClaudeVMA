/**
 * Tests pour `ProfileConsentsSection` (onglet Profil > « Confidentialité »).
 *
 * Contexte métier (2026-08-18) : le menu « Profil / Confidentialité » n'affichait
 * jusqu'ici que les réglages de visibilité champ par champ (ex-écran `/visibilite`) ;
 * aucun écran de la fiche profil ne montrait les signatures légales de l'inscription
 * (RGPD, CGU, marketing), alors que l'écran `/consents` existe déjà et fonctionne.
 *
 * Ce composant est une SECONDE présentation du même état, obtenue via le MÊME hook
 * `useConsents` que `ConsentsPage` (`src/hooks/accounts/useConsents.ts`) — donc les
 * mêmes appels `GET/POST /consents` et `POST /consents/:consentType/withdraw`,
 * jamais une logique d'appel dupliquée.
 *
 * Ce que ces tests protègent :
 * - les trois types de consentement sont affichés avec leur état courant, jamais un
 *   « droit à l'image » ou tout autre type inventé côté front ;
 * - le retrait n'est proposé que pour `marketing` (`isWithdrawable`), jamais pour
 *   `rgpd`/`cgu` — la tentative de retrait sur un consentement obligatoire reste
 *   refusée explicitement par le serveur, jamais absorbée en silence côté front ;
 * - un retrait passe par une confirmation.
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ProfileConsentsSection } from '../../../src/components/profile/ProfileConsentsSection'
import type { ConsentState, ConsentType } from '../../../src/types/accounts'

vi.mock('../../../src/api/accounts')

import { fetchConsents, grantConsent, withdrawConsent } from '../../../src/api/accounts'

const mockFetchConsents = vi.mocked(fetchConsents)
const mockGrantConsent = vi.mocked(grantConsent)
const mockWithdrawConsent = vi.mocked(withdrawConsent)

const GRANTED_AT = '2026-01-05T10:00:00.000Z'
const WITHDRAWN_AT = '2026-02-10T09:30:00.000Z'

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

function buildAllConsents(marketingStatus: ConsentState['status']): ConsentState[] {
  return [
    buildMandatoryGranted('rgpd'),
    buildMandatoryGranted('cgu'),
    buildMarketing(marketingStatus),
  ]
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ProfileConsentsSection', () => {
  it('affiche un état de chargement pendant la récupération des consentements', () => {
    mockFetchConsents.mockReturnValue(new Promise(() => {}))
    render(<ProfileConsentsSection />)

    expect(screen.getByText(/chargement/i)).toBeDefined()
  })

  it('affiche les trois types de consentement, exactement ceux du backend', async () => {
    mockFetchConsents.mockResolvedValue(buildAllConsents('granted'))
    render(<ProfileConsentsSection />)

    await waitFor(() => {
      expect(screen.getByText('Protection des données personnelles (RGPD)')).toBeDefined()
    })
    expect(screen.getByText("Conditions générales d'utilisation (CGU)")).toBeDefined()
    expect(screen.getByText('Communications commerciales')).toBeDefined()

    // Aucun « droit à l'image » ni tout autre type inventé côté front : le backend
    // ne porte que rgpd/cgu/marketing (docs/architecture.md, note du 2026-08-18).
    expect(screen.queryByText(/droit à l'image/i)).toBeNull()
  })

  it('affiche « Retiré » pour un consentement retiré, jamais « Signé »', async () => {
    mockFetchConsents.mockResolvedValue(buildAllConsents('withdrawn'))
    render(<ProfileConsentsSection />)

    await waitFor(() => {
      expect(screen.getByText('Retiré')).toBeDefined()
    })
    expect(screen.queryByText(/^signé$/i)).toBeNull()
  })

  it('ne propose le retrait que pour le consentement marketing', async () => {
    mockFetchConsents.mockResolvedValue(buildAllConsents('granted'))
    render(<ProfileConsentsSection />)

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /^retirer$/i })).toHaveLength(1)
    })
    // rgpd/cgu accordés et non retirables : explication affichée, pas de bouton.
    expect(screen.getAllByText(/non retirable/i).length).toBe(2)
  })

  it('demande confirmation avant tout appel de retrait', async () => {
    mockFetchConsents.mockResolvedValue(buildAllConsents('granted'))
    render(<ProfileConsentsSection />)

    await waitFor(() => screen.getByRole('button', { name: /^retirer$/i }))
    await userEvent.click(screen.getByRole('button', { name: /^retirer$/i }))

    expect(screen.getByRole('dialog')).toBeDefined()
    expect(mockWithdrawConsent).not.toHaveBeenCalled()
  })

  it('retire le consentement marketing après confirmation et recharge depuis le serveur', async () => {
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
    render(<ProfileConsentsSection />)

    await waitFor(() => screen.getByRole('button', { name: /^retirer$/i }))
    await userEvent.click(screen.getByRole('button', { name: /^retirer$/i }))
    await userEvent.click(screen.getByRole('button', { name: /retirer le consentement/i }))

    await waitFor(() => {
      expect(mockWithdrawConsent).toHaveBeenCalledWith('marketing')
    })
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull()
    })
    expect(screen.getByText('Retiré')).toBeDefined()
  })

  it('refuse explicitement le retrait sur un consentement obligatoire (403), sans le confondre avec un succès', async () => {
    // Le bouton de retrait n'apparaît jamais pour rgpd/cgu (isWithdrawable: false),
    // mais si le serveur refusait malgré tout (403) sur le seul bouton affiché
    // (marketing dans cet essai), le refus reste visible — jamais absorbé en silence.
    mockFetchConsents.mockResolvedValue(buildAllConsents('granted'))
    mockWithdrawConsent.mockRejectedValue({ response: { status: 403 } })
    render(<ProfileConsentsSection />)

    await waitFor(() => screen.getByRole('button', { name: /^retirer$/i }))
    await userEvent.click(screen.getByRole('button', { name: /^retirer$/i }))
    await userEvent.click(screen.getByRole('button', { name: /retirer le consentement/i }))

    const dialog = await screen.findByRole('dialog')
    await waitFor(() => {
      expect(dialog.textContent).toMatch(/conditionne le fonctionnement de votre compte/i)
    })
    expect(screen.queryByText(/retiré\./i)).toBeNull()
  })

  it('accorde un consentement jamais donné', async () => {
    mockFetchConsents
      .mockResolvedValueOnce(buildAllConsents('never_granted'))
      .mockResolvedValue(buildAllConsents('granted'))
    mockGrantConsent.mockResolvedValue(undefined)
    render(<ProfileConsentsSection />)

    await waitFor(() => screen.getByRole('button', { name: /donner mon accord/i }))
    await userEvent.click(screen.getByRole('button', { name: /donner mon accord/i }))

    await waitFor(() => {
      expect(mockGrantConsent).toHaveBeenCalledWith('marketing')
    })
  })
})
