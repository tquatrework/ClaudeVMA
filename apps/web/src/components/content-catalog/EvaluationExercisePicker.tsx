/**
 * EvaluationExercisePicker — sélection ordonnée d'Exercices déjà existants pour composer une
 * Évaluation (`exerciseItems`).
 *
 * **Bug réel corrigé le 2026-09-02** : la recherche vivait ici même, dans un `<form>` propre à ce
 * composant — invalide en HTML puisqu'il était rendu à l'intérieur du `<form>` d'`EvaluationForm`
 * (les formulaires ne peuvent pas être imbriqués). Le navigateur ignore purement et simplement le
 * `<form>` interne et rattache son bouton « submit » au formulaire ENGLOBANT : cliquer
 * « Rechercher » soumettait donc silencieusement la création d'Évaluation elle-même (bloquée par
 * la validation HTML5 si le titre était vide), jamais `handleSearch`. C'est ce qui rendait le
 * bouton « ne fait rien » de perceptible.
 *
 * Corrigé en retirant la recherche locale : « Rechercher » (comme « Nouveau ») navigue désormais
 * vers le vrai catalogue d'Exercices (`ExerciseCatalogPage`), pré-filtré par le mot-clé tapé ici —
 * choisir un Exercice dans cette liste ramène sur cette création d'Évaluation avec l'Exercice
 * ajouté. Aucun `<form>` n'est plus rendu par ce composant : uniquement des `<button type="button">`
 * et des champs texte, tous à l'abri d'une soumission implicite du formulaire englobant.
 */

import React, { useState } from 'react'

export interface EditableEvaluationExerciseItem {
  exerciseId: string
  title: string
  titleOverride: string
}

interface EvaluationExercisePickerProps {
  selectedItems: EditableEvaluationExerciseItem[]
  onChange: (items: EditableEvaluationExerciseItem[]) => void
  isSubmitting: boolean
  /** Bouton « Nouveau » (2026-09-02) : quitte la page pour créer un Exercice, puis revient sur
   * cette création d'Évaluation avec le nouvel Exercice ajouté. */
  onCreateNew: () => void
  /** Bouton « Rechercher » (2026-09-02) : quitte la page pour choisir un Exercice existant dans le
   * vrai catalogue, pré-filtré par le mot-clé tapé ici, puis revient de la même façon. */
  onSearchExisting: (keyword: string) => void
}

export function EvaluationExercisePicker({
  selectedItems,
  onChange,
  isSubmitting,
  onCreateNew,
  onSearchExisting,
}: EvaluationExercisePickerProps) {
  const [keyword, setKeyword] = useState('')

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

      <div className="flex gap-2">
        <input
          type="text"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={(e) => {
            // Ce champ n'est volontairement dans aucun `<form>` (voir l'en-tête du fichier) —
            // une touche Entrée ne doit toujours pas soumettre le formulaire englobant.
            if (e.key === 'Enter') e.preventDefault()
          }}
          placeholder="Rechercher un exercice par titre…"
          disabled={isSubmitting}
          className="flex-1 border border-gray-300 rounded-md px-3 py-1.5 text-sm"
        />
        <button
          type="button"
          onClick={() => onSearchExisting(keyword.trim())}
          disabled={isSubmitting}
          className="px-3 py-1.5 text-sm font-medium text-white bg-gray-700 rounded-md hover:bg-gray-800 disabled:opacity-50 transition-colors shrink-0"
        >
          Rechercher
        </button>
        <button
          type="button"
          onClick={onCreateNew}
          disabled={isSubmitting}
          className="px-3 py-1.5 text-sm font-medium text-indigo-700 bg-indigo-50 rounded-md hover:bg-indigo-100 disabled:opacity-50 transition-colors shrink-0"
        >
          Nouveau
        </button>
      </div>

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
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.preventDefault()
                }}
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
