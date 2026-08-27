import { describe, it, expect } from 'vitest'
import {
  buildInlineLinkMarkup,
  buildMathMarkup,
  domPositionForRawOffset,
  insertTextAtSelection,
  isAbsoluteHttpUrl,
  LIGHT_MARKUP_CHIP_ATTR,
  LIGHT_MARKUP_LABEL_ATTR,
  LIGHT_MARKUP_URL_ATTR,
  parseLightMarkup,
  rawOffsetFromDomPosition,
  serializeLightMarkupEditor,
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

// ─── Segment math (2026-08-27, chantier Mémo) ──────────────────────────────

describe('parseLightMarkup — segment math', () => {
  it('reconnaît une formule inline $...$', () => {
    expect(parseLightMarkup('Voir $x^2$ ci-dessous.')).toEqual([
      { type: 'text', value: 'Voir ' },
      { type: 'math', latex: 'x^2', displayMode: false },
      { type: 'text', value: ' ci-dessous.' },
    ])
  })

  it('reconnaît un bloc mathématique $$...$$ (displayMode)', () => {
    expect(parseLightMarkup('$$a^2 + b^2 = c^2$$')).toEqual([
      { type: 'math', latex: 'a^2 + b^2 = c^2', displayMode: true },
    ])
  })

  it('distingue $$...$$ de deux formules inline adjacentes', () => {
    // $$...$$ doit être reconnu comme UN bloc, pas comme un $ vide suivi
    // d'un texte puis d'un autre $.
    expect(parseLightMarkup('$$x$$')).toEqual([{ type: 'math', latex: 'x', displayMode: true }])
  })

  it('mélange liens et maths, dans l\'ordre d\'apparition', () => {
    expect(parseLightMarkup('Voir [la fiche](https://example.com) et $x^2$.')).toEqual([
      { type: 'text', value: 'Voir ' },
      { type: 'link', label: 'la fiche', url: 'https://example.com' },
      { type: 'text', value: ' et ' },
      { type: 'math', latex: 'x^2', displayMode: false },
      { type: 'text', value: '.' },
    ])
  })

  it('une formule inline ne franchit jamais un saut de ligne', () => {
    expect(parseLightMarkup('$x\ny$')).toEqual([{ type: 'text', value: '$x\ny$' }])
  })

  it('un texte sans formule renvoie un unique segment texte', () => {
    expect(parseLightMarkup('5 euros pour un café')).toEqual([
      { type: 'text', value: '5 euros pour un café' },
    ])
  })
})

describe('buildMathMarkup', () => {
  it('reconstruit une formule inline en $latex$', () => {
    expect(buildMathMarkup({ latex: 'x^2', displayMode: false })).toBe('$x^2$')
  })

  it('reconstruit un bloc en $$latex$$', () => {
    expect(buildMathMarkup({ latex: 'x^2', displayMode: true })).toBe('$$x^2$$')
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

// ─── Éditeur « jetons » (LightMarkupEditor, 2026-08-27) ────────────────────
//
// Fonctions DOM pures qui font le pont entre le texte brut `[label](url)`
// (source de vérité, transmise au serveur) et la représentation « jeton »
// affichée à l'écran (label seul visible). Construites ici sur un DOM jsdom
// minimal, indépendamment du composant React.

function makeChip(label: string, url: string): HTMLSpanElement {
  const chip = document.createElement('span')
  chip.setAttribute(LIGHT_MARKUP_CHIP_ATTR, 'true')
  chip.setAttribute(LIGHT_MARKUP_LABEL_ATTR, label)
  chip.setAttribute(LIGHT_MARKUP_URL_ATTR, url)
  chip.contentEditable = 'false'
  chip.textContent = label
  return chip
}

describe('serializeLightMarkupEditor', () => {
  it('reconstruit le texte brut à partir de nœuds texte et de jetons mélangés', () => {
    const root = document.createElement('div')
    root.appendChild(document.createTextNode('Voir '))
    root.appendChild(makeChip('Fiche', 'https://example.com/fiche.pdf'))
    root.appendChild(document.createTextNode(' pour réviser.'))

    expect(serializeLightMarkupEditor(root)).toBe(
      'Voir [Fiche](https://example.com/fiche.pdf) pour réviser.',
    )
  })

  it('un <br> se sérialise en retour à la ligne', () => {
    const root = document.createElement('div')
    root.appendChild(document.createTextNode('Ligne 1'))
    root.appendChild(document.createElement('br'))
    root.appendChild(document.createTextNode('Ligne 2'))

    expect(serializeLightMarkupEditor(root)).toBe('Ligne 1\nLigne 2')
  })

  it('un éditeur vide sérialise en chaîne vide', () => {
    const root = document.createElement('div')
    expect(serializeLightMarkupEditor(root)).toBe('')
  })

  it('un jeton seul sérialise en [label](url) complet, jamais le seul libellé affiché', () => {
    const root = document.createElement('div')
    root.appendChild(makeChip('Fiche de cours', 'https://example.com/fiche.pdf'))

    expect(serializeLightMarkupEditor(root)).toBe('[Fiche de cours](https://example.com/fiche.pdf)')
  })
})

describe('rawOffsetFromDomPosition — jeton (2026-08-27)', () => {
  it("un offset dans un nœud texte se convertit tel quel", () => {
    const root = document.createElement('div')
    const text = document.createTextNode('Bonjour')
    root.appendChild(text)

    expect(rawOffsetFromDomPosition(root, text, 3)).toBe(3)
  })

  it('un offset après un jeton précédent tient compte de sa longueur en texte brut, pas de son libellé affiché', () => {
    const root = document.createElement('div')
    root.appendChild(makeChip('Fiche', 'https://example.com/fiche')) // 29 caractères en texte brut
    const text = document.createTextNode('Suite')
    root.appendChild(text)

    // Position au tout début du second nœud texte : doit valoir la longueur
    // complète du jeton sérialisé (29), pas la longueur de son libellé (5).
    expect(rawOffsetFromDomPosition(root, text, 0)).toBe('[Fiche](https://example.com/fiche)'.length)
  })

  it('une position (root, index) se convertit en offset cumulé des enfants précédents', () => {
    const root = document.createElement('div')
    root.appendChild(document.createTextNode('AB'))
    root.appendChild(makeChip('Fiche', 'https://example.com/fiche'))

    // offset = 1 dans root.childNodes → juste après le premier enfant
    // (« AB »), donc juste avant le second (le jeton) : offset brut = 2.
    expect(rawOffsetFromDomPosition(root, root, 1)).toBe(2)
  })
})

describe('domPositionForRawOffset — jeton (2026-08-27)', () => {
  it('un offset au milieu d\'un nœud texte pointe ce nœud texte', () => {
    const root = document.createElement('div')
    const text = document.createTextNode('Bonjour')
    root.appendChild(text)

    expect(domPositionForRawOffset(root, 3)).toEqual({ node: text, offset: 3 })
  })

  it('un offset exactement après un jeton se place juste après lui (root, index+1)', () => {
    const root = document.createElement('div')
    const chip = makeChip('Fiche', 'https://example.com/fiche')
    root.appendChild(chip)
    const markupLength = '[Fiche](https://example.com/fiche)'.length

    expect(domPositionForRawOffset(root, markupLength)).toEqual({ node: root, offset: 1 })
  })

  it('un offset exactement avant le tout premier jeton se place avant lui (root, 0), jamais après', () => {
    const root = document.createElement('div')
    root.appendChild(makeChip('Fiche', 'https://example.com/fiche'))
    root.appendChild(document.createTextNode('Suite'))

    expect(domPositionForRawOffset(root, 0)).toEqual({ node: root, offset: 0 })
  })

  it('un offset au-delà de tout contenu se place en fin d\'éditeur', () => {
    const root = document.createElement('div')
    root.appendChild(document.createTextNode('AB'))

    expect(domPositionForRawOffset(root, 99)).toEqual({ node: root, offset: 1 })
  })

  it('aller-retour : sérialiser puis reconvertir un offset donne une position cohérente', () => {
    const root = document.createElement('div')
    root.appendChild(document.createTextNode('Suite'))
    root.appendChild(makeChip('Fiche', 'https://example.com/fiche'))

    const raw = serializeLightMarkupEditor(root)
    expect(raw).toBe('Suite[Fiche](https://example.com/fiche)')

    // Position juste après « Suite », avant le jeton.
    const position = domPositionForRawOffset(root, 'Suite'.length)
    expect(position).toEqual({ node: root.childNodes[0], offset: 'Suite'.length })
  })
})
