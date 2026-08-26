import { describe, it, expect } from 'vitest'
import {
  buildInlineLinkMarkup,
  insertTextAtSelection,
  isAbsoluteHttpUrl,
  parseLightMarkup,
} from '../../src/utils/lightMarkup'

describe('parseLightMarkup', () => {
  it('une chaîne vide renvoie un tableau vide', () => {
    expect(parseLightMarkup('')).toEqual([])
  })

  it('un texte sans motif renvoie un unique segment texte', () => {
    expect(parseLightMarkup('Aucun lien ici.')).toEqual([{ type: 'text', value: 'Aucun lien ici.' }])
  })

  it('reconnaît un lien seul', () => {
    expect(parseLightMarkup('[Fiche de cours](https://example.com/fiche.pdf)')).toEqual([
      { type: 'link', label: 'Fiche de cours', url: 'https://example.com/fiche.pdf' },
    ])
  })

  it('reconnaît un lien entouré de texte, dans l\'ordre', () => {
    expect(parseLightMarkup('Voir [Fiche](https://example.com/fiche.pdf) pour réviser.')).toEqual([
      { type: 'text', value: 'Voir ' },
      { type: 'link', label: 'Fiche', url: 'https://example.com/fiche.pdf' },
      { type: 'text', value: ' pour réviser.' },
    ])
  })

  it('reconnaît plusieurs liens', () => {
    expect(parseLightMarkup('[A](https://a.example) et [B](https://b.example)')).toEqual([
      { type: 'link', label: 'A', url: 'https://a.example' },
      { type: 'text', value: ' et ' },
      { type: 'link', label: 'B', url: 'https://b.example' },
    ])
  })

  it('ignore un motif dont l\'URL n\'est pas http(s)', () => {
    expect(parseLightMarkup('[Suspect](javascript:alert(1))')).toEqual([
      { type: 'text', value: '[Suspect](javascript:alert(1))' },
    ])
  })
})

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

describe('buildInlineLinkMarkup', () => {
  it('construit [label](url), en nettoyant les espaces', () => {
    expect(buildInlineLinkMarkup('  Fiche de cours  ', '  https://example.com  ')).toBe(
      '[Fiche de cours](https://example.com)',
    )
  })
})

describe('insertTextAtSelection', () => {
  it('insère en fin de texte quand la sélection est à la fin', () => {
    const result = insertTextAtSelection('Bonjour', 7, 7, ' le monde')
    expect(result).toEqual({ text: 'Bonjour le monde', cursorPosition: 16 })
  })

  it('insère au point du curseur, pas systématiquement en fin de texte', () => {
    const result = insertTextAtSelection('Suite', 0, 0, '[Fiche](https://example.com)')
    expect(result.text).toBe('[Fiche](https://example.com)Suite')
    expect(result.cursorPosition).toBe('[Fiche](https://example.com)'.length)
  })

  it('remplace une sélection non vide', () => {
    const result = insertTextAtSelection('Bonjour le monde', 8, 10, 'un')
    expect(result.text).toBe('Bonjour un monde')
  })
})
