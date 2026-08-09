/**
 * Tests unitaires — src/utils/consents.ts
 *
 * Couverture :
 * - libellés métier des trois statuts (`granted`, `withdrawn`, `never_granted`)
 * - « accepté le X, retiré le Y » construit sans appel supplémentaire
 * - tri obligatoires d'abord, basé sur `isMandatory` du serveur
 * - activation du compte indépendante des consentements optionnels
 * - traduction des codes d'erreur du retrait (400 / 403 / 404 / 409)
 * - traduction des codes d'erreur de l'octroi (409 notamment)
 */

import { describe, it, expect } from 'vitest'
import type { ConsentState, ConsentType } from '../../src/types/accounts'
import {
  buildGrantSuccessMessage,
  buildWithdrawalSuccessMessage,
  formatConsentTimeline,
  getConsentDescription,
  getConsentGrantErrorMessage,
  getConsentLabel,
  getConsentStatusLabel,
  getConsentWithdrawalErrorMessage,
  hasGrantedAllMandatoryConsents,
  MANDATORY_CONSENT_WITHDRAWAL_MESSAGE,
  sortConsentsForDisplay,
} from '../../src/utils/consents'

function buildConsent(overrides: Partial<ConsentState> & { consentType: ConsentType }): ConsentState {
  return {
    status: 'never_granted',
    isGranted: false,
    isMandatory: false,
    isWithdrawable: false,
    version: null,
    grantedAt: null,
    withdrawnAt: null,
    updatedAt: null,
    ...overrides,
  }
}

function buildHttpError(status: number, message?: string) {
  return { response: { status, data: message ? { message } : undefined } }
}

describe('getConsentLabel / getConsentDescription', () => {
  it('traduit les trois types connus en libellés lisibles', () => {
    expect(getConsentLabel('rgpd')).toContain('RGPD')
    expect(getConsentLabel('cgu')).toContain('CGU')
    expect(getConsentLabel('marketing')).toBe('Communications commerciales')
    expect(getConsentDescription('marketing')).toContain('communications commerciales')
  })

  it('affiche un type inconnu tel quel plutôt que de masquer la ligne', () => {
    expect(getConsentLabel('newsletter')).toBe('newsletter')
    expect(getConsentDescription('newsletter')).toBe('')
  })
})

describe('getConsentStatusLabel', () => {
  it('donne trois libellés distincts, et jamais « Signé » pour un retrait', () => {
    expect(getConsentStatusLabel('granted')).toBe('Accordé')
    expect(getConsentStatusLabel('withdrawn')).toBe('Retiré')
    expect(getConsentStatusLabel('never_granted')).toBe('Non donné')
  })
})

describe('formatConsentTimeline', () => {
  it('affiche la date d’acceptation d’un consentement accordé', () => {
    const timeline = formatConsentTimeline(
      buildConsent({
        consentType: 'marketing',
        status: 'granted',
        isGranted: true,
        grantedAt: '2026-08-09T11:26:44.957Z',
      }),
    )

    expect(timeline).toBe('Accepté le 09/08/2026')
  })

  it('affiche « accepté le X, retiré le Y » après un retrait', () => {
    const timeline = formatConsentTimeline(
      buildConsent({
        consentType: 'marketing',
        status: 'withdrawn',
        grantedAt: '2026-08-09T11:26:44.957Z',
        withdrawnAt: '2026-08-10T11:26:45.660Z',
      }),
    )

    expect(timeline).toBe('Accepté le 09/08/2026, retiré le 10/08/2026')
  })

  it('n’affiche rien pour un consentement jamais donné', () => {
    expect(formatConsentTimeline(buildConsent({ consentType: 'marketing' }))).toBeNull()
  })

  it('reste lisible si une date est absente ou invalide', () => {
    expect(
      formatConsentTimeline(
        buildConsent({ consentType: 'marketing', status: 'withdrawn', withdrawnAt: 'pas-une-date' }),
      ),
    ).toBe('Retiré')
  })
})

describe('sortConsentsForDisplay', () => {
  it('place les consentements obligatoires en tête, sans les redéduire du type', () => {
    const sorted = sortConsentsForDisplay([
      buildConsent({ consentType: 'marketing' }),
      buildConsent({ consentType: 'rgpd', isMandatory: true }),
      buildConsent({ consentType: 'cgu', isMandatory: true }),
    ])

    expect(sorted.map((consent) => consent.consentType)).toEqual(['rgpd', 'cgu', 'marketing'])
  })

  it('ne modifie pas le tableau reçu', () => {
    const consents = [
      buildConsent({ consentType: 'marketing' }),
      buildConsent({ consentType: 'rgpd', isMandatory: true }),
    ]
    sortConsentsForDisplay(consents)

    expect(consents[0].consentType).toBe('marketing')
  })
})

describe('hasGrantedAllMandatoryConsents', () => {
  const grantedMandatory = (consentType: ConsentType) =>
    buildConsent({ consentType, status: 'granted', isGranted: true, isMandatory: true })

  it('est vrai quand tous les consentements obligatoires sont accordés', () => {
    expect(
      hasGrantedAllMandatoryConsents([grantedMandatory('rgpd'), grantedMandatory('cgu')]),
    ).toBe(true)
  })

  it('reste vrai après le retrait d’un consentement optionnel', () => {
    expect(
      hasGrantedAllMandatoryConsents([
        grantedMandatory('rgpd'),
        grantedMandatory('cgu'),
        buildConsent({ consentType: 'marketing', status: 'withdrawn' }),
      ]),
    ).toBe(true)
  })

  it('est faux tant qu’un consentement obligatoire manque', () => {
    expect(
      hasGrantedAllMandatoryConsents([
        grantedMandatory('rgpd'),
        buildConsent({ consentType: 'cgu', isMandatory: true }),
      ]),
    ).toBe(false)
  })

  it('est faux sur une liste vide', () => {
    expect(hasGrantedAllMandatoryConsents([])).toBe(false)
  })
})

describe('getConsentWithdrawalErrorMessage', () => {
  it('oriente vers la fermeture de compte sur un consentement obligatoire (403)', () => {
    const message = getConsentWithdrawalErrorMessage(buildHttpError(403, 'Mandatory consent'))

    expect(message).toBe(MANDATORY_CONSENT_WITHDRAWAL_MESSAGE)
    expect(message).toContain('fermer le compte')
    expect(message).toContain('support VisioMath')
  })

  it('explique le 404 : rien à retirer', () => {
    expect(getConsentWithdrawalErrorMessage(buildHttpError(404))).toContain('jamais donné')
  })

  it('explique le 409 : déjà retiré', () => {
    expect(getConsentWithdrawalErrorMessage(buildHttpError(409))).toContain('déjà retiré')
  })

  it('explique le 400 : type inconnu', () => {
    expect(getConsentWithdrawalErrorMessage(buildHttpError(400))).toContain('pas reconnu')
  })

  it('retombe sur un message générique pour les autres échecs', () => {
    expect(getConsentWithdrawalErrorMessage(buildHttpError(500))).toBeTruthy()
  })
})

describe('getConsentGrantErrorMessage', () => {
  it('explique le 409 : déjà accordé', () => {
    expect(getConsentGrantErrorMessage(buildHttpError(409))).toContain('déjà accordé')
  })

  it('retombe sur un message générique pour les autres échecs', () => {
    expect(getConsentGrantErrorMessage(buildHttpError(503))).toBeTruthy()
  })
})

describe('messages de confirmation', () => {
  it('dit explicitement que le compte reste actif après un retrait', () => {
    const message = buildWithdrawalSuccessMessage('marketing')

    expect(message).toContain('Communications commerciales')
    expect(message).toContain('compte reste actif')
  })

  it('confirme sobrement un octroi', () => {
    expect(buildGrantSuccessMessage('marketing')).toContain('enregistré')
  })
})
