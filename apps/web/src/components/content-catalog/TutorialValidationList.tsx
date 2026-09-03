/**
 * TutorialValidationList — file de validation des Tutoriels créés par un professeur (AP/RP).
 *
 * Réutilise le flux de validation générique déjà éprouvé pour Quizz/Exercice/Évaluation
 * (`POST /validations/tutorial/:id/decision`, scoping AP par la relation `animator_of_teacher`) —
 * mêmes composants et mêmes conventions, patron directement recopié de `ExerciseValidationList`.
 */

import React, { useState } from 'react'
import { getErrorMessage } from '../../utils/apiError'
import { TUTORIAL_FORMAT_LABELS } from '../../utils/tutorialLabels'
import type { TutorialSummary, TutorialValidationDecision } from '../../types/tutorial'

interface TutorialValidationListProps {
  tutorials: TutorialSummary[]
  onDecide: (tutorialId: string, decision: TutorialValidationDecision, comment?: string) => Promise<void>
}

export function TutorialValidationList({ tutorials, onDecide }: TutorialValidationListProps) {
  const [rejectingTutorialId, setRejectingTutorialId] = useState<string | null>(null)
  const [comment, setComment] = useState('')
  const [pendingTutorialId, setPendingTutorialId] = useState<string | null>(null)
  const [rowError, setRowError] = useState<string | null>(null)

  if (tutorials.length === 0) {
    return <p className="text-gray-400 text-sm italic py-4">Aucun tutoriel en attente.</p>
  }

  const handleApprove = async (tutorialId: string) => {
    setPendingTutorialId(tutorialId)
    setRowError(null)
    try {
      await onDecide(tutorialId, 'validated')
    } catch (error: unknown) {
      setRowError(getErrorMessage(error, 'Impossible de valider ce tutoriel.'))
    } finally {
      setPendingTutorialId(null)
    }
  }

  const handleReject = async (event: React.FormEvent, tutorialId: string) => {
    event.preventDefault()
    if (!comment.trim()) return
    setPendingTutorialId(tutorialId)
    setRowError(null)
    try {
      await onDecide(tutorialId, 'rejected', comment.trim())
      setRejectingTutorialId(null)
      setComment('')
    } catch (error: unknown) {
      setRowError(getErrorMessage(error, 'Impossible de rejeter ce tutoriel.'))
    } finally {
      setPendingTutorialId(null)
    }
  }

  return (
    <ul className="space-y-3">
      {rowError && <p className="text-red-600 text-sm">{rowError}</p>}
      {tutorials.map((tutorial) => (
        <li key={tutorial.id} className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-900 truncate">{tutorial.title}</p>
              {tutorial.description && (
                <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{tutorial.description}</p>
              )}
              <div className="flex flex-wrap gap-2 mt-1">
                <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                  {TUTORIAL_FORMAT_LABELS[tutorial.format]}
                </span>
                {tutorial.tags.map((tag) => (
                  <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex gap-2 shrink-0">
              <button
                type="button"
                onClick={() => handleApprove(tutorial.id)}
                disabled={pendingTutorialId === tutorial.id}
                className="px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                Valider
              </button>
              {rejectingTutorialId !== tutorial.id && (
                <button
                  type="button"
                  onClick={() => setRejectingTutorialId(tutorial.id)}
                  disabled={pendingTutorialId === tutorial.id}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  Rejeter
                </button>
              )}
            </div>
          </div>

          {rejectingTutorialId === tutorial.id && (
            <form onSubmit={(e) => handleReject(e, tutorial.id)} className="space-y-2">
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
                  disabled={pendingTutorialId === tutorial.id || !comment.trim()}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded hover:bg-red-700 disabled:opacity-50"
                >
                  Confirmer le rejet
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRejectingTutorialId(null)
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
