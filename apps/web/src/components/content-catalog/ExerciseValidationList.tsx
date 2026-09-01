/**
 * ExerciseValidationList — file de validation des Exercices créés par un professeur (AP/RP).
 *
 * Réutilise le flux de validation générique déjà éprouvé pour le Quizz
 * (`POST /validations/exercise/:id/decision`, extension de `ValidationsService` à
 * `ContentType.EXERCISE`, scoping AP par la relation `animator_of_teacher`) — mêmes composants et
 * mêmes conventions, patron directement recopié de `QuizValidationList`.
 */

import React, { useState } from 'react'
import { getErrorMessage } from '../../utils/apiError'
import { getExerciseDisplayTitle } from '../../utils/exerciseLabels'
import type { ExerciseSummary, ExerciseValidationDecision } from '../../types/exercise'

interface ExerciseValidationListProps {
  exercises: ExerciseSummary[]
  onDecide: (exerciseId: string, decision: ExerciseValidationDecision, comment?: string) => Promise<void>
}

export function ExerciseValidationList({ exercises, onDecide }: ExerciseValidationListProps) {
  const [rejectingExerciseId, setRejectingExerciseId] = useState<string | null>(null)
  const [comment, setComment] = useState('')
  const [pendingExerciseId, setPendingExerciseId] = useState<string | null>(null)
  const [rowError, setRowError] = useState<string | null>(null)

  if (exercises.length === 0) {
    return <p className="text-gray-400 text-sm italic py-4">Aucun exercice en attente.</p>
  }

  const handleApprove = async (exerciseId: string) => {
    setPendingExerciseId(exerciseId)
    setRowError(null)
    try {
      await onDecide(exerciseId, 'validated')
    } catch (error: unknown) {
      setRowError(getErrorMessage(error, 'Impossible de valider cet exercice.'))
    } finally {
      setPendingExerciseId(null)
    }
  }

  const handleReject = async (event: React.FormEvent, exerciseId: string) => {
    event.preventDefault()
    if (!comment.trim()) return
    setPendingExerciseId(exerciseId)
    setRowError(null)
    try {
      await onDecide(exerciseId, 'rejected', comment.trim())
      setRejectingExerciseId(null)
      setComment('')
    } catch (error: unknown) {
      setRowError(getErrorMessage(error, 'Impossible de rejeter cet exercice.'))
    } finally {
      setPendingExerciseId(null)
    }
  }

  return (
    <ul className="space-y-3">
      {rowError && <p className="text-red-600 text-sm">{rowError}</p>}
      {exercises.map((exercise) => (
        <li key={exercise.id} className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-900 truncate">
                {getExerciseDisplayTitle(exercise.title)}
              </p>
              {exercise.description && (
                <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{exercise.description}</p>
              )}
              {exercise.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-1">
                  {exercise.tags.map((tag) => (
                    <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-2 shrink-0">
              <button
                type="button"
                onClick={() => handleApprove(exercise.id)}
                disabled={pendingExerciseId === exercise.id}
                className="px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                Valider
              </button>
              {rejectingExerciseId !== exercise.id && (
                <button
                  type="button"
                  onClick={() => setRejectingExerciseId(exercise.id)}
                  disabled={pendingExerciseId === exercise.id}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  Rejeter
                </button>
              )}
            </div>
          </div>

          {rejectingExerciseId === exercise.id && (
            <form onSubmit={(e) => handleReject(e, exercise.id)} className="space-y-2">
              <label className="block text-xs text-gray-600">
                Motif du rejet <span className="text-red-500">*</span>
              </label>
              <textarea
                required
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={2}
                placeholder="Expliquez la raison du rejet…"
                className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm resize-none"
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={pendingExerciseId === exercise.id || !comment.trim()}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded hover:bg-red-700 disabled:opacity-50"
                >
                  Confirmer le rejet
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRejectingExerciseId(null)
                    setComment('')
                  }}
                  className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
                >
                  Annuler
                </button>
              </div>
            </form>
          )}
        </li>
      ))}
    </ul>
  )
}
