/**
 * ExercisePartAddButtons — les trois boutons « + Ajouter un énoncé / une image / une question » de
 * `ExerciseForm`, extraits pour garder ce dernier lisible (règle du projet, seuil de 300 lignes).
 */

import React from 'react'
import type { ExercisePartCategory } from '../../types/exercise'

interface ExercisePartAddButtonsProps {
  isSubmitting: boolean
  onAdd: (category: ExercisePartCategory) => void
}

export function ExercisePartAddButtons({ isSubmitting, onAdd }: ExercisePartAddButtonsProps) {
  return (
    <div className="flex gap-3">
      <button
        type="button"
        onClick={() => onAdd('statement')}
        disabled={isSubmitting}
        className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
      >
        + Ajouter un énoncé
      </button>
      <button
        type="button"
        onClick={() => onAdd('image')}
        disabled={isSubmitting}
        className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
      >
        + Ajouter une image
      </button>
      <button
        type="button"
        onClick={() => onAdd('question')}
        disabled={isSubmitting}
        className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
      >
        + Ajouter une question
      </button>
    </div>
  )
}
