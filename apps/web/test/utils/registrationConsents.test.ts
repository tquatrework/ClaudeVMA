/**
 * Tests de `buildRegistrationConsents` / `hasGivenRequiredConsents`.
 *
 * Enjeu métier : un consentement coché à l'inscription doit être transmis dans la
 * forme attendue par le serveur (`[{consentType}]`, docs/routes.md) — et **seulement**
 * ce qui a été coché. L'ancienne forme booléenne `{rgpd, cgu}` était jetée en silence
 * et renvoie désormais `400`.
 *
 * Le consentement `marketing` est optionnel : il ne conditionne jamais la création du
 * compte, et aucune entrée `marketing` ne doit partir tant que l'utilisateur ne l'a pas
 * cochée — enregistrer un consentement optionnel non donné serait plus grave que de ne
 * rien enregistrer.
 */

import { describe, it, expect } from 'vitest'
import {
  buildRegistrationConsents,
  hasGivenRequiredConsents,
} from '../../src/utils/registrationConsents'
import type { RegistrationConsentsFormData } from '../../src/types/accounts'

/** Aucun consentement coché — état initial du formulaire d'inscription. */
const NO_CONSENT_GIVEN: RegistrationConsentsFormData = {
  hasAcceptedRgpd: false,
  hasAcceptedCgu: false,
  hasAcceptedMarketing: false,
}

/** Les deux consentements obligatoires cochés, le marketing refusé. */
const REQUIRED_CONSENTS_ONLY: RegistrationConsentsFormData = {
  ...NO_CONSENT_GIVEN,
  hasAcceptedRgpd: true,
  hasAcceptedCgu: true,
}

describe('buildRegistrationConsents', () => {
  it('transmet les deux consentements obligatoires dans la forme du serveur', () => {
    expect(buildRegistrationConsents(REQUIRED_CONSENTS_ONLY)).toEqual([
      { consentType: 'rgpd' },
      { consentType: 'cgu' },
    ])
  })

  it('ne transmet que le consentement réellement coché (RGPD seul)', () => {
    expect(
      buildRegistrationConsents({ ...NO_CONSENT_GIVEN, hasAcceptedRgpd: true }),
    ).toEqual([{ consentType: 'rgpd' }])
  })

  it('ne transmet que le consentement réellement coché (CGU seule)', () => {
    expect(
      buildRegistrationConsents({ ...NO_CONSENT_GIVEN, hasAcceptedCgu: true }),
    ).toEqual([{ consentType: 'cgu' }])
  })

  it('omet le champ plutôt que d\'envoyer un tableau vide quand rien n\'est coché', () => {
    expect(buildRegistrationConsents(NO_CONSENT_GIVEN)).toBeUndefined()
  })

  it("n'émet jamais l'ancienne forme booléenne refusée par le serveur", () => {
    const consents = buildRegistrationConsents(REQUIRED_CONSENTS_ONLY)

    expect(Array.isArray(consents)).toBe(true)
    expect(consents).not.toHaveProperty('rgpd')
    expect(consents).not.toHaveProperty('cgu')
  })

  it('respecte l\'ordre RGPD puis CGU, et ne duplique aucun type', () => {
    const consents = buildRegistrationConsents(REQUIRED_CONSENTS_ONLY) ?? []
    const consentTypes = consents.map((consent) => consent.consentType)

    expect(consentTypes).toEqual(['rgpd', 'cgu'])
    expect(new Set(consentTypes).size).toBe(consentTypes.length)
  })

  describe('consentement marketing (optionnel)', () => {
    it('ajoute une entrée marketing quand la case est cochée', () => {
      expect(
        buildRegistrationConsents({ ...REQUIRED_CONSENTS_ONLY, hasAcceptedMarketing: true }),
      ).toEqual([{ consentType: 'rgpd' }, { consentType: 'cgu' }, { consentType: 'marketing' }])
    })

    it("n'envoie aucune entrée marketing quand la case reste décochée", () => {
      const consents = buildRegistrationConsents(REQUIRED_CONSENTS_ONLY) ?? []

      expect(consents).toEqual([{ consentType: 'rgpd' }, { consentType: 'cgu' }])
      expect(consents.some((consent) => consent.consentType === 'marketing')).toBe(false)
    })

    it('peut être le seul consentement transmis (les obligatoires sont indépendants)', () => {
      expect(
        buildRegistrationConsents({ ...NO_CONSENT_GIVEN, hasAcceptedMarketing: true }),
      ).toEqual([{ consentType: 'marketing' }])
    })

    it('ne duplique jamais le type marketing', () => {
      const consents =
        buildRegistrationConsents({ ...REQUIRED_CONSENTS_ONLY, hasAcceptedMarketing: true }) ?? []
      const marketingEntries = consents.filter((consent) => consent.consentType === 'marketing')

      expect(marketingEntries).toHaveLength(1)
    })
  })
})

describe('hasGivenRequiredConsents', () => {
  it('est vrai quand RGPD et CGU sont acceptés', () => {
    expect(hasGivenRequiredConsents(REQUIRED_CONSENTS_ONLY)).toBe(true)
  })

  it.each([
    ['RGPD manquant', { ...NO_CONSENT_GIVEN, hasAcceptedCgu: true }],
    ['CGU manquantes', { ...NO_CONSENT_GIVEN, hasAcceptedRgpd: true }],
    ['aucun des deux', NO_CONSENT_GIVEN],
  ])('est faux quand il en manque un (%s)', (_label, consentsFormData) => {
    expect(hasGivenRequiredConsents(consentsFormData)).toBe(false)
  })

  it('reste vrai sans le consentement marketing : il ne bloque pas l\'inscription', () => {
    expect(hasGivenRequiredConsents(REQUIRED_CONSENTS_ONLY)).toBe(true)
    expect(
      hasGivenRequiredConsents({ ...REQUIRED_CONSENTS_ONLY, hasAcceptedMarketing: true }),
    ).toBe(true)
  })

  it("reste faux quand seul le marketing est coché : il ne remplace aucun consentement obligatoire", () => {
    expect(
      hasGivenRequiredConsents({ ...NO_CONSENT_GIVEN, hasAcceptedMarketing: true }),
    ).toBe(false)
  })
})
