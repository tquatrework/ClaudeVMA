/**
 * EvaluationCreationSection — bouton de création + formulaire d'Évaluation.
 * Même découpage que `ExerciseCreationSection`/`QuizCreationSection`.
 */

import React, { useState } from 'react'
import { EvaluationForm } from './EvaluationForm'
import type { Evaluation } from '../../types/evaluation'

interface EvaluationCreationSectionProps {
  canCreateEvaluation: boolean
  onEvaluationCreated: (createdEvaluation: Evaluation) => void
  onOpenCreateForm: () => void
  onListsChanged: () => void
}

export function EvaluationCreationSection({
  canCreateEvaluation,
  onEvaluationCreated,
  onOpenCreateForm,
  onListsChanged,
}: EvaluationCreationSectionProps) {
  const [shouldShowCreateForm, setShouldShowCreateForm] = useState(false)

  if (!canCreateEvaluation) return null

  return (
    <div className="space-y-4">
      {!shouldShowCreateForm && (
        <button
          type="button"
          onClick={() => {
            onOpenCreateForm()
            setShouldShowCreateForm(true)
          }}
          className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 transition-colors"
        >
          Créer une nouvelle évaluation
        </button>
      )}

      {shouldShowCreateForm && (
        <EvaluationForm
          onSaved={(createdEvaluation) => {
            setShouldShowCreateForm(false)
            onEvaluationCreated(createdEvaluation)
            onListsChanged()
          }}
          onCancel={() => setShouldShowCreateForm(false)}
        />
      )}
    </div>
  )
}
