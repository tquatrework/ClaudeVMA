/**
 * EvaluationForm — création d'une Évaluation (content-catalog-service).
 *
 * **Création uniquement** : aucune route `PUT /evaluations/:id` n'existe côté serveur (confirmé
 * par `.claude/reports/content-catalog-service-evaluations-2026-09-01.md`), contrairement au
 * Quizz/Exercice. Une évaluation `rejected` se resoumet telle quelle (`MyEvaluationsList`), elle
 * ne se modifie pas.
 *
 * Rôles autorisés : formateur, animateur_pedagogique, responsable_pedagogique (statut initial
 * `pending_validation` pour un formateur, `validated` — auto-validé — pour AP/RP).
 *
 * Titre et durée sont obligatoires (`durationSeconds > 0`, arbitrage du 2026-09-01 « Refonte des
 * Evaluations », point 7). Pas de suggestion de titre par défaut côté serveur pour l'Évaluation
 * (aucune route `GET /evaluations/default-title`, à la différence de Quizz/Exercice) — l'auteur
 * saisit son titre lui-même.
 *
 * **Bouton « Nouveau » (2026-09-02)** : à côté de « Rechercher » dans `EvaluationExercisePicker`,
 * pour créer un Exercice sans quitter mentalement la création de l'Évaluation en cours. Le
 * brouillon complet (tous les champs de ce formulaire) est sauvegardé dans `sessionStorage`
 * (`utils/evaluationDraft.ts`) juste avant de naviguer vers `/content/exercises` ; au retour,
 * `EvaluationCatalogPage` relit ce brouillon, y ajoute l'Exercice fraîchement créé, et rouvre ce
 * même formulaire via `initialDraft` — jamais une redirection vers le catalogue d'Exercices, qui
 * reste le comportement normal d'une création d'Exercice déclenchée autrement.
 */

import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createEvaluation } from '../../api/evaluations'
import { getErrorMessage } from '../../utils/apiError'
import { EvaluationMetadataFields } from './EvaluationMetadataFields'
import {
  EvaluationExercisePicker,
  type EditableEvaluationExerciseItem,
} from './EvaluationExercisePicker'
import { saveEvaluationDraftForExerciseCreation } from '../../utils/evaluationDraft'
import type { Evaluation } from '../../types/evaluation'
import type {
  EditableEvaluationFormState,
  EvaluationExercisePickerNavigationState,
} from '../../utils/evaluationDraft'

interface EvaluationFormProps {
  onSaved: (evaluation: Evaluation) => void
  onCancel: () => void
  /** Brouillon à restaurer — utilisé au retour d'une création d'Exercice déclenchée depuis ce
   * formulaire (bouton « Nouveau »). Absent en création normale. */
  initialDraft?: EditableEvaluationFormState
}

export function EvaluationForm({ onSaved, onCancel, initialDraft }: EvaluationFormProps) {
  const navigate = useNavigate()
  const [title, setTitle] = useState(initialDraft?.title ?? '')
  const [level, setLevel] = useState(initialDraft?.level ?? '')
  const [difficulty, setDifficulty] = useState(initialDraft?.difficulty ?? '')
  const [theme, setTheme] = useState(initialDraft?.theme ?? '')
  const [competenciesInput, setCompetenciesInput] = useState(initialDraft?.competenciesInput ?? '')
  const [tagsInput, setTagsInput] = useState(initialDraft?.tagsInput ?? '')
  const [durationMinutes, setDurationMinutes] = useState(initialDraft?.durationMinutes ?? '')
  const [blockBackNavigation, setBlockBackNavigation] = useState(
    initialDraft?.blockBackNavigation ?? false,
  )
  const [exerciseItems, setExerciseItems] = useState<EditableEvaluationExerciseItem[]>(
    initialDraft?.exerciseItems ?? [],
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const buildCurrentDraft = (): EditableEvaluationFormState => ({
    title,
    level,
    difficulty,
    theme,
    competenciesInput,
    tagsInput,
    durationMinutes,
    blockBackNavigation,
    exerciseItems,
  })

  const handleCreateNewExercise = () => {
    saveEvaluationDraftForExerciseCreation(buildCurrentDraft())
    const navigationState: EvaluationExercisePickerNavigationState = {
      returnToEvaluationDraft: true,
      exercisePickerIntent: 'create',
    }
    navigate('/content/exercises', { state: navigationState })
  }

  const handleSearchExistingExercise = (keyword: string) => {
    saveEvaluationDraftForExerciseCreation(buildCurrentDraft())
    const navigationState: EvaluationExercisePickerNavigationState = {
      returnToEvaluationDraft: true,
      exercisePickerIntent: 'search',
      ...(keyword ? { prefillKeyword: keyword } : {}),
    }
    navigate('/content/exercises', { state: navigationState })
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setFormError(null)

    if (!title.trim()) {
      setFormError('Le titre est obligatoire.')
      return
    }
    if (exerciseItems.length === 0) {
      setFormError('Ajoutez au moins un exercice.')
      return
    }
    const durationSeconds = Number(durationMinutes) * 60
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
      setFormError('La durée doit être un nombre de minutes supérieur à zéro.')
      return
    }

    setIsSubmitting(true)
    try {
      const competencies = competenciesInput
        .split(',')
        .map((value) => value.trim())
        .filter((value) => value.length > 0)
      const tags = tagsInput
        .split(',')
        .map((value) => value.trim())
        .filter((value) => value.length > 0)

      const saved = await createEvaluation({
        title: title.trim(),
        // `order` doit être >= 1 (vérifié en HTTP direct le 2026-09-02 :
        // `exerciseItems.0.order must not be less than 1`), contrairement à `order` sur les blocs
        // d'Exercice qui, lui, part de 0 — deux DTO distincts, pas la même convention.
        exerciseItems: exerciseItems.map((item, index) => ({
          exerciseId: item.exerciseId,
          order: index + 1,
          ...(item.titleOverride.trim() ? { titleOverride: item.titleOverride.trim() } : {}),
        })),
        ...(level.trim() ? { level: level.trim() } : {}),
        ...(difficulty.trim() ? { difficulty: difficulty.trim() } : {}),
        ...(theme.trim() ? { theme: theme.trim() } : {}),
        ...(competencies.length > 0 ? { competencies } : {}),
        ...(tags.length > 0 ? { tags } : {}),
        durationSeconds,
        blockBackNavigation,
      })
      onSaved(saved)
    } catch (error: unknown) {
      setFormError(getErrorMessage(error, "Impossible de créer l'évaluation."))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
      <h2 className="text-base font-semibold text-gray-800">Créer une nouvelle évaluation</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="evaluation-title" className="block text-sm text-gray-700 mb-1">
              Titre <span className="text-red-500">*</span>
            </label>
            <input
              id="evaluation-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isSubmitting}
              required
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label htmlFor="evaluation-tags" className="block text-sm text-gray-700 mb-1">
              Tags de recherche (séparés par des virgules)
            </label>
            <input
              id="evaluation-tags"
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="fractions, géométrie"
              disabled={isSubmitting}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <EvaluationMetadataFields
          level={level}
          onLevelChange={setLevel}
          difficulty={difficulty}
          onDifficultyChange={setDifficulty}
          theme={theme}
          onThemeChange={setTheme}
          competenciesInput={competenciesInput}
          onCompetenciesInputChange={setCompetenciesInput}
          durationMinutes={durationMinutes}
          onDurationMinutesChange={setDurationMinutes}
          blockBackNavigation={blockBackNavigation}
          onBlockBackNavigationChange={setBlockBackNavigation}
          isSubmitting={isSubmitting}
        />

        <EvaluationExercisePicker
          selectedItems={exerciseItems}
          onChange={setExerciseItems}
          isSubmitting={isSubmitting}
          onCreateNew={handleCreateNewExercise}
          onSearchExisting={handleSearchExistingExercise}
        />

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
            {isSubmitting ? 'Création…' : "Créer l'évaluation"}
          </button>
        </div>
      </form>
    </div>
  )
}
