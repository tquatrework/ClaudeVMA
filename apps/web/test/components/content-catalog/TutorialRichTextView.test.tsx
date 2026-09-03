/**
 * Tests de `TutorialRichTextView` — rendu en lecture seule d'un bloc `text` de Tutoriel « post »
 * (arbitrage du 2026-09-03). Couvre : rendu d'un document structuré (texte, formule, taille,
 * couleur) et repli sur du texte brut historique sans planter.
 */

import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { TutorialRichTextView } from '../../../src/components/content-catalog/TutorialRichTextView'
import { serializeTutorialRichTextContent } from '../../../src/utils/tutorialRichTextContent'

describe('TutorialRichTextView', () => {
  it('rend un texte simple', () => {
    render(<TutorialRichTextView content="Un simple contenu historique." />)
    expect(screen.getByText('Un simple contenu historique.')).toBeDefined()
  })

  it('ne plante pas sur un contenu vide ou nul', () => {
    const { rerender } = render(<TutorialRichTextView content={null} />)
    rerender(<TutorialRichTextView content="" />)
    // Aucune assertion de contenu : le point testé est l'absence de plantage.
  })

  it('rend un document structuré avec taille et couleur appliquées', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'Titre en couleur',
              marks: [
                { type: 'tutorialFontSize', attrs: { size: 'xlarge' } },
                { type: 'tutorialTextColor', attrs: { color: 'indigo' } },
              ],
            },
          ],
        },
      ],
    }
    const { container } = render(
      <TutorialRichTextView content={serializeTutorialRichTextContent(doc)} />,
    )

    const styledSpan = container.querySelector('[data-tutorial-size="xlarge"]')
    expect(styledSpan).not.toBeNull()
    expect(styledSpan?.textContent).toBe('Titre en couleur')
    expect(container.querySelector('[data-tutorial-color="indigo"]')).not.toBeNull()
  })

  it('rend une formule mathématique inline via KaTeX', async () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'La formule ' },
            { type: 'tutorialFormula', attrs: { latex: 'x^2' } },
            { type: 'text', text: ' est affichée.' },
          ],
        },
      ],
    }
    const { container } = render(
      <TutorialRichTextView content={serializeTutorialRichTextContent(doc)} />,
    )

    // Le nœud formule est un `NodeView` React monté via un portail — sa mise à jour n'est pas
    // synchrone avec le premier rendu de `render()`, d'où l'attente ci-dessous.
    await waitFor(() => {
      expect(container.querySelector('.katex')).not.toBeNull()
    })
  })
})
