/**
 * EvaluationExercisePicker — sélection ordonnée d'Exercices déjà existants pour composer une
 * Évaluation (`exerciseItems`). Recherche par mot-clé parmi les Exercices `validated` (une
 * Évaluation ne référence que des Exercices publiés — restriction posée côté front, non exigée
 * littéralement par `docs/architecture.md`, mais cohérente avec « les élèves ne voient que les
 * évaluations validated » : un exercice non publié dans une évaluation validée serait un angle
 * mort de visibilité).
 */

import React, { useState } from 'react'
import { searchExercises } from '../../api/exercises'
import { getErrorMessage } from '../../utils/apiError'
import { getExerciseDisplayTitle } from '../../utils/exerciseLabels'
import type { ExerciseSummary } from '../../types/exercise'

export interface EditableEvaluationExerciseItem {
  exerciseId: string
  title: string
  titleOverride: string
}

interface EvaluationExercisePickerProps {
  selectedItems: EditableEvaluationExerciseItem[]
  onChange: (items: EditableEvaluationExerciseItem[]) => void
  isSubmitting: boolean
}

export function EvaluationExercisePicker({
  selectedItems,
  onChange,
  isSubmitting,
}: EvaluationExercisePickerProps) {
  const [keyword, setKeyword] = useState('')
  const [results, setResults] = useState<ExerciseSummary[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)

  const selectedIds = new Set(selectedItems.map((item) => item.exerciseId))

  const handleSearch = async (event: React.FormEvent) => {
    event.preventDefault()
    setIsSearching(true)
    setSearchError(null)
    try {
      const result = await searchExercises({ keyword: keyword.trim() || undefined, limit: 20 })
      setResults(result.items.filter((exercise) => exercise.status === 'validated'))
    } catch (error: unknown) {
      setSearchError(getErrorMessage(error, 'Impossible de rechercher des exercices.'))
    } finally {
      setIsSearching(false)
    }
  }

  const addExercise = (exercise: ExerciseSummary) => {
    if (selectedIds.has(exercise.id)) return
    onChange([
      ...selectedItems,
      { exerciseId: exercise.id, title: getExerciseDisplayTitle(exercise.title), titleOverride: '' },
    ])
  }

  const removeExercise = (exerciseId: string) => {
    onChange(selectedItems.filter((item) => item.exerciseId !== exerciseId))
  }

  const moveExercise = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= selectedItems.length) return
    const reordered = [...selectedItems]
    const [moved] = reordered.splice(index, 1)
    reordered.splice(targetIndex, 0, moved)
    onChange(reordered)
  }

  const updateTitleOverride = (exerciseId: string, titleOverride: string) => {
    onChange(
      selectedItems.map((item) => (item.exerciseId === exerciseId ? { ...item, titleOverride } : item)),
    )
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-800">
        Exercices de l'évaluation <span className="text-red-500">*</span>
      </h3>

      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="text"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="Rechercher un exercice par titre…"
          disabled={isSubmitting}
          className="flex-1 border border-gray-300 rounded-md px-3 py-1.5 text-sm"
        />
        <button
          type="submit"
          disabled={isSearching || isSubmitting}
          className="px-3 py-1.5 text-sm font-medium text-white bg-gray-700 rounded-md hover:bg-gray-800 disabled:opacity-50 transition-colors"
        >
          {isSearching ? 'Recherche…' : 'Rechercher'}
        </button>
      </form>

      {searchError && <p className="text-xs text-red-600">{searchError}</p>}

      {results.length > 0 && (
        <ul className="border border-gray-200 rounded-md divide-y divide-gray-100 max-h-56 overflow-y-auto">
          {results.map((exercise) => (
            <li key={exercise.id} className="flex items-center justify-between gap-3 px-3 py-2">
              <span className="text-sm text-gray-700 truncate">
                {getExerciseDisplayTitle(exercise.title)}
              </span>
              <button
                type="button"
                onClick={() => addExercise(exercise)}
                disabled={selectedIds.has(exercise.id) || isSubmitting}
                className="px-2.5 py-1 text-xs font-medium text-indigo-700 bg-indigo-50 rounded hover:bg-indigo-100 disabled:opacity-40 transition-colors shrink-0"
              >
                {selectedIds.has(exercise.id) ? 'Ajouté' : 'Ajouter'}
              </button>
            </li>
          ))}
        </ul>
      )}

      {selectedItems.length === 0 ? (
        <p className="text-xs text-gray-400 italic">Aucun exercice sélectionné pour l'instant.</p>
      ) : (
        <ol className="space-y-2">
          {selectedItems.map((item, index) => (
            <li
              key={item.exerciseId}
              className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-md px-3 py-2"
            >
              <span className="text-xs text-gray-400 shrink-0">{index + 1}.</span>
              <span className="text-sm text-gray-800 flex-1 truncate">{item.title}</span>
              <input
                type="text"
                value={item.titleOverride}
                onChange={(e) => updateTitleOverride(item.exerciseId, e.target.value)}
                placeholder="Titre affiché (facultatif)"
                disabled={isSubmitting}
                className="w-40 border border-gray-300 rounded px-2 py-1 text-xs"
              />
              <button
                type="button"
                onClick={() => moveExercise(index, -1)}
                disabled={index === 0 || isSubmitting}
                className="text-xs text-gray-500 hover:text-gray-800 disabled:opacity-30 px-1"
                aria-label="Monter"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => moveExercise(index, 1)}
                disabled={index === selectedItems.length - 1 || isSubmitting}
                className="text-xs text-gray-500 hover:text-gray-800 disabled:opacity-30 px-1"
                aria-label="Descendre"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => removeExercise(item.exerciseId)}
                disabled={isSubmitting}
                className="text-xs text-red-600 hover:text-red-800 px-1"
                aria-label="Retirer"
              >
                ✕
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
