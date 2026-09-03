/**
 * Tests de `tutorialRichTextContent.ts` — interprétation du champ `content` d'un bloc `text` de
 * Tutoriel « post » (arbitrage du 2026-09-03).
 */

import { describe, it, expect } from 'vitest'
import {
  EMPTY_TUTORIAL_RICH_TEXT_DOCUMENT,
  isTutorialRichTextEmpty,
  parseTutorialRichTextContent,
  serializeTutorialRichTextContent,
} from '../../src/utils/tutorialRichTextContent'

describe('parseTutorialRichTextContent', () => {
  it('renvoie le document vide pour un contenu absent ou vide', () => {
    expect(parseTutorialRichTextContent(null)).toEqual(EMPTY_TUTORIAL_RICH_TEXT_DOCUMENT)
    expect(parseTutorialRichTextContent(undefined)).toEqual(EMPTY_TUTORIAL_RICH_TEXT_DOCUMENT)
    expect(parseTutorialRichTextContent('')).toEqual(EMPTY_TUTORIAL_RICH_TEXT_DOCUMENT)
  })

  it('reparse un document TipTap valide tel quel', () => {
    const doc = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Bonjour' }] }],
    }
    expect(parseTutorialRichTextContent(JSON.stringify(doc))).toEqual(doc)
  })

  it('enveloppe du texte brut historique (avant cette révision) dans un paragraphe', () => {
    const result = parseTutorialRichTextContent('Un texte simple avec $x^2$')
    expect(result).toEqual({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Un texte simple avec $x^2$' }] }],
    })
  })

  it('enveloppe un JSON valide mais qui ne représente pas un document TipTap', () => {
    const result = parseTutorialRichTextContent('{"foo":"bar"}')
    expect(result).toEqual({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: '{"foo":"bar"}' }] }],
    })
  })

  it('ne plante jamais sur un JSON malformé', () => {
    expect(() => parseTutorialRichTextContent('{not valid json')).not.toThrow()
  })
})

describe('serializeTutorialRichTextContent', () => {
  it('sérialise le document en JSON', () => {
    const doc = { type: 'doc', content: [{ type: 'paragraph' }] }
    expect(serializeTutorialRichTextContent(doc)).toBe(JSON.stringify(doc))
  })
})

describe('isTutorialRichTextEmpty', () => {
  it('considère vide un document sans aucun texte', () => {
    expect(isTutorialRichTextEmpty(EMPTY_TUTORIAL_RICH_TEXT_DOCUMENT)).toBe(true)
  })

  it('considère vide un document dont le seul texte est composé d’espaces', () => {
    const doc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: '   ' }] }] }
    expect(isTutorialRichTextEmpty(doc)).toBe(true)
  })

  it('n’est pas vide dès qu’un texte réel est présent, même imbriqué dans des marques', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Titre', marks: [{ type: 'bold' }] }],
        },
      ],
    }
    expect(isTutorialRichTextEmpty(doc)).toBe(false)
  })

  it('n’est pas vide si le document ne porte qu’une formule', () => {
    const doc = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'tutorialFormula', attrs: { latex: 'x^2' } }] }],
    }
    expect(isTutorialRichTextEmpty(doc)).toBe(false)
  })
})
