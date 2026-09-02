/**
 * Tests pour EvaluationForm — boutons « Nouveau » et « Rechercher » d'`EvaluationExercisePicker`
 * (2026-09-02).
 *
 * Couvre :
 * - « Nouveau » sauvegarde le brouillon en cours (titre, tags, exercices déjà choisis…) dans
 *   `sessionStorage` puis navigue vers `/content/exercises` avec l'intention `create`.
 * - « Rechercher » fait de même, mais avec l'intention `search` et le mot-clé tapé transmis en
 *   `prefillKeyword` — corrige le bug réel du `<form>` imbriqué qui soumettait silencieusement le
 *   formulaire d'Évaluation englobant au lieu de lancer une recherche.
 * - Aucune des deux actions ne déclenche la soumission du formulaire d'Évaluation (`createEvaluation`
 *   n'est jamais appelée par ces boutons).
 */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('../../../src/api/evaluations')

import { createEvaluation } from '../../../src/api/evaluations'
import { EvaluationForm } from '../../../src/components/content-catalog/EvaluationForm'

const mockCreateEvaluation = vi.mocked(createEvaluation)

function renderForm() {
  return render(
    <MemoryRouter>
      <EvaluationForm onSaved={vi.fn()} onCancel={vi.fn()} />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  sessionStorage.clear()
})

describe('EvaluationForm — boutons « Nouveau » et « Rechercher »', () => {
  it('« Nouveau » sauvegarde le brouillon et navigue avec l’intention create, sans soumettre le formulaire', async () => {
    renderForm()

    await userEvent.type(screen.getByLabelText(/^titre/i), 'Ma nouvelle évaluation')
    await userEvent.type(screen.getByLabelText(/tags de recherche/i), 'algèbre')

    await userEvent.click(screen.getByRole('button', { name: 'Nouveau' }))

    expect(mockNavigate).toHaveBeenCalledWith('/content/exercises', {
      state: { returnToEvaluationDraft: true, exercisePickerIntent: 'create' },
    })

    const savedDraft = JSON.parse(sessionStorage.getItem('evaluationDraftBeforeExerciseCreation')!)
    expect(savedDraft.title).toBe('Ma nouvelle évaluation')
    expect(savedDraft.tagsInput).toBe('algèbre')

    expect(mockCreateEvaluation).not.toHaveBeenCalled()
  })

  it('« Rechercher » sauvegarde le brouillon et navigue avec l’intention search et le mot-clé tapé', async () => {
    renderForm()

    await userEvent.type(screen.getByLabelText(/^titre/i), 'Évaluation en cours')
    await userEvent.type(
      screen.getByPlaceholderText(/rechercher un exercice par titre/i),
      'fractions',
    )

    await userEvent.click(screen.getByRole('button', { name: 'Rechercher' }))

    expect(mockNavigate).toHaveBeenCalledWith('/content/exercises', {
      state: {
        returnToEvaluationDraft: true,
        exercisePickerIntent: 'search',
        prefillKeyword: 'fractions',
      },
    })

    const savedDraft = JSON.parse(sessionStorage.getItem('evaluationDraftBeforeExerciseCreation')!)
    expect(savedDraft.title).toBe('Évaluation en cours')

    expect(mockCreateEvaluation).not.toHaveBeenCalled()
  })

  it('appuyer sur Entrée dans le champ de recherche ne soumet pas le formulaire d’Évaluation', async () => {
    renderForm()

    await userEvent.type(screen.getByLabelText(/^titre/i), 'Titre quelconque')
    const searchInput = screen.getByPlaceholderText(/rechercher un exercice par titre/i)
    await userEvent.type(searchInput, 'geometrie{Enter}')

    // Aucune navigation ni création déclenchée par la seule touche Entrée.
    expect(mockNavigate).not.toHaveBeenCalled()
    expect(mockCreateEvaluation).not.toHaveBeenCalled()
  })
})
