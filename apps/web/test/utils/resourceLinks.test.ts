import { describe, it, expect } from 'vitest'
import {
  MAX_RESOURCE_LINKS,
  getResourceLinkValidationError,
  isAbsoluteHttpUrl,
  isEmptyResourceLink,
  toSubmittableResourceLinks,
  validateResourceLinks,
} from '../../src/utils/resourceLinks'

describe('isAbsoluteHttpUrl', () => {
  it('accepte http:// et https://', () => {
    expect(isAbsoluteHttpUrl('http://example.com')).toBe(true)
    expect(isAbsoluteHttpUrl('https://example.com/fiche.pdf')).toBe(true)
  })

  it('refuse une URL relative ou un protocole non http', () => {
    expect(isAbsoluteHttpUrl('/fiche.pdf')).toBe(false)
    expect(isAbsoluteHttpUrl('javascript:alert(1)')).toBe(false)
    expect(isAbsoluteHttpUrl('ftp://example.com')).toBe(false)
    expect(isAbsoluteHttpUrl('')).toBe(false)
  })
})

describe('isEmptyResourceLink', () => {
  it('un lien avec les deux champs vides est vide', () => {
    expect(isEmptyResourceLink({ label: '', url: '' })).toBe(true)
    expect(isEmptyResourceLink({ label: '  ', url: '  ' })).toBe(true)
  })

  it('un lien avec au moins un champ rempli n\'est pas vide', () => {
    expect(isEmptyResourceLink({ label: 'Fiche', url: '' })).toBe(false)
    expect(isEmptyResourceLink({ label: '', url: 'https://example.com' })).toBe(false)
  })
})

describe('getResourceLinkValidationError', () => {
  it('un lien vide ne produit pas d\'erreur (sera simplement omis)', () => {
    expect(getResourceLinkValidationError({ label: '', url: '' })).toBeNull()
  })

  it('un lien valide ne produit pas d\'erreur', () => {
    expect(
      getResourceLinkValidationError({ label: 'Fiche de cours', url: 'https://example.com/fiche.pdf' }),
    ).toBeNull()
  })

  it('label manquant → erreur', () => {
    expect(getResourceLinkValidationError({ label: '', url: 'https://example.com' })).toMatch(
      /texte affiché/i,
    )
  })

  it('label trop long → erreur', () => {
    const longLabel = 'a'.repeat(201)
    expect(getResourceLinkValidationError({ label: longLabel, url: 'https://example.com' })).toMatch(
      /200 caractères/,
    )
  })

  it('url manquante → erreur', () => {
    expect(getResourceLinkValidationError({ label: 'Fiche', url: '' })).toMatch(/adresse/i)
  })

  it('url non http(s) → erreur', () => {
    expect(
      getResourceLinkValidationError({ label: 'Fiche', url: 'javascript:alert(1)' }),
    ).toMatch(/http:\/\/ ou https:\/\//)
  })
})

describe('validateResourceLinks', () => {
  it('un tableau vide est valide', () => {
    expect(validateResourceLinks([])).toBeNull()
  })

  it('des liens vides intercalés sont ignorés', () => {
    expect(
      validateResourceLinks([
        { label: '', url: '' },
        { label: 'Fiche', url: 'https://example.com' },
      ]),
    ).toBeNull()
  })

  it('renvoie le premier message d\'erreur rencontré', () => {
    expect(validateResourceLinks([{ label: '', url: 'https://example.com' }])).toMatch(
      /texte affiché/i,
    )
  })

  it(`refuse plus de ${MAX_RESOURCE_LINKS} liens`, () => {
    const tooManyLinks = Array.from({ length: MAX_RESOURCE_LINKS + 1 }, (_, index) => ({
      label: `Lien ${index}`,
      url: 'https://example.com',
    }))
    expect(validateResourceLinks(tooManyLinks)).toMatch(new RegExp(`${MAX_RESOURCE_LINKS}`))
  })
})

describe('toSubmittableResourceLinks', () => {
  it('retire les lignes vides et nettoie les espaces', () => {
    const result = toSubmittableResourceLinks([
      { label: '  Fiche  ', url: '  https://example.com  ' },
      { label: '', url: '' },
    ])
    expect(result).toEqual([{ label: 'Fiche', url: 'https://example.com' }])
  })
})
