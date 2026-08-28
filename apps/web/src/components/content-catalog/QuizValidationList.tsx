/**
 * QuizValidationList — file de validation des Quizz créés par un professeur (AP/RP).
 *
 * Contrairement aux exercices/évaluations/tutoriels (phase 12, sans route de décision
 * documentée), le Quizz dispose d'une vraie route de décision
 * (`POST /validations/quiz/:id/decision`, `ContentType.QUIZ` du flux de validation générique) —
 * ce composant l'appelle réellement, il ne se contente pas d'un retrait optimiste local.
 * Un commentaire est obligatoire en cas de rejet.
 *
 * Bug réel corrigé le 2026-08-28 : ce composant envoyait `'approve'`/`'reject'`, vocabulaire
 * jamais accepté par le serveur (`400`, voir `src/api/quizzes.ts`) — la validation Quizz n'a
 * jamais fonctionné en production avant ce correctif. Vocabulaire réel : `'validated'`/`'rejected'`.
 */

import React, { useState } from 'react'
import { getErrorMessage } from '../../utils/apiError'
import type { QuizSummary, QuizValidationDecision } from '../../types/quiz'

interface QuizValidationListProps {
  quizzes: QuizSummary[]
  onDecide: (quizId: string, decision: QuizValidationDecision, comment?: string) => Promise<void>
}

export function QuizValidationList({ quizzes, onDecide }: QuizValidationListProps) {
  const [rejectingQuizId, setRejectingQuizId] = useState<string | null>(null)
  const [comment, setComment] = useState('')
  const [pendingQuizId, setPendingQuizId] = useState<string | null>(null)
  const [rowError, setRowError] = useState<string | null>(null)

  if (quizzes.length === 0) {
    return <p className="text-gray-400 text-sm italic py-4">Aucun quizz en attente.</p>
  }

  const handleApprove = async (quizId: string) => {
    setPendingQuizId(quizId)
    setRowError(null)
    try {
      await onDecide(quizId, 'validated')
    } catch (error: unknown) {
      setRowError(getErrorMessage(error, 'Impossible de valider ce quizz.'))
    } finally {
      setPendingQuizId(null)
    }
  }

  const handleReject = async (event: React.FormEvent, quizId: string) => {
    event.preventDefault()
    if (!comment.trim()) return
    setPendingQuizId(quizId)
    setRowError(null)
    try {
      await onDecide(quizId, 'rejected', comment.trim())
      setRejectingQuizId(null)
      setComment('')
    } catch (error: unknown) {
      setRowError(getErrorMessage(error, 'Impossible de rejeter ce quizz.'))
    } finally {
      setPendingQuizId(null)
    }
  }

  return (
    <ul className="space-y-3">
      {rowError && <p className="text-red-600 text-sm">{rowError}</p>}
      {quizzes.map((quiz) => (
        <li key={quiz.id} className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-900 truncate">{quiz.title}</p>
              {quiz.description && (
                <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{quiz.description}</p>
              )}
              {quiz.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-1">
                  {quiz.tags.map((tag) => (
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
                onClick={() => handleApprove(quiz.id)}
                disabled={pendingQuizId === quiz.id}
                className="px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                Valider
              </button>
              {rejectingQuizId !== quiz.id && (
                <button
                  type="button"
                  onClick={() => setRejectingQuizId(quiz.id)}
                  disabled={pendingQuizId === quiz.id}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  Rejeter
                </button>
              )}
            </div>
          </div>

          {rejectingQuizId === quiz.id && (
            <form onSubmit={(e) => handleReject(e, quiz.id)} className="space-y-2">
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
                  disabled={pendingQuizId === quiz.id || !comment.trim()}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded hover:bg-red-700 disabled:opacity-50"
                >
                  Confirmer le rejet
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRejectingQuizId(null)
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
