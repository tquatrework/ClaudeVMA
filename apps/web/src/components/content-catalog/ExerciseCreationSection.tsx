/**
 * ExerciseCreationSection — bouton de création + formulaire d'Exercice.
 *
 * Extrait de `ExerciseCatalogPage` pour rester sous le seuil de 300 lignes du fichier de page —
 * même découpage que `QuizCreationSection`.
 */

import React, { useState } from 'react'
import { ExerciseForm } from './ExerciseForm'
import type { PublicExerciseDetail } from '../../types/exercise'

interface ExerciseCreationSectionProps {
  canCreateExercise: boolean
  /** Un exercice vient d'être créé — la page affiche son bandeau de succès. */
  onExerciseCreated: (createdExercise: PublicExerciseDetail) => void
  /** Avant d'ouvrir le formulaire de création : la page efface un bandeau déjà affiché. */
  onOpenCreateForm: () => void
  /** Catalogue et « Mes Exercices » doivent être rechargés (création terminée). */
  onListsChanged: () => void
}

export function ExerciseCreationSection({
  canCreateExercise,
  onExerciseCreated,
  onOpenCreateForm,
  onListsChanged,
}: ExerciseCreationSectionProps) {
  const [shouldShowCreateForm, setShouldShowCreateForm] = useState(false)

  if (!canCreateExercise) return null

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
          Créer un nouvel exercice
        </button>
      )}

      {shouldShowCreateForm && (
        <ExerciseForm
          onSaved={(createdExercise) => {
            setShouldShowCreateForm(false)
            onExerciseCreated(createdExercise)
            onListsChanged()
          }}
          onCancel={() => setShouldShowCreateForm(false)}
        />
      )}
    </div>
  )
}
