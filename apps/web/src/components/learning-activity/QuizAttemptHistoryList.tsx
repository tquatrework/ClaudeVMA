/**
 * QuizAttemptHistoryList — liste des tentatives de Quizz passées, avec leur score.
 * Le titre est déjà résolu par `useQuizAttemptHistory` — jamais un `quizId` affiché.
 */

import React from 'react'
import { useNavigate } from 'react-router-dom'
import { EmptyState } from '../ui/EmptyState'
import { formatLocalDateTime } from '../../utils/dateFormat'
import { formatQuizScore } from '../../utils/quizLabels'
import type { QuizAttemptHistoryEntry } from '../../hooks/learning-activity/useQuizAttemptHistory'

interface QuizAttemptHistoryListProps {
  entries: QuizAttemptHistoryEntry[]
}

export function QuizAttemptHistoryList({ entries }: QuizAttemptHistoryListProps) {
  const navigate = useNavigate()

  if (entries.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center">
        <EmptyState message="Aucun quizz passé pour le moment." />
      </div>
    )
  }

  return (
    <ul className="space-y-3">
      {entries.map((entry) => (
        <li
          key={entry.id}
          className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between gap-4"
        >
          <div className="min-w-0 flex-1">
            <button
              type="button"
              onClick={() => navigate(`/content/quizz/${entry.quizId}`)}
              className="text-sm font-medium text-indigo-700 hover:text-indigo-900 truncate text-left"
            >
              {entry.quizTitle}
            </button>
            <p className="text-xs text-gray-400 mt-0.5">
              {entry.status === 'completed'
                ? `Terminé le ${formatLocalDateTime(entry.completedAt ?? entry.updatedAt)}`
                : 'En cours'}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-sm font-semibold text-gray-900">
              {formatQuizScore(entry.score)} / {formatQuizScore(entry.maxScore)}
            </p>
          </div>
        </li>
      ))}
    </ul>
  )
}
