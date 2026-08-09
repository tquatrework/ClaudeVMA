/**
 * Tests de `buildRegistrationConsents` / `hasGivenRequiredConsents`.
 *
 * Enjeu métier : un consentement coché à l'inscription doit être transmis dans la
 * forme attendue par le serveur (`[{consentType}]`, docs/routes.md) — et **seulement**
 * ce qui a été coché. L'ancienne forme booléenne `{rgpd, cgu}` était jetée en silence
 * et renvoie désormais `400`.
 */

import { describe, it, expect } from 'vitest'
import {
  buildRegistrationConsents,
  hasGivenRequiredConsents,
} from '../../src/utils/registrationConsents'

describe('buildRegistrationConsents', () => {
  it('transmet les deux consentements obligatoires dans la forme du serveur', () => {
    expect(
      buildRegistrationConsents({ hasAcceptedRgpd: true, hasAcceptedCgu: true }),
    ).toEqual([{ consentType: 'rgpd' }, { consentType: 'cgu' }])
  })

  it('ne transmet que le consentement réellement coché (RGPD seul)', () => {
    expect(
      buildRegistrationConsents({ hasAcceptedRgpd: true, hasAcceptedCgu: false }),
    ).toEqual([{ consentType: 'rgpd' }])
  })

  it('ne transmet que le consentement réellement coché (CGU seule)', () => {
    expect(
      buildRegistrationConsents({ hasAcceptedRgpd: false, hasAcceptedCgu: true }),
    ).toEqual([{ consentType: 'cgu' }])
  })

  it('omet le champ plutôt que d\'envoyer un tableau vide quand rien n\'est coché', () => {
    expect(
      buildRegistrationConsents({ hasAcceptedRgpd: false, hasAcceptedCgu: false }),
    ).toBeUndefined()
  })

  it("n'émet jamais l'ancienne forme booléenne refusée par le serveur", () => {
    const consents = buildRegistrationConsents({ hasAcceptedRgpd: true, hasAcceptedCgu: true })

    expect(Array.isArray(consents)).toBe(true)
    expect(consents).not.toHaveProperty('rgpd')
    expect(consents).not.toHaveProperty('cgu')
  })

  it('respecte l\'ordre RGPD puis CGU, et ne duplique aucun type', () => {
    const consents = buildRegistrationConsents({ hasAcceptedRgpd: true, hasAcceptedCgu: true }) ?? []
    const consentTypes = consents.map((consent) => consent.consentType)

    expect(consentTypes).toEqual(['rgpd', 'cgu'])
    expect(new Set(consentTypes).size).toBe(consentTypes.length)
  })
})

describe('hasGivenRequiredConsents', () => {
  it('est vrai quand RGPD et CGU sont acceptés', () => {
    expect(hasGivenRequiredConsents({ hasAcceptedRgpd: true, hasAcceptedCgu: true })).toBe(true)
  })

  it.each([
    ['RGPD manquant', { hasAcceptedRgpd: false, hasAcceptedCgu: true }],
    ['CGU manquantes', { hasAcceptedRgpd: true, hasAcceptedCgu: false }],
    ['aucun des deux', { hasAcceptedRgpd: false, hasAcceptedCgu: false }],
  ])('est faux quand il en manque un (%s)', (_label, consentsFormData) => {
    expect(hasGivenRequiredConsents(consentsFormData)).toBe(false)
  })
})
