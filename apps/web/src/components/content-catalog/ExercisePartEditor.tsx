/**
 * ExercisePartEditor — édition d'un bloc d'exercice (énoncé, image ou question), au sein de
 * `ExerciseForm`. Un bloc énoncé/question porte une liste ordonnée d'items texte/formule ; un bloc
 * « question » porte en plus une solution obligatoire (même mécanisme de liste d'items, plus une
 * image optionnelle — voir ci-dessous). Un bloc « image » (catégorie de premier niveau depuis le
 * 2026-09-01, `docs/architecture.md` > « Bloc "image" de premier niveau pour l'Exercice ») porte un
 * fichier choisi localement, encodé en base64 et embarqué dans le payload à la soumission du
 * formulaire — voir `ExerciseImageBlockEditor`/`utils/exercisePayload.ts`
 * (`resolveExerciseImagePayloadItems`).
 *
 * Image de solution (2026-09-01, correctif « en édition, tout doit rester modifiable ») : le
 * serveur accepte déjà `solution.items[].imageData` en écriture (même mécanisme que les blocs,
 * confirmé en HTTP direct contre la production) — seul manquait le bouton front pour la
 * remplacer. Voir `ExerciseSolutionImageEditor`/`utils/exercisePayload.ts`
 * (`resolveExerciseSolutionImagePayloadItems`).
 *
 * Patron de structure directement inspiré de `QuizQuestionEditor` — une section « énoncé »
 * pouvant devenir « question + solution » selon la catégorie choisie.
 */

import React from 'react'
import { ExerciseItemListEditor, createEditableExerciseItem, type EditableExerciseItem } from './ExerciseItemListEditor'
import { ExerciseImageBlockEditor } from './ExerciseImageBlockEditor'
import { ExerciseSolutionImageEditor } from './ExerciseSolutionImageEditor'
import { EXERCISE_PART_CATEGORY_LABELS } from '../../utils/exerciseLabels'
import type { AuthorContentItem, ExercisePartCategory, PublicContentItem } from '../../types/exercise'

export interface EditableExercisePart {
  localId: string
  category: ExercisePartCategory
  /** Utilisé pour `category === 'statement'|'question'` uniquement. */
  items: EditableExerciseItem[]
  /** Utilisé uniquement si `category === 'question'`. */
  solutionItems: EditableExerciseItem[]
  /** Utilisé uniquement si `category === 'image'` — fichier choisi localement, pas encore envoyé. */
  imageFile: File | null
  /**
   * Utilisé uniquement si `category === 'image'`, en édition — contenu déjà enregistré côté
   * serveur, affiché tant qu'aucun nouveau fichier n'a été choisi.
   */
  existingImageItem: PublicContentItem | null
  /**
   * Utilisé uniquement si `category === 'question'` — image (optionnelle) de la solution, fichier
   * choisi localement, pas encore envoyé.
   */
  solutionImageFile: File | null
  /**
   * Utilisé uniquement si `category === 'question'`, en édition — image de solution déjà
   * enregistrée côté serveur, dont le contenu base64 est déjà en mémoire (`GET
   * /exercises/:id/solutions`) — affichée tant qu'aucun nouveau fichier n'a été choisi.
   */
  existingSolutionImageItem: AuthorContentItem | null
}

let partCounter = 0
export function createEditableExercisePart(
  category: ExercisePartCategory = 'statement',
): EditableExercisePart {
  partCounter += 1
  return {
    localId: `part-${partCounter}`,
    category,
    items: category === 'image' ? [] : [createEditableExerciseItem()],
    solutionItems: category === 'question' ? [createEditableExerciseItem()] : [],
    imageFile: null,
    existingImageItem: null,
    solutionImageFile: null,
    existingSolutionImageItem: null,
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
  /** Requis pour afficher une image de bloc déjà enregistrée — absent en mode création. */
  exerciseId?: string
  /** Plafond en vigueur pour un bloc image et pour une image de solution (`GET /exercises/image-constraints`). */
  maxImageInputBytes: number
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
  exerciseId,
  maxImageInputBytes,
}: ExercisePartEditorProps) {
  const handleCategoryChange = (category: ExercisePartCategory) => {
    onChange({
      ...part,
      category,
      items: category === 'image' ? [] : part.items.length > 0 ? part.items : [createEditableExerciseItem()],
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
            <option value="image">Image</option>
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

      {part.category === 'image' ? (
        <ExerciseImageBlockEditor
          exerciseId={exerciseId}
          imageFile={part.imageFile}
          existingImageItem={part.existingImageItem}
          onFileSelected={(imageFile) => onChange({ ...part, imageFile })}
          isSubmitting={isSubmitting}
          maxImageInputBytes={maxImageInputBytes}
        />
      ) : (
        <ExerciseItemListEditor
          items={part.items}
          onChange={(items) => onChange({ ...part, items })}
          isSubmitting={isSubmitting}
          itemLabelPrefix="Élément"
        />
      )}

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
          />
          <div className="pt-2">
            <p className="text-xs font-semibold text-gray-700">Image de la solution (optionnelle)</p>
            <ExerciseSolutionImageEditor
              imageFile={part.solutionImageFile}
              existingImageItem={part.existingSolutionImageItem}
              onFileSelected={(solutionImageFile) => onChange({ ...part, solutionImageFile })}
              isSubmitting={isSubmitting}
              maxImageInputBytes={maxImageInputBytes}
            />
          </div>
        </div>
      )}
    </div>
  )
}
