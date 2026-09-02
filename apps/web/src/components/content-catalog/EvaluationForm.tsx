/**
 * EvaluationForm — création et édition d'une Évaluation (content-catalog-service).
 *
 * **Édition depuis le 2026-09-02** : `PUT /evaluations/:id` existe désormais côté serveur (PR
 * #203, livrée avec le barème informatif) — `mode="edit"` réutilise ce même formulaire, sur le
 * modèle déjà suivi par `QuizForm`/`ExerciseForm`. Un formateur qui édite une évaluation déjà
 * `validated` la fait repasser en `pending_validation` (comportement du serveur, réaffiché tel
 * quel). Une évaluation `rejected` peut aussi se resoumettre telle quelle
 * (`requestEvaluationValidation`, `MyEvaluationsList`), sans passer par l'édition.
 *
 * Rôles autorisés : formateur, animateur_pedagogique, responsable_pedagogique (statut initial
 * `pending_validation` pour un formateur, `validated` — auto-validé — pour AP/RP).
 *
 * Titre et durée sont obligatoires (`durationSeconds > 0`, arbitrage du 2026-09-01 « Refonte des
 * Evaluations », point 7). Pas de suggestion de titre par défaut côté serveur pour l'Évaluation
 * (aucune route `GET /evaluations/default-title`, à la différence de Quizz/Exercice) — l'auteur
 * saisit son titre lui-même.
 *
 * **Barème informatif (2026-09-02)** : granularité par Exercice ou par question, purement
 * informatif — voir `EvaluationScoringFields` et `utils/evaluationScoring.ts`.
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
import { createEvaluation, updateEvaluation } from '../../api/evaluations'
import { getErrorMessage } from '../../utils/apiError'
import { EvaluationMetadataFields } from './EvaluationMetadataFields'
import {
  EvaluationExercisePicker,
  type EditableEvaluationExerciseItem,
} from './EvaluationExercisePicker'
import { EvaluationScoringFields } from './EvaluationScoringFields'
import { useExerciseQuestionParts } from '../../hooks/content-catalog/useExerciseQuestionParts'
import { createEmptyScoringState } from '../../utils/evaluationScoring'
import { buildEvaluationPayload } from '../../utils/evaluationPayload'
import { saveEvaluationDraftForExerciseCreation } from '../../utils/evaluationDraft'
import type { Evaluation, EvaluationScoringMode } from '../../types/evaluation'
import type {
  EditableEvaluationFormState,
  EvaluationExercisePickerNavigationState,
} from '../../utils/evaluationDraft'

interface EvaluationFormProps {
  /** `edit` réservé à l'auteur de l'évaluation — vérifié côté serveur, pas ici. */
  mode?: 'create' | 'edit'
  /** Requis en mode `edit` — identifiant de l'évaluation modifiée. */
  evaluationId?: string
  onSaved: (evaluation: Evaluation) => void
  onCancel: () => void
  /** Brouillon à restaurer — utilisé au retour d'une création d'Exercice déclenchée depuis ce
   * formulaire (bouton « Nouveau »), ou état initial en mode `edit`. */
  initialDraft?: EditableEvaluationFormState
}

export function EvaluationForm({
  mode = 'create',
  evaluationId,
  onSaved,
  onCancel,
  initialDraft,
}: EvaluationFormProps) {
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
  const scoringState = initialDraft?.scoring ?? createEmptyScoringState()
  const [scoringMode, setScoringMode] = useState<'none' | EvaluationScoringMode>(scoringState.mode)
  const [pointsByExerciseId, setPointsByExerciseId] = useState<Record<string, string>>(
    scoringState.pointsByExerciseId,
  )
  const [pointsByPartKey, setPointsByPartKey] = useState<Record<string, string>>(
    scoringState.pointsByPartKey,
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const {
    partsByExerciseId: questionPartsByExerciseId,
    isLoading: isLoadingQuestionParts,
    error: questionPartsError,
  } = useExerciseQuestionParts(
    exerciseItems.map((item) => item.exerciseId),
    scoringMode === 'per_question',
  )

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
    scoring: { mode: scoringMode, pointsByExerciseId, pointsByPartKey },
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

    let payload
    try {
      payload = buildEvaluationPayload(
        { title, level, difficulty, theme, competenciesInput, tagsInput, durationMinutes, blockBackNavigation },
        exerciseItems,
        { mode: scoringMode, pointsByExerciseId, pointsByPartKey },
        questionPartsByExerciseId,
      )
    } catch (validationError: unknown) {
      setFormError(
        validationError instanceof Error ? validationError.message : 'Formulaire invalide.',
      )
      return
    }

    setIsSubmitting(true)
    try {
      const saved =
        mode === 'edit' && evaluationId
          ? await updateEvaluation(evaluationId, payload)
          : await createEvaluation(payload)
      onSaved(saved)
    } catch (error: unknown) {
      setFormError(
        getErrorMessage(
          error,
          mode === 'edit' ? "Impossible de modifier l'évaluation." : "Impossible de créer l'évaluation.",
        ),
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
      <h2 className="text-base font-semibold text-gray-800">
        {mode === 'edit' ? "Modifier l'évaluation" : 'Créer une nouvelle évaluation'}
      </h2>

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

        <EvaluationScoringFields
          exerciseItems={exerciseItems}
          mode={scoringMode}
          onModeChange={setScoringMode}
          pointsByExerciseId={pointsByExerciseId}
          onPointsByExerciseIdChange={setPointsByExerciseId}
          pointsByPartKey={pointsByPartKey}
          onPointsByPartKeyChange={setPointsByPartKey}
          questionPartsByExerciseId={questionPartsByExerciseId}
          isLoadingQuestionParts={isLoadingQuestionParts}
          questionPartsError={questionPartsError}
          isSubmitting={isSubmitting}
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
            {isSubmitting
              ? mode === 'edit'
                ? 'Enregistrement…'
                : 'Création…'
              : mode === 'edit'
                ? 'Enregistrer les modifications'
                : "Créer l'évaluation"}
          </button>
        </div>
      </form>
    </div>
  )
}
