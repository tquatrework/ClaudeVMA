/**
 * Tests de `TutorialRichTextEditor` — éditeur riche (WYSIWYG) d'un bloc `text` de Tutoriel « post »
 * (arbitrage du 2026-09-03). Couvre : pré-remplissage depuis un contenu existant (édition), frappe
 * simple appelant `onChange`, insertion de formule via la barre d'outils, et présence de la
 * barre d'outils (taille/couleur/formule).
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { TutorialRichTextEditor } from '../../../src/components/content-catalog/TutorialRichTextEditor'
import { serializeTutorialRichTextContent } from '../../../src/utils/tutorialRichTextContent'

describe('TutorialRichTextEditor', () => {
  it('affiche la barre d’outils (gras, italique, taille, couleurs, formule)', () => {
    render(<TutorialRichTextEditor value="" onChange={vi.fn()} isSubmitting={false} fieldLabel="Bloc 1" />)

    expect(screen.getByRole('button', { name: 'Gras' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Italique' })).toBeDefined()
    expect(screen.getByLabelText('Taille du texte')).toBeDefined()
    expect(screen.getByRole('group', { name: 'Couleur du texte' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Insérer une formule' })).toBeDefined()
  })

  it('pré-remplit l’éditeur avec un contenu existant (texte brut historique)', () => {
    render(
      <TutorialRichTextEditor
        value="Contenu déjà enregistré."
        onChange={vi.fn()}
        isSubmitting={false}
        fieldLabel="Bloc 1"
      />,
    )

    expect(screen.getByText('Contenu déjà enregistré.')).toBeDefined()
  })

  it('pré-remplit l’éditeur avec un document TipTap déjà structuré', () => {
    const doc = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Déjà structuré' }] }],
    }
    render(
      <TutorialRichTextEditor
        value={serializeTutorialRichTextContent(doc)}
        onChange={vi.fn()}
        isSubmitting={false}
        fieldLabel="Bloc 1"
      />,
    )

    expect(screen.getByText('Déjà structuré')).toBeDefined()
  })

  it('appelle onChange avec un document structuré JSON quand l’utilisateur tape', async () => {
    const handleChange = vi.fn()
    const { container } = render(
      <TutorialRichTextEditor value="" onChange={handleChange} isSubmitting={false} fieldLabel="Bloc 1" />,
    )

    const editable = container.querySelector('[contenteditable="true"]') as HTMLElement
    await userEvent.click(editable)
    await userEvent.type(editable, 'Bonjour')

    await waitFor(() => {
      expect(handleChange).toHaveBeenCalled()
    })
    const lastCallValue = handleChange.mock.calls.at(-1)?.[0] as string
    const parsed = JSON.parse(lastCallValue)
    expect(parsed.type).toBe('doc')
    expect(JSON.stringify(parsed)).toContain('Bonjour')
  })

  it('insère une formule via la barre d’outils et répercute le document structuré', async () => {
    const handleChange = vi.fn()
    render(<TutorialRichTextEditor value="" onChange={handleChange} isSubmitting={false} fieldLabel="Bloc 1" />)

    await userEvent.click(screen.getByRole('button', { name: 'Insérer une formule' }))

    // MathLive ne s'enregistre pas comme élément personnalisé en jsdom : le composant retombe sur
    // son repli textarea après le délai d'attente (même comportement que `MemoFormulaInput.test.tsx`).
    await waitFor(
      () => {
        expect(screen.getByPlaceholderText(/x\^2/)).toBeDefined()
      },
      { timeout: 3000 },
    )

    const formulaTextarea = screen.getByPlaceholderText(/x\^2/)
    await userEvent.type(formulaTextarea, 'x^2')
    await userEvent.click(screen.getByRole('button', { name: 'Insérer' }))

    await waitFor(() => {
      expect(handleChange).toHaveBeenCalled()
    })
    const lastCallValue = handleChange.mock.calls.at(-1)?.[0] as string
    expect(lastCallValue).toContain('tutorialFormula')
    expect(lastCallValue).toContain('x^2')
  })

  it('refuse d’insérer une formule vide', async () => {
    render(<TutorialRichTextEditor value="" onChange={vi.fn()} isSubmitting={false} fieldLabel="Bloc 1" />)

    await userEvent.click(screen.getByRole('button', { name: 'Insérer une formule' }))
    await waitFor(
      () => {
        expect(screen.getByPlaceholderText(/x\^2/)).toBeDefined()
      },
      { timeout: 3000 },
    )
    await userEvent.click(screen.getByRole('button', { name: 'Insérer' }))

    expect(screen.getByText('La formule est vide.')).toBeDefined()
  })
})
