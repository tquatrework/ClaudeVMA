/**
 * EvaluationValidationList — file de validation des Évaluations créées par un professeur (AP/RP).
 * Même patron que `ExerciseValidationList`/`QuizValidationList` (flux de validation générique,
 * `POST /validations/evaluation/:id/decision`, scoping AP par relation `animator_of_teacher`).
 */

import React, { useState } from 'react'
import { getErrorMessage } from '../../utils/apiError'
import { getEvaluationDisplayTitle } from '../../utils/evaluationLabels'
import type { Evaluation, EvaluationValidationDecision } from '../../types/evaluation'

interface EvaluationValidationListProps {
  evaluations: Evaluation[]
  onDecide: (
    evaluationId: string,
    decision: EvaluationValidationDecision,
    comment?: string,
  ) => Promise<void>
}

export function EvaluationValidationList({ evaluations, onDecide }: EvaluationValidationListProps) {
  const [rejectingEvaluationId, setRejectingEvaluationId] = useState<string | null>(null)
  const [comment, setComment] = useState('')
  const [pendingEvaluationId, setPendingEvaluationId] = useState<string | null>(null)
  const [rowError, setRowError] = useState<string | null>(null)

  if (evaluations.length === 0) {
    return <p className="text-gray-400 text-sm italic py-4">Aucune évaluation en attente.</p>
  }

  const handleApprove = async (evaluationId: string) => {
    setPendingEvaluationId(evaluationId)
    setRowError(null)
    try {
      await onDecide(evaluationId, 'validated')
    } catch (error: unknown) {
      setRowError(getErrorMessage(error, 'Impossible de valider cette évaluation.'))
    } finally {
      setPendingEvaluationId(null)
    }
  }

  const handleReject = async (event: React.FormEvent, evaluationId: string) => {
    event.preventDefault()
    if (!comment.trim()) return
    setPendingEvaluationId(evaluationId)
    setRowError(null)
    try {
      await onDecide(evaluationId, 'rejected', comment.trim())
      setRejectingEvaluationId(null)
      setComment('')
    } catch (error: unknown) {
      setRowError(getErrorMessage(error, 'Impossible de rejeter cette évaluation.'))
    } finally {
      setPendingEvaluationId(null)
    }
  }

  return (
    <ul className="space-y-3">
      {rowError && <p className="text-red-600 text-sm">{rowError}</p>}
      {evaluations.map((evaluation) => (
        <li key={evaluation.id} className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-900 truncate">
                {getEvaluationDisplayTitle(evaluation.title)}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {evaluation.exerciseItems.length} exercice(s) ·{' '}
                {Math.round(evaluation.durationSeconds / 60)} min
              </p>
              {evaluation.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-1">
                  {evaluation.tags.map((tag) => (
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
                onClick={() => handleApprove(evaluation.id)}
                disabled={pendingEvaluationId === evaluation.id}
                className="px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                Valider
              </button>
              {rejectingEvaluationId !== evaluation.id && (
                <button
                  type="button"
                  onClick={() => setRejectingEvaluationId(evaluation.id)}
                  disabled={pendingEvaluationId === evaluation.id}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  Rejeter
                </button>
              )}
            </div>
          </div>

          {rejectingEvaluationId === evaluation.id && (
            <form onSubmit={(e) => handleReject(e, evaluation.id)} className="space-y-2">
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
                  disabled={pendingEvaluationId === evaluation.id || !comment.trim()}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded hover:bg-red-700 disabled:opacity-50"
                >
                  Confirmer le rejet
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRejectingEvaluationId(null)
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
