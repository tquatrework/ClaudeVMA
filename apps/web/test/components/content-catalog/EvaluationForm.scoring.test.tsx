/**
 * Tests pour le barème informatif d'`EvaluationForm` (arbitrage du 2026-09-02,
 * `docs/architecture.md` > « Barème informatif pour l'Évaluation »).
 *
 * Couvre les deux granularités :
 * - « Par exercice » : un champ de points par exercice sélectionné, envoyé dans
 *   `scoring: {mode: 'per_exercise', entries: [...]}`.
 * - « Par question » : `useExerciseQuestionParts` charge les blocs `question` de chaque exercice
 *   (`fetchExercise` mocké) ; un champ de points par question, envoyé dans
 *   `scoring: {mode: 'per_question', entries: [...]}`.
 *
 * Passe un `initialDraft` déjà rempli avec des exercices sélectionnés — `EvaluationExercisePicker`
 * n'ajoute jamais d'exercice lui-même en dehors d'une navigation réelle, hors de portée d'un test
 * de composant isolé.
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../src/api/evaluations')
vi.mock('../../../src/api/exercises')

import { createEvaluation } from '../../../src/api/evaluations'
import { fetchExercise } from '../../../src/api/exercises'
import { EvaluationForm } from '../../../src/components/content-catalog/EvaluationForm'
import { createEmptyScoringState } from '../../../src/utils/evaluationScoring'
import type { EditableEvaluationFormState } from '../../../src/utils/evaluationDraft'
import type { PublicExerciseDetail } from '../../../src/types/exercise'

const mockCreateEvaluation = vi.mocked(createEvaluation)
const mockFetchExercise = vi.mocked(fetchExercise)

function baseDraft(): EditableEvaluationFormState {
  return {
    title: 'Évaluation de géométrie',
    level: '',
    difficulty: '',
    theme: '',
    competenciesInput: '',
    tagsInput: '',
    durationMinutes: '30',
    blockBackNavigation: false,
    exerciseItems: [
      { exerciseId: 'exercise-1', title: 'Théorème de Pythagore', titleOverride: '' },
    ],
    scoring: createEmptyScoringState(),
  }
}

function renderForm(initialDraft: EditableEvaluationFormState) {
  return render(
    <MemoryRouter>
      <EvaluationForm onSaved={vi.fn()} onCancel={vi.fn()} initialDraft={initialDraft} />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('EvaluationForm — barème informatif', () => {
  it('mode « Par exercice » : envoie un point par exercice sélectionné', async () => {
    mockCreateEvaluation.mockResolvedValue({
      id: 'eval-1',
      title: 'Évaluation de géométrie',
      exerciseItems: [{ exerciseId: 'exercise-1', order: 1 }],
      tags: [],
      durationSeconds: 1800,
      blockBackNavigation: false,
      status: 'pending_validation',
      authorId: 'author-1',
      createdAt: '',
      updatedAt: '',
    } as never)

    renderForm(baseDraft())

    await userEvent.click(screen.getByRole('radio', { name: 'Par exercice' }))

    const pointsInput = screen.getByLabelText('Points pour Théorème de Pythagore')
    await userEvent.type(pointsInput, '5')

    await userEvent.click(screen.getByRole('button', { name: "Créer l'évaluation" }))

    await waitFor(() => expect(mockCreateEvaluation).toHaveBeenCalledTimes(1))
    expect(mockCreateEvaluation).toHaveBeenCalledWith(
      expect.objectContaining({
        scoring: { mode: 'per_exercise', entries: [{ exerciseId: 'exercise-1', points: 5 }] },
      }),
    )
    expect(mockFetchExercise).not.toHaveBeenCalled()
  })

  it('mode « Par question » : charge les blocs question puis envoie un point par question', async () => {
    mockFetchExercise.mockResolvedValue({
      id: 'exercise-1',
      title: 'Théorème de Pythagore',
      tags: [],
      status: 'validated',
      authorId: 'author-1',
      createdAt: '',
      updatedAt: '',
      parts: [
        {
          id: 'part-statement',
          partNumber: 1,
          category: 'statement',
          items: [{ id: 'item-1', type: 'text', order: 1, content: 'Énoncé' }],
          hasSolution: false,
        },
        {
          id: 'part-question-1',
          partNumber: 2,
          category: 'question',
          items: [{ id: 'item-2', type: 'text', order: 1, content: 'Calculez la longueur BC.' }],
          hasSolution: true,
        },
      ],
    } as PublicExerciseDetail)

    mockCreateEvaluation.mockResolvedValue({
      id: 'eval-1',
      title: 'Évaluation de géométrie',
      exerciseItems: [{ exerciseId: 'exercise-1', order: 1 }],
      tags: [],
      durationSeconds: 1800,
      blockBackNavigation: false,
      status: 'pending_validation',
      authorId: 'author-1',
      createdAt: '',
      updatedAt: '',
    } as never)

    renderForm(baseDraft())

    await userEvent.click(screen.getByRole('radio', { name: 'Par question' }))

    await waitFor(() => expect(mockFetchExercise).toHaveBeenCalledWith('exercise-1'))
    await waitFor(() => screen.getByText('Calculez la longueur BC.'))

    const pointsInput = screen.getByLabelText('Points pour la question 1 de Théorème de Pythagore')
    await userEvent.type(pointsInput, '3')

    await userEvent.click(screen.getByRole('button', { name: "Créer l'évaluation" }))

    await waitFor(() => expect(mockCreateEvaluation).toHaveBeenCalledTimes(1))
    expect(mockCreateEvaluation).toHaveBeenCalledWith(
      expect.objectContaining({
        scoring: {
          mode: 'per_question',
          entries: [{ exerciseId: 'exercise-1', partId: 'part-question-1', points: 3 }],
        },
      }),
    )
  })

  it('mode « Aucun barème » (défaut) : `scoring` absent du payload envoyé', async () => {
    mockCreateEvaluation.mockResolvedValue({
      id: 'eval-1',
      title: 'Évaluation de géométrie',
      exerciseItems: [{ exerciseId: 'exercise-1', order: 1 }],
      tags: [],
      durationSeconds: 1800,
      blockBackNavigation: false,
      status: 'pending_validation',
      authorId: 'author-1',
      createdAt: '',
      updatedAt: '',
    } as never)

    renderForm(baseDraft())

    await userEvent.click(screen.getByRole('button', { name: "Créer l'évaluation" }))

    await waitFor(() => expect(mockCreateEvaluation).toHaveBeenCalledTimes(1))
    const payload = mockCreateEvaluation.mock.calls[0][0]
    expect(payload.scoring).toBeUndefined()
  })

  it('refuse la soumission si le mode « Par exercice » est choisi sans aucun point renseigné', async () => {
    renderForm(baseDraft())

    await userEvent.click(screen.getByRole('radio', { name: 'Par exercice' }))
    await userEvent.click(screen.getByRole('button', { name: "Créer l'évaluation" }))

    await waitFor(() =>
      expect(
        screen.getByText('Renseignez au moins un barème par exercice, ou choisissez « Aucun barème ».'),
      ).toBeInTheDocument(),
    )
    expect(mockCreateEvaluation).not.toHaveBeenCalled()
  })
})

describe('EvaluationForm — édition avec barème déjà enregistré', () => {
  it('pré-remplit le mode et les points depuis `initialDraft.scoring`', () => {
    const draft = baseDraft()
    draft.scoring = {
      mode: 'per_exercise',
      pointsByExerciseId: { 'exercise-1': '4' },
      pointsByPartKey: {},
    }

    render(
      <MemoryRouter>
        <EvaluationForm
          mode="edit"
          evaluationId="eval-1"
          onSaved={vi.fn()}
          onCancel={vi.fn()}
          initialDraft={draft}
        />
      </MemoryRouter>,
    )

    expect(screen.getByRole('radio', { name: 'Par exercice' })).toBeChecked()
    const pointsInput = screen.getByLabelText('Points pour Théorème de Pythagore') as HTMLInputElement
    expect(pointsInput.value).toBe('4')
  })
})
