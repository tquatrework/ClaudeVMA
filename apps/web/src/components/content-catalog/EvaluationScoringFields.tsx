/**
 * EvaluationScoringFields — barème informatif d'une Évaluation (arbitrage du 2026-09-02,
 * `docs/architecture.md` > « Barème informatif pour l'Évaluation »).
 *
 * Le créateur choisit une granularité unique — par Exercice, ou par question (blocs de
 * catégorie `question` de chaque Exercice, `GET /exercises/:id`) — jamais les deux. Purement
 * informatif : jamais transmis à `learning-activity-service` pour un calcul, uniquement affiché
 * à l'élève avant/pendant le passage (`EvaluationExercisePlayer`).
 *
 * Nécessite qu'au moins un exercice soit déjà sélectionné (`EvaluationExercisePicker`) — pas de
 * saisie de barème pour une évaluation vide.
 */

import React from 'react'
import { ExerciseContentItemView } from './ExerciseContentItemView'
import { questionScoringKey } from '../../utils/evaluationScoring'
import type { EditableEvaluationExerciseItem } from './EvaluationExercisePicker'
import type { EvaluationScoringMode } from '../../types/evaluation'
import type { PublicExercisePart } from '../../types/exercise'

const SCORING_MODE_OPTIONS: { value: 'none' | EvaluationScoringMode; label: string }[] = [
  { value: 'none', label: 'Aucun barème' },
  { value: 'per_exercise', label: 'Par exercice' },
  { value: 'per_question', label: 'Par question' },
]

interface EvaluationScoringFieldsProps {
  exerciseItems: EditableEvaluationExerciseItem[]
  mode: 'none' | EvaluationScoringMode
  onModeChange: (mode: 'none' | EvaluationScoringMode) => void
  pointsByExerciseId: Record<string, string>
  onPointsByExerciseIdChange: (next: Record<string, string>) => void
  pointsByPartKey: Record<string, string>
  onPointsByPartKeyChange: (next: Record<string, string>) => void
  questionPartsByExerciseId: Record<string, PublicExercisePart[]>
  isLoadingQuestionParts: boolean
  questionPartsError: string | null
  isSubmitting: boolean
}

export function EvaluationScoringFields({
  exerciseItems,
  mode,
  onModeChange,
  pointsByExerciseId,
  onPointsByExerciseIdChange,
  pointsByPartKey,
  onPointsByPartKeyChange,
  questionPartsByExerciseId,
  isLoadingQuestionParts,
  questionPartsError,
  isSubmitting,
}: EvaluationScoringFieldsProps) {
  if (exerciseItems.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
        <p className="text-xs text-gray-500 italic">
          Sélectionnez d'abord des exercices pour configurer un barème informatif (facultatif).
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3 bg-gray-50 border border-gray-200 rounded-lg p-3">
      <div>
        <h3 className="text-sm font-semibold text-gray-800">Barème informatif (facultatif)</h3>
        <p className="text-xs text-gray-500 mt-0.5">
          Affiché à l'élève pendant le passage, à titre indicatif — la correction reste
          entièrement manuelle, ce barème n'est jamais utilisé pour calculer une note.
        </p>
      </div>

      <div className="flex flex-wrap gap-4">
        {SCORING_MODE_OPTIONS.map((option) => (
          <label key={option.value} className="flex items-center gap-1.5 text-sm text-gray-700">
            <input
              type="radio"
              name="evaluation-scoring-mode"
              checked={mode === option.value}
              onChange={() => onModeChange(option.value)}
              disabled={isSubmitting}
            />
            {option.label}
          </label>
        ))}
      </div>

      {mode === 'per_exercise' && (
        <ul className="space-y-2">
          {exerciseItems.map((item) => (
            <li key={item.exerciseId} className="flex items-center gap-3">
              <span className="text-sm text-gray-700 flex-1 truncate">{item.title}</span>
              <input
                type="number"
                min={0}
                step="0.5"
                value={pointsByExerciseId[item.exerciseId] ?? ''}
                onChange={(e) =>
                  onPointsByExerciseIdChange({
                    ...pointsByExerciseId,
                    [item.exerciseId]: e.target.value,
                  })
                }
                disabled={isSubmitting}
                placeholder="points"
                aria-label={`Points pour ${item.title}`}
                className="w-24 border border-gray-300 rounded-md px-2 py-1 text-sm"
              />
            </li>
          ))}
        </ul>
      )}

      {mode === 'per_question' && (
        <div className="space-y-4">
          {isLoadingQuestionParts && (
            <p className="text-xs text-gray-400">Chargement des questions…</p>
          )}
          {questionPartsError && <p className="text-xs text-red-600">{questionPartsError}</p>}
          {!isLoadingQuestionParts &&
            !questionPartsError &&
            exerciseItems.map((item) => {
              const questionParts = questionPartsByExerciseId[item.exerciseId] ?? []
              return (
                <div key={item.exerciseId} className="space-y-2">
                  <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                    {item.title}
                  </p>
                  {questionParts.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">
                      Cet exercice ne comporte aucun bloc question.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {questionParts.map((part, index) => {
                        const key = questionScoringKey(item.exerciseId, part.id)
                        return (
                          <li
                            key={part.id}
                            className="flex items-start gap-3 bg-white border border-gray-200 rounded-md px-3 py-2"
                          >
                            <div className="flex-1 min-w-0 space-y-1">
                              <p className="text-xs text-gray-400">Question {index + 1}</p>
                              {part.items.length > 0 ? (
                                part.items.map((contentItem) => (
                                  <ExerciseContentItemView
                                    key={contentItem.id}
                                    exerciseId={item.exerciseId}
                                    item={contentItem}
                                  />
                                ))
                              ) : (
                                <p className="text-xs text-gray-400 italic">(question vide)</p>
                              )}
                            </div>
                            <input
                              type="number"
                              min={0}
                              step="0.5"
                              value={pointsByPartKey[key] ?? ''}
                              onChange={(e) =>
                                onPointsByPartKeyChange({
                                  ...pointsByPartKey,
                                  [key]: e.target.value,
                                })
                              }
                              disabled={isSubmitting}
                              placeholder="points"
                              aria-label={`Points pour la question ${index + 1} de ${item.title}`}
                              className="w-24 shrink-0 border border-gray-300 rounded-md px-2 py-1 text-sm"
                            />
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              )
            })}
        </div>
      )}
    </div>
  )
}
