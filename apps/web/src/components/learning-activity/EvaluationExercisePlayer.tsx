/**
 * EvaluationExercisePlayer — passage d'un Exercice au sein d'une tentative d'Évaluation : blocs
 * « énoncé »/« image » affichés en lecture seule (réutilise `ExerciseContentItemView`, même route
 * publique `GET /exercises/:exerciseId/images/:itemId`), blocs « question » avec une zone de
 * réponse. **Jamais de révélation de solution ici** — contrairement à `ExercisePlayer` (auto-
 * contrôle), une Évaluation verrouille la solution jusqu'à correction humaine (arbitrage du
 * 2026-09-01, point 6 : « une correction n'a rien à voir avec une solution »).
 *
 * Désactivé (lecture seule, aucune saisie) une fois le temps écoulé ou la tentative close — la
 * page appelante pilote cet état via `isAnswerable`.
 */

import React, { useState } from 'react'
import { ExerciseContentItemView } from '../content-catalog/ExerciseContentItemView'
import { EXERCISE_PART_CATEGORY_LABELS } from '../../utils/exerciseLabels'
import type { PublicExerciseDetail } from '../../types/exercise'
import type { EvaluationAttemptAnswer } from '../../types/evaluationAttempt'

interface EvaluationExercisePlayerProps {
  exercise: PublicExerciseDetail
  displayTitle: string
  answers: EvaluationAttemptAnswer[]
  isAnswerable: boolean
  onAnswerSubmit: (partId: string, content: string) => Promise<void>
}

export function EvaluationExercisePlayer({
  exercise,
  displayTitle,
  answers,
  isAnswerable,
  onAnswerSubmit,
}: EvaluationExercisePlayerProps) {
  const [draftAnswers, setDraftAnswers] = useState<Record<string, string>>({})
  const [busyPartId, setBusyPartId] = useState<string | null>(null)
  const [errorByPartId, setErrorByPartId] = useState<Record<string, string>>({})

  const answerByPartId = new Map(
    answers
      .filter((a) => a.exerciseId === exercise.id && a.content.length > 0)
      .map((a) => [a.partId, a.content[0].content]),
  )

  const getDraft = (partId: string) => draftAnswers[partId] ?? answerByPartId.get(partId) ?? ''

  const handleSubmit = async (partId: string) => {
    setBusyPartId(partId)
    setErrorByPartId((previous) => ({ ...previous, [partId]: '' }))
    try {
      await onAnswerSubmit(partId, getDraft(partId))
    } catch {
      setErrorByPartId((previous) => ({
        ...previous,
        [partId]: 'Impossible d’enregistrer votre réponse.',
      }))
    } finally {
      setBusyPartId(null)
    }
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-800">{displayTitle}</h3>
      {exercise.parts.map((part, index) => (
        <div key={part.id} className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            {EXERCISE_PART_CATEGORY_LABELS[part.category]} {index + 1}
          </p>

          <div className="space-y-2">
            {part.items.map((item) => (
              <ExerciseContentItemView key={item.id} exerciseId={exercise.id} item={item} />
            ))}
          </div>

          {part.category === 'question' && (
            <div className="border-t border-gray-100 pt-3 space-y-2">
              <label htmlFor={`eval-answer-${part.id}`} className="block text-xs text-gray-600">
                Votre réponse (facultative)
              </label>
              <textarea
                id={`eval-answer-${part.id}`}
                value={getDraft(part.id)}
                onChange={(e) =>
                  setDraftAnswers((previous) => ({ ...previous, [part.id]: e.target.value }))
                }
                rows={3}
                disabled={!isAnswerable}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm resize-y disabled:bg-gray-50"
                placeholder="Rédigez votre réponse ici…"
              />

              {errorByPartId[part.id] && (
                <p className="text-xs text-red-600">{errorByPartId[part.id]}</p>
              )}

              {isAnswerable && (
                <button
                  type="button"
                  onClick={() => handleSubmit(part.id)}
                  disabled={busyPartId === part.id}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {busyPartId === part.id ? 'Enregistrement…' : 'Enregistrer ma réponse'}
                </button>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
