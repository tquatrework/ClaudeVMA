/**
 * Tests pour l'affichage du barème informatif dans `EvaluationExercisePlayer` (arbitrage du
 * 2026-09-02, `docs/architecture.md` > « Barème informatif pour l'Évaluation »).
 *
 * Couvre les deux granularités : « par exercice » (un badge de points près du titre de
 * l'exercice) et « par question » (un badge de points près de chaque bloc question). Sans
 * `scoring`, aucun badge ne doit apparaître.
 */

import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

import { EvaluationExercisePlayer } from '../../../src/components/learning-activity/EvaluationExercisePlayer'
import type { PublicExerciseDetail } from '../../../src/types/exercise'
import type { EvaluationScoring } from '../../../src/types/evaluation'

const exercise: PublicExerciseDetail = {
  id: 'exercise-1',
  title: 'Théorème de Pythagore',
  tags: [],
  status: 'validated',
  authorId: 'author-1',
  createdAt: '',
  updatedAt: '',
  parts: [
    {
      id: 'part-question-1',
      partNumber: 1,
      category: 'question',
      items: [{ id: 'item-1', type: 'text', order: 1, content: 'Calculez la longueur BC.' }],
      hasSolution: true,
    },
  ],
}

function renderPlayer(scoring?: EvaluationScoring | null) {
  return render(
    <EvaluationExercisePlayer
      exercise={exercise}
      displayTitle="Théorème de Pythagore"
      answers={[]}
      isAnswerable
      onAnswerSubmit={vi.fn()}
      scoring={scoring}
    />,
  )
}

describe('EvaluationExercisePlayer — barème informatif', () => {
  it('affiche un badge de points au niveau de l’exercice en mode per_exercise', () => {
    renderPlayer({
      mode: 'per_exercise',
      entries: [{ exerciseId: 'exercise-1', points: 7 }],
    })

    expect(screen.getByText('7 pts')).toBeInTheDocument()
  })

  it('affiche un badge de points au niveau de la question en mode per_question', () => {
    renderPlayer({
      mode: 'per_question',
      entries: [{ exerciseId: 'exercise-1', partId: 'part-question-1', points: 1 }],
    })

    expect(screen.getByText('1 pt')).toBeInTheDocument()
  })

  it('n’affiche aucun badge sans barème', () => {
    renderPlayer(null)

    expect(screen.queryByText(/pt/)).not.toBeInTheDocument()
  })
})
