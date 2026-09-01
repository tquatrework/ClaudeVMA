/**
 * ExercisePartEditor — édition d'un bloc d'exercice (énoncé ou question), au sein de
 * `ExerciseForm`. Un bloc porte une liste ordonnée d'items texte/formule ; un bloc « question »
 * porte en plus une solution obligatoire (même mécanisme de liste d'items).
 *
 * Patron de structure directement inspiré de `QuizQuestionEditor` — une section « énoncé »
 * pouvant devenir « question + solution » selon la catégorie choisie.
 */

import React from 'react'
import { ExerciseItemListEditor, createEditableExerciseItem, type EditableExerciseItem } from './ExerciseItemListEditor'
import { EXERCISE_PART_CATEGORY_LABELS } from '../../utils/exerciseLabels'
import type { ExercisePartCategory } from '../../types/exercise'

export interface EditableExercisePart {
  localId: string
  category: ExercisePartCategory
  items: EditableExerciseItem[]
  /** Utilisé uniquement si `category === 'question'`. */
  solutionItems: EditableExerciseItem[]
}

let partCounter = 0
export function createEditableExercisePart(
  category: ExercisePartCategory = 'statement',
): EditableExercisePart {
  partCounter += 1
  return {
    localId: `part-${partCounter}`,
    category,
    items: [createEditableExerciseItem()],
    solutionItems: category === 'question' ? [createEditableExerciseItem()] : [],
  }
}

interface ExercisePartEditorProps {
  index: number
  part: EditableExercisePart
  isSubmitting: boolean
  onChange: (updated: EditableExercisePart) => void
  onRemove: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  isFirst: boolean
  isLast: boolean
}

export function ExercisePartEditor({
  index,
  part,
  isSubmitting,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}: ExercisePartEditorProps) {
  const handleCategoryChange = (category: ExercisePartCategory) => {
    onChange({
      ...part,
      category,
      solutionItems:
        category === 'question' && part.solutionItems.length === 0
          ? [createEditableExerciseItem()]
          : part.solutionItems,
    })
  }

  return (
    <div className="border border-gray-300 rounded-lg p-4 space-y-3 bg-gray-50">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-gray-800">
          Bloc {index + 1} — {EXERCISE_PART_CATEGORY_LABELS[part.category]}
        </p>
        <div className="flex items-center gap-2">
          <select
            value={part.category}
            onChange={(e) => handleCategoryChange(e.target.value as ExercisePartCategory)}
            disabled={isSubmitting}
            className="border border-gray-300 rounded-md px-2 py-1 text-xs bg-white"
          >
            <option value="statement">Énoncé</option>
            <option value="question">Question</option>
          </select>
          <button
            type="button"
            onClick={onMoveUp}
            disabled={isSubmitting || isFirst}
            className="text-xs text-gray-400 hover:text-gray-700 disabled:opacity-30"
            aria-label={`Déplacer le bloc ${index + 1} vers le haut`}
          >
            ↑
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={isSubmitting || isLast}
            className="text-xs text-gray-400 hover:text-gray-700 disabled:opacity-30"
            aria-label={`Déplacer le bloc ${index + 1} vers le bas`}
          >
            ↓
          </button>
          <button
            type="button"
            onClick={onRemove}
            disabled={isSubmitting}
            className="text-xs text-red-600 hover:text-red-800 disabled:opacity-50"
          >
            Supprimer le bloc
          </button>
        </div>
      </div>

      <ExerciseItemListEditor
        items={part.items}
        onChange={(items) => onChange({ ...part, items })}
        isSubmitting={isSubmitting}
        itemLabelPrefix="Élément"
        fieldIdPrefix="content"
      />

      {part.category === 'question' && (
        <div className="border-t border-gray-300 pt-3 space-y-2">
          <p className="text-xs font-semibold text-gray-700">
            Solution <span className="text-red-500">*</span>
            <span className="ml-1 font-normal text-gray-400">(non visible par l'élève)</span>
          </p>
          <ExerciseItemListEditor
            items={part.solutionItems}
            onChange={(solutionItems) => onChange({ ...part, solutionItems })}
            isSubmitting={isSubmitting}
            itemLabelPrefix="Solution"
            fieldIdPrefix="solution"
          />
        </div>
      )}
    </div>
  )
}
