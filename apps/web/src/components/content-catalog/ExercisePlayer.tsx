/**
 * ExercisePlayer — passage d'un Exercice : blocs « énoncé » affichés en lecture seule, blocs
 * « question » avec une zone de réponse facultative et un bouton pour révéler la solution.
 *
 * Auto-contrôle, pas un Quizz noté — aucune notation, aucun score. Le statut « fait »/« en cours »
 * appartient à la tentative (`ExerciseAttempt.status`), affiché par la page appelante.
 */

import React, { useState } from 'react'
import { ExerciseContentItemView } from './ExerciseContentItemView'
import { ExerciseAttemptContentItemView } from '../learning-activity/ExerciseAttemptContentItemView'
import { EXERCISE_PART_CATEGORY_LABELS } from '../../utils/exerciseLabels'
import type { ExerciseAttempt, PublicExerciseDetail } from '../../types/exercise'

interface ExercisePlayerProps {
  exercise: PublicExerciseDetail
  attempt: ExerciseAttempt
  /** `content` texte brut saisi par l'élève — un seul item texte, cas d'usage courant du champ. */
  onAnswerSubmit: (partId: string, content: string) => Promise<void>
  onReveal: (partId: string) => Promise<void>
}

export function ExercisePlayer({ exercise, attempt, onAnswerSubmit, onReveal }: ExercisePlayerProps) {
  const [draftAnswers, setDraftAnswers] = useState<Record<string, string>>({})
  const [busyPartId, setBusyPartId] = useState<string | null>(null)
  const [errorByPartId, setErrorByPartId] = useState<Record<string, string>>({})

  const partStateByPartId = new Map(attempt.parts.map((p) => [p.partId, p]))
  const answerByPartId = new Map(
    attempt.parts
      .filter((p) => p.answerContent && p.answerContent.length > 0)
      .map((p) => [p.partId, p.answerContent![0].content]),
  )

  const getDraft = (partId: string) => draftAnswers[partId] ?? answerByPartId.get(partId) ?? ''

  const handleSubmitAnswer = async (partId: string) => {
    setBusyPartId(`${partId}-answer`)
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

  const handleReveal = async (partId: string) => {
    setBusyPartId(`${partId}-reveal`)
    setErrorByPartId((previous) => ({ ...previous, [partId]: '' }))
    try {
      await onReveal(partId)
    } catch {
      setErrorByPartId((previous) => ({
        ...previous,
        [partId]: 'Impossible de révéler la solution.',
      }))
    } finally {
      setBusyPartId(null)
    }
  }

  return (
    <div className="space-y-4">
      {exercise.parts.map((part, index) => {
        const partState = partStateByPartId.get(part.id)
        const revealedItems = partState?.revealedContent ?? null
        const isRevealed = !!partState?.solutionRevealed && !!revealedItems

        return (
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
                <label htmlFor={`answer-${part.id}`} className="block text-xs text-gray-600">
                  Votre réponse (facultative)
                </label>
                <textarea
                  id={`answer-${part.id}`}
                  value={getDraft(part.id)}
                  onChange={(e) =>
                    setDraftAnswers((previous) => ({ ...previous, [part.id]: e.target.value }))
                  }
                  rows={3}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm resize-y"
                  placeholder="Rédigez votre réponse ici…"
                />

                {errorByPartId[part.id] && (
                  <p className="text-xs text-red-600">{errorByPartId[part.id]}</p>
                )}

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleSubmitAnswer(part.id)}
                    disabled={busyPartId === `${part.id}-answer`}
                    className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                  >
                    {busyPartId === `${part.id}-answer` ? 'Enregistrement…' : 'Enregistrer ma réponse'}
                  </button>
                  {!isRevealed && (
                    <button
                      type="button"
                      onClick={() => handleReveal(part.id)}
                      disabled={busyPartId === `${part.id}-reveal`}
                      className="px-3 py-1.5 text-xs font-medium text-indigo-700 bg-white border border-indigo-300 rounded hover:bg-indigo-50 disabled:opacity-50 transition-colors"
                    >
                      {busyPartId === `${part.id}-reveal` ? 'Révélation…' : 'Révéler la solution'}
                    </button>
                  )}
                </div>

                {isRevealed && revealedItems && (
                  <div className="bg-green-50 border border-green-200 rounded-md p-3 space-y-2">
                    <p className="text-xs font-semibold text-green-800">Solution</p>
                    {revealedItems.map((item) => (
                      <ExerciseAttemptContentItemView key={item.id} attemptId={attempt.id} item={item} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
