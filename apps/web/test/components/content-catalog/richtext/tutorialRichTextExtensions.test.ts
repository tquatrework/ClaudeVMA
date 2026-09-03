/**
 * Tests des extensions TipTap du Tutoriel « post » (`tutorialFontSizeMark`,
 * `tutorialTextColorMark`, `tutorialFormulaNode`) — instanciation directe d'un `Editor` headless
 * (pas de composant React ni de simulation de frappe utilisateur) : ce sont ces extensions, code
 * neuf de cette révision, qui portent le risque réel, la seule bibliothèque tierce utilisée
 * (TipTap/ProseMirror) étant déjà éprouvée par ailleurs.
 */

import { describe, it, expect, afterEach } from 'vitest'
import { Editor, type JSONContent } from '@tiptap/core'
import { createTutorialRichTextExtensions } from '../../../../src/components/content-catalog/richtext/tutorialRichTextExtensions'

function createTestEditor(content: JSONContent) {
  return new Editor({
    element: document.createElement('div'),
    extensions: createTutorialRichTextExtensions(),
    content,
  })
}

const HELLO_DOC: JSONContent = {
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] }],
}

let editor: Editor | undefined

afterEach(() => {
  editor?.destroy()
  editor = undefined
})

describe('TutorialFontSize', () => {
  it('applique la marque de taille sur le texte sélectionné', () => {
    editor = createTestEditor(HELLO_DOC)
    editor.chain().selectAll().setTutorialFontSize('xlarge').run()

    const textNode = editor.getJSON().content?.[0]?.content?.[0]
    expect(textNode?.marks).toEqual([{ type: 'tutorialFontSize', attrs: { size: 'xlarge' } }])
  })

  it('revient à "normal" en retirant la marque plutôt qu\'en la conservant à "normal"', () => {
    editor = createTestEditor(HELLO_DOC)
    editor.chain().selectAll().setTutorialFontSize('large').run()
    editor.chain().selectAll().setTutorialFontSize('normal').run()

    const textNode = editor.getJSON().content?.[0]?.content?.[0]
    expect(textNode?.marks ?? []).toEqual([])
  })
})

describe('TutorialTextColor', () => {
  it('applique la marque de couleur sur le texte sélectionné', () => {
    editor = createTestEditor(HELLO_DOC)
    editor.chain().selectAll().setTutorialTextColor('indigo').run()

    const textNode = editor.getJSON().content?.[0]?.content?.[0]
    expect(textNode?.marks).toEqual([{ type: 'tutorialTextColor', attrs: { color: 'indigo' } }])
  })

  it('la taille et la couleur coexistent sur le même texte', () => {
    editor = createTestEditor(HELLO_DOC)
    editor.chain().selectAll().setTutorialFontSize('large').setTutorialTextColor('red').run()

    const textNode = editor.getJSON().content?.[0]?.content?.[0]
    expect(textNode?.marks).toEqual(
      expect.arrayContaining([
        { type: 'tutorialFontSize', attrs: { size: 'large' } },
        { type: 'tutorialTextColor', attrs: { color: 'red' } },
      ]),
    )
  })
})

describe('TutorialFormula', () => {
  it('insère un nœud formule portant le latex fourni', () => {
    editor = createTestEditor({ type: 'doc', content: [{ type: 'paragraph' }] })
    editor.chain().focus().insertTutorialFormula('x^2 + y^2 = z^2').run()

    const paragraph = editor.getJSON().content?.[0]
    const formulaNode = paragraph?.content?.find((node) => node.type === 'tutorialFormula')
    expect(formulaNode?.attrs).toEqual({ latex: 'x^2 + y^2 = z^2' })
  })

  it('hérite la taille active au moment de l’insertion (formule à la bonne taille)', () => {
    editor = createTestEditor({ type: 'doc', content: [{ type: 'paragraph' }] })
    editor.chain().focus().setTutorialFontSize('xlarge').insertTutorialFormula('x^2').run()

    const paragraph = editor.getJSON().content?.[0]
    const formulaNode = paragraph?.content?.find((node) => node.type === 'tutorialFormula')
    expect(formulaNode?.marks).toEqual(
      expect.arrayContaining([{ type: 'tutorialFontSize', attrs: { size: 'xlarge' } }]),
    )
  })
})

describe('Portée réduite (StarterKit sans les nœuds/marques non demandés)', () => {
  it('ne connaît pas les titres structurels, listes ou blocs de code', () => {
    editor = createTestEditor(HELLO_DOC)
    const schema = editor.schema
    expect(schema.nodes.heading).toBeUndefined()
    expect(schema.nodes.bulletList).toBeUndefined()
    expect(schema.nodes.orderedList).toBeUndefined()
    expect(schema.nodes.codeBlock).toBeUndefined()
    expect(schema.marks.strike).toBeUndefined()
  })

  it('garde gras et italique, gras d’ailleurs suffisant à composer un titre', () => {
    editor = createTestEditor(HELLO_DOC)
    editor.chain().selectAll().toggleBold().run()
    const textNode = editor.getJSON().content?.[0]?.content?.[0]
    expect(textNode?.marks).toEqual(expect.arrayContaining([{ type: 'bold' }]))
  })
})
