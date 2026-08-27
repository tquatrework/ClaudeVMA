/**
 * Tests de MemoItemEditor — création d'un item de mémo (texte/formule/image).
 *
 * Couvre deux défauts remontés par test utilisateur réel le 2026-08-27
 * (`docs/services/front/` — chantier `feat/memo-formules`) :
 * 1. Le champ « Titre » (régression de la refonte chapitres+items) est bien
 *    restauré, pour les trois types, et transmis à l'appel de création.
 * 2. Une formule MathLive laissée incomplète (`\placeholder{}` non rempli,
 *    ex. racine n-ième insérée sans indice) est refusée **avant** l'appel
 *    réseau, avec un message clair en français — jamais de LaTeX brut affiché
 *    et jamais d'enregistrement d'une formule incomplète.
 *
 * `MemoFormulaInput` est mocké (même pattern que `MemosPage.test.tsx`) : son
 * propre comportement (repli MathLive) est couvert par
 * `MemoFormulaInput.test.tsx`.
 */

import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../src/api/pedagogicalLogMemos')
vi.mock('../../../src/components/pedagogical-log/MemoFormulaInput', () => ({
  MemoFormulaInput: (props: { id: string; value: string; onChange: (v: string) => void }) => (
    <textarea
      data-testid="formula-input-stub"
      id={props.id}
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
    />
  ),
}))

import {
  createMemoTextOrFormulaItem,
  uploadMemoImageItem,
} from '../../../src/api/pedagogicalLogMemos'
import MemoItemEditor from '../../../src/components/pedagogical-log/MemoItemEditor'

const mockCreateMemoTextOrFormulaItem = vi.mocked(createMemoTextOrFormulaItem)
const mockUploadMemoImageItem = vi.mocked(uploadMemoImageItem)

const NOW = '2026-08-27T00:00:00.000Z'

beforeEach(() => {
  vi.clearAllMocks()
})

function renderEditor(onSave = vi.fn(), onCancel = vi.fn()) {
  render(<MemoItemEditor chapterId="ch-1" onSave={onSave} onCancel={onCancel} />)
  return { onSave, onCancel }
}

describe('MemoItemEditor — titre de l\'item (défaut 1 : régression)', () => {
  it('affiche un champ de saisie « Titre » pour le type texte, transmis à la création', async () => {
    mockCreateMemoTextOrFormulaItem.mockResolvedValue({
      id: 'it-1',
      chapterId: 'ch-1',
      type: 'text',
      content: 'Retenir la formule',
      title: 'Formule clé',
      order: 0,
      createdAt: NOW,
      updatedAt: NOW,
    })
    const { onSave } = renderEditor()

    await userEvent.type(screen.getByLabelText(/titre \(optionnel\)/i), 'Formule clé')
    await userEvent.type(screen.getByPlaceholderText(/texte libre/i), 'Retenir la formule')
    await userEvent.click(screen.getByRole('button', { name: /ajouter$/i }))

    expect(mockCreateMemoTextOrFormulaItem).toHaveBeenCalledWith('ch-1', {
      type: 'text',
      content: 'Retenir la formule',
      title: 'Formule clé',
    })
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ title: 'Formule clé' }))
  })

  it('transmet le titre pour un item formule', async () => {
    mockCreateMemoTextOrFormulaItem.mockResolvedValue({
      id: 'it-2',
      chapterId: 'ch-1',
      type: 'formula',
      content: 'x^2+y^2=z^2',
      title: 'Pythagore',
      order: 0,
      createdAt: NOW,
      updatedAt: NOW,
    })
    renderEditor()

    await userEvent.click(screen.getByRole('radio', { name: 'Formule' }))
    await userEvent.type(screen.getByLabelText(/titre \(optionnel\)/i), 'Pythagore')
    await userEvent.type(screen.getByTestId('formula-input-stub'), 'x^2+y^2=z^2')
    await userEvent.click(screen.getByRole('button', { name: /ajouter$/i }))

    expect(mockCreateMemoTextOrFormulaItem).toHaveBeenCalledWith('ch-1', {
      type: 'formula',
      content: 'x^2+y^2=z^2',
      title: 'Pythagore',
    })
  })

  it('transmet le titre pour un item image', async () => {
    mockUploadMemoImageItem.mockResolvedValue({
      id: 'it-3',
      chapterId: 'ch-1',
      type: 'image',
      content: null,
      title: 'Schéma',
      imageOriginalFilename: 'schema.png',
      imageStoredFilename: 'uuid.png',
      imageMimeType: 'image/png',
      imageSizeBytes: 1000,
      order: 0,
      createdAt: NOW,
      updatedAt: NOW,
    })
    renderEditor()

    await userEvent.click(screen.getByRole('radio', { name: 'Image' }))
    await userEvent.type(screen.getByLabelText(/titre \(optionnel\)/i), 'Schéma')
    const file = new File([new Uint8Array([1, 2, 3])], 'schema.png', { type: 'image/png' })
    await userEvent.upload(screen.getByLabelText(/^image$/i), file)
    await userEvent.click(screen.getByRole('button', { name: /ajouter$/i }))

    expect(mockUploadMemoImageItem).toHaveBeenCalledWith('ch-1', file, undefined, 'Schéma')
  })

  it('n\'envoie pas de titre quand le champ est laissé vide', async () => {
    mockCreateMemoTextOrFormulaItem.mockResolvedValue({
      id: 'it-4',
      chapterId: 'ch-1',
      type: 'text',
      content: 'Sans titre',
      title: null,
      order: 0,
      createdAt: NOW,
      updatedAt: NOW,
    })
    renderEditor()

    await userEvent.type(screen.getByPlaceholderText(/texte libre/i), 'Sans titre')
    await userEvent.click(screen.getByRole('button', { name: /ajouter$/i }))

    expect(mockCreateMemoTextOrFormulaItem).toHaveBeenCalledWith('ch-1', {
      type: 'text',
      content: 'Sans titre',
      title: undefined,
    })
  })
})

describe('MemoItemEditor — formule incomplète (défaut 2)', () => {
  // `fireEvent.change` plutôt que `userEvent.type` : le LaTeX contient des
  // accolades et crochets, syntaxe spéciale pour `userEvent.type` (ex.
  // `{selectall}`) — on pose la valeur directement, comme le ferait MathLive
  // en exportant son `value`.
  it('refuse la soumission d\'une formule contenant \\placeholder{} et affiche un message clair', async () => {
    renderEditor()

    await userEvent.click(screen.getByRole('radio', { name: 'Formule' }))
    fireEvent.change(screen.getByTestId('formula-input-stub'), {
      target: {
        value:
          'x^2=a,S=\\left\\lbrace\\sqrt[\\placeholder{}]{a};-\\sqrt[\\placeholder{}]{a}\\right\\rbrace',
      },
    })
    await userEvent.click(screen.getByRole('button', { name: /ajouter$/i }))

    const errorMessage = screen.getByText(/formule incomplète/i)
    // Le message affiché à l'élève reste en français neutre, sans exposer le
    // LaTeX brut (`\placeholder{}` reste visible dans le champ de saisie
    // lui-même — c'est attendu, ce n'est que le message d'erreur qui ne doit
    // jamais le reprendre).
    expect(errorMessage.textContent).not.toMatch(/placeholder/i)
    expect(mockCreateMemoTextOrFormulaItem).not.toHaveBeenCalled()
    // Le formulaire reste ouvert pour permettre à l'élève de compléter.
    expect(screen.getByTestId('formula-input-stub')).toBeDefined()
  })

  it('accepte une formule complète, sans \\placeholder{}', async () => {
    mockCreateMemoTextOrFormulaItem.mockResolvedValue({
      id: 'it-5',
      chapterId: 'ch-1',
      type: 'formula',
      content: 'x^2=a,S=\\left\\lbrace\\sqrt{a};-\\sqrt{a}\\right\\rbrace',
      title: null,
      order: 0,
      createdAt: NOW,
      updatedAt: NOW,
    })
    renderEditor()

    await userEvent.click(screen.getByRole('radio', { name: 'Formule' }))
    fireEvent.change(screen.getByTestId('formula-input-stub'), {
      target: { value: 'x^2=a,S=\\left\\lbrace\\sqrt{a};-\\sqrt{a}\\right\\rbrace' },
    })
    await userEvent.click(screen.getByRole('button', { name: /ajouter$/i }))

    expect(mockCreateMemoTextOrFormulaItem).toHaveBeenCalledTimes(1)
    expect(screen.queryByText(/formule incomplète/i)).toBeNull()
  })
})
