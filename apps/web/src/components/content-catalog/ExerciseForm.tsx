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
 * Titre obligatoire, avec valeur par défaut suggérée par le serveur, et champ Description retiré
 * de l'écran (arbitrage du 2026-09-01, `docs/architecture.md` > « Titre des Exercices et des
 * Quizz »). En mode création, le titre est pré-rempli depuis `GET /exercises/default-title` dès
 * l'ouverture du formulaire — l'utilisateur reste libre de le modifier.
 *
 * **Blocs image de premier niveau** (même arbitrage du 2026-09-01, « Bloc "image" de premier
 * niveau pour l'Exercice ») : un bloc image se choisit dès la création, comme un énoncé ou une
 * question — plus besoin d'un premier enregistrement préalable (l'ancien mécanisme
 * `ExerciseImageManager`, post-enregistrement uniquement, est retiré). **Contrat confirmé par
 * `content-catalog-service` (PR #191)** : l'image est encodée en base64 et embarquée directement
 * dans le payload `POST`/`PUT /exercises` — un seul appel, aucune route multipart séparée (voir
 * `utils/exercisePayload.ts`, `resolveExerciseImagePayloadItems`). Le plafond de taille par image
 * est lu via `GET /exercises/image-constraints` (`useExerciseImageConstraints`), jamais codé en dur.
 */

import React, { useEffect, useState } from 'react'
import { createExercise, fetchExerciseDefaultTitle, updateExercise } from '../../api/exercises'
import { getErrorMessage } from '../../utils/apiError'
import {
  buildExerciseCreatePayload,
  ExerciseFormValidationError,
  type EditableExerciseFormState,
} from '../../utils/exercisePayload'
import {
  resolveExerciseImagePayloadItems,
  resolveExerciseSolutionImagePayloadItems,
} from '../../utils/exerciseImageResolution'
import { useExerciseImageConstraints } from '../../hooks/content-catalog/useExerciseImageConstraints'
import { getExerciseRequestBodyTooLargeMessage, isExerciseRequestBodyTooLarge } from '../../utils/exerciseImageConstraints'
import type { ExercisePartCategory, PublicExerciseDetail } from '../../types/exercise'
import { ExercisePartEditor, createEditableExercisePart, type EditableExercisePart } from './ExercisePartEditor'
import { ExercisePartAddButtons } from './ExercisePartAddButtons'
import { ExerciseMetadataFields } from './ExerciseMetadataFields'

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
  const { imageConstraints } = useExerciseImageConstraints()

  // Suggestion de titre par défaut, lue à l'ouverture du formulaire de création uniquement — ne
  // remplace jamais un titre déjà saisi par l'utilisateur (contrôlé au moment de la résolution,
  // pas à l'exécution de l'effet).
  useEffect(() => {
    if (mode !== 'create') return
    let isCancelled = false
    fetchExerciseDefaultTitle()
      .then(({ title: defaultTitle }) => {
        if (isCancelled) return
        setTitle((current) => (current === '' ? defaultTitle : current))
      })
      .catch(() => {
        // Pas de suggestion disponible : l'utilisateur saisit son titre lui-même.
      })
    return () => {
      isCancelled = true
    }
  }, [mode])

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
    setIsSubmitting(true)
    try {
      // Résolu AVANT la construction du payload : un bloc image déjà rempli en édition, sans
      // nouveau fichier choisi, doit être relu pendant que son ancien `itemId` est encore garanti
      // valide (voir `utils/exercisePayload.ts`). Encodage local (FileReader), pas d'appel réseau
      // pour un fichier fraîchement choisi.
      const resolvedImageItems = await resolveExerciseImagePayloadItems(
        parts,
        mode === 'edit' ? exerciseId : undefined,
      )
      const resolvedSolutionImageItems = await resolveExerciseSolutionImagePayloadItems(parts)
      const payload = buildExerciseCreatePayload(
        { title, level, difficulty, theme, competenciesInput, tagsInput, parts },
        resolvedImageItems,
        resolvedSolutionImageItems,
      )

      const serializedPayload = JSON.stringify(payload)
      if (isExerciseRequestBodyTooLarge(serializedPayload, imageConstraints.maxRequestBodyBytes)) {
        throw new ExerciseFormValidationError(
          getExerciseRequestBodyTooLargeMessage(imageConstraints.maxRequestBodyBytes),
        )
      }

      const saved =
        mode === 'edit' && exerciseId
          ? await updateExercise(exerciseId, payload)
          : await createExercise(payload)
      onSaved(saved)
    } catch (caughtError: unknown) {
      if (caughtError instanceof ExerciseFormValidationError) {
        setFormError(caughtError.message)
      } else {
        setFormError(
          getErrorMessage(
            caughtError,
            mode === 'edit' ? "Impossible de modifier l'exercice." : "Impossible de créer l'exercice.",
          ),
        )
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
      <h2 className="text-base font-semibold text-gray-800">
        {mode === 'edit' ? "Modifier l'exercice" : 'Créer un nouvel exercice'}
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="exercise-title" className="block text-sm text-gray-700 mb-1">
              Titre <span className="text-red-500">*</span>
            </label>
            <input
              id="exercise-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isSubmitting}
              required
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

        <ExerciseMetadataFields
          level={level}
          onLevelChange={setLevel}
          difficulty={difficulty}
          onDifficultyChange={setDifficulty}
          theme={theme}
          onThemeChange={setTheme}
          competenciesInput={competenciesInput}
          onCompetenciesInputChange={setCompetenciesInput}
          isSubmitting={isSubmitting}
        />

        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-800">Blocs (énoncés, images et questions)</h3>
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
              exerciseId={exerciseId}
              maxImageInputBytes={imageConstraints.maxImageInputBytes}
            />
          ))}
          <ExercisePartAddButtons
            isSubmitting={isSubmitting}
            onAdd={(category: ExercisePartCategory) =>
              setParts((previous) => [...previous, createEditableExercisePart(category)])
            }
          />
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
