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
 */

import React, { useState } from 'react'
import { createEvaluation } from '../../api/evaluations'
import { getErrorMessage } from '../../utils/apiError'
import { EvaluationMetadataFields } from './EvaluationMetadataFields'
import {
  EvaluationExercisePicker,
  type EditableEvaluationExerciseItem,
} from './EvaluationExercisePicker'
import type { Evaluation } from '../../types/evaluation'

interface EvaluationFormProps {
  onSaved: (evaluation: Evaluation) => void
  onCancel: () => void
}

export function EvaluationForm({ onSaved, onCancel }: EvaluationFormProps) {
  const [title, setTitle] = useState('')
  const [level, setLevel] = useState('')
  const [difficulty, setDifficulty] = useState('')
  const [theme, setTheme] = useState('')
  const [competenciesInput, setCompetenciesInput] = useState('')
  const [tagsInput, setTagsInput] = useState('')
  const [durationMinutes, setDurationMinutes] = useState('')
  const [blockBackNavigation, setBlockBackNavigation] = useState(false)
  const [exerciseItems, setExerciseItems] = useState<EditableEvaluationExerciseItem[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

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
        exerciseItems: exerciseItems.map((item, index) => ({
          exerciseId: item.exerciseId,
          order: index,
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
