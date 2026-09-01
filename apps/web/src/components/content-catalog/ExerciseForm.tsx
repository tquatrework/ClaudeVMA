/**
 * ExerciseForm — création et édition d'un Exercice (content-catalog-service).
 *
 * Formulaire majoritairement auto-porté (état local) : une séquence dynamique de blocs, chacun
 * avec sa propre liste d'items, ne se prête pas au découpage "props contrôlées par la page" —
 * même choix assumé que `QuizForm`.
 *
 * Rôles autorisés à créer un Exercice : formateur, animateur_pedagogique, responsable_pedagogique
 * (statut initial `pending_validation` pour un formateur, `validated` — auto-validé — pour AP/RP).
 *
 * ⚠️ **Éditer un exercice déjà enregistré supprime ses images déjà envoyées** (limite documentée
 * côté serveur, `docs/routes.md` § Exercices) : un bandeau prévient l'auteur avant l'enregistrement
 * en mode édition. Les images se rajoutent ensuite via `ExerciseImageManager`, sur `ExerciseEditPage`.
 */

import React, { useState } from 'react'
import { createExercise, updateExercise } from '../../api/exercises'
import { getErrorMessage } from '../../utils/apiError'
import { buildExerciseCreatePayload, type EditableExerciseFormState } from '../../utils/exercisePayload'
import type { CreateExercisePayload, PublicExerciseDetail } from '../../types/exercise'
import { ExercisePartEditor, createEditableExercisePart, type EditableExercisePart } from './ExercisePartEditor'

interface ExerciseFormProps {
  /** `edit` réservé à l'auteur de l'exercice — vérifié côté serveur, pas ici. */
  mode?: 'create' | 'edit'
  /** Requis en mode `edit` — identifiant de l'exercice modifié. */
  exerciseId?: string
  /** État initial pré-rempli — requis en mode `edit`, ignoré en mode `create`. */
  initialState?: EditableExerciseFormState
  onSaved: (exercise: PublicExerciseDetail) => void
  onCancel: () => void
}

export function ExerciseForm({ mode = 'create', exerciseId, initialState, onSaved, onCancel }: ExerciseFormProps) {
  const [title, setTitle] = useState(initialState?.title ?? '')
  const [description, setDescription] = useState(initialState?.description ?? '')
  const [level, setLevel] = useState(initialState?.level ?? '')
  const [difficulty, setDifficulty] = useState(initialState?.difficulty ?? '')
  const [theme, setTheme] = useState(initialState?.theme ?? '')
  const [competenciesInput, setCompetenciesInput] = useState(initialState?.competenciesInput ?? '')
  const [tagsInput, setTagsInput] = useState(initialState?.tagsInput ?? '')
  const [parts, setParts] = useState<EditableExercisePart[]>(
    initialState?.parts ?? [createEditableExercisePart()],
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const updatePart = (localId: string, updated: EditableExercisePart) => {
    setParts((previous) => previous.map((p) => (p.localId === localId ? updated : p)))
  }

  const removePart = (localId: string) => {
    setParts((previous) => previous.filter((p) => p.localId !== localId))
  }

  const movePart = (index: number, direction: -1 | 1) => {
    setParts((previous) => {
      const targetIndex = index + direction
      if (targetIndex < 0 || targetIndex >= previous.length) return previous
      const reordered = [...previous]
      const [moved] = reordered.splice(index, 1)
      reordered.splice(targetIndex, 0, moved)
      return reordered
    })
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setFormError(null)

    let payload: CreateExercisePayload
    try {
      payload = buildExerciseCreatePayload({
        title,
        description,
        level,
        difficulty,
        theme,
        competenciesInput,
        tagsInput,
        parts,
      })
    } catch (validationError: unknown) {
      setFormError(
        validationError instanceof Error ? validationError.message : 'Formulaire invalide.',
      )
      return
    }

    setIsSubmitting(true)
    try {
      const saved =
        mode === 'edit' && exerciseId
          ? await updateExercise(exerciseId, payload)
          : await createExercise(payload)
      onSaved(saved)
    } catch (apiError: unknown) {
      setFormError(
        getErrorMessage(
          apiError,
          mode === 'edit' ? "Impossible de modifier l'exercice." : "Impossible de créer l'exercice.",
        ),
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
      <h2 className="text-base font-semibold text-gray-800">
        {mode === 'edit' ? "Modifier l'exercice" : 'Créer un nouvel exercice'}
      </h2>

      {mode === 'edit' && (
        <div className="bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
          <p className="text-xs text-amber-800">
            Enregistrer ces modifications supprime les images déjà envoyées sur cet exercice. Vous
            pourrez les rajouter juste après, depuis l'écran de gestion des images.
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="exercise-title" className="block text-sm text-gray-700 mb-1">
              Titre <span className="text-xs text-gray-400">(optionnel)</span>
            </label>
            <input
              id="exercise-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isSubmitting}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label htmlFor="exercise-tags" className="block text-sm text-gray-700 mb-1">
              Tags de recherche (séparés par des virgules)
            </label>
            <input
              id="exercise-tags"
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="fractions, géométrie"
              disabled={isSubmitting}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div>
          <label htmlFor="exercise-description" className="block text-sm text-gray-700 mb-1">
            Description
          </label>
          <textarea
            id="exercise-description"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={isSubmitting}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm resize-y"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="exercise-level" className="block text-xs text-gray-600 mb-1">
              Niveau
            </label>
            <input
              id="exercise-level"
              type="text"
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              placeholder="ex : Terminale, 3ème…"
              disabled={isSubmitting}
              className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label htmlFor="exercise-difficulty" className="block text-xs text-gray-600 mb-1">
              Difficulté
            </label>
            <input
              id="exercise-difficulty"
              type="text"
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              placeholder="ex : facile, moyen, difficile"
              disabled={isSubmitting}
              className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label htmlFor="exercise-theme" className="block text-xs text-gray-600 mb-1">
              Thème
            </label>
            <input
              id="exercise-theme"
              type="text"
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              placeholder="ex : géométrie plane"
              disabled={isSubmitting}
              className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
            />
          </div>
        </div>

        <div>
          <label htmlFor="exercise-competencies" className="block text-xs text-gray-600 mb-1">
            Compétences travaillées (séparées par des virgules)
          </label>
          <input
            id="exercise-competencies"
            type="text"
            value={competenciesInput}
            onChange={(e) => setCompetenciesInput(e.target.value)}
            disabled={isSubmitting}
            className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
          />
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-800">Blocs (énoncés et questions)</h3>
          {parts.map((part, index) => (
            <ExercisePartEditor
              key={part.localId}
              index={index}
              part={part}
              isSubmitting={isSubmitting}
              onChange={(updated) => updatePart(part.localId, updated)}
              onRemove={() => removePart(part.localId)}
              onMoveUp={() => movePart(index, -1)}
              onMoveDown={() => movePart(index, 1)}
              isFirst={index === 0}
              isLast={index === parts.length - 1}
            />
          ))}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setParts((previous) => [...previous, createEditableExercisePart('statement')])}
              disabled={isSubmitting}
              className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
            >
              + Ajouter un énoncé
            </button>
            <button
              type="button"
              onClick={() => setParts((previous) => [...previous, createEditableExercisePart('question')])}
              disabled={isSubmitting}
              className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
            >
              + Ajouter une question
            </button>
          </div>
        </div>

        {formError && <p className="text-red-600 text-sm">{formError}</p>}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50 transition-colors"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting
              ? mode === 'edit'
                ? 'Enregistrement…'
                : 'Création…'
              : mode === 'edit'
                ? 'Enregistrer les modifications'
                : "Créer l'exercice"}
          </button>
        </div>
      </form>
    </div>
  )
}
