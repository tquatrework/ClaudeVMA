/**
 * ExerciseAttemptHistoryList — liste des tentatives d'Exercice passées/en cours, sans score
 * (auto-contrôle). Le titre est déjà résolu par `useExerciseAttemptHistory` — jamais un
 * `exerciseId` affiché. Même patron que `QuizAttemptHistoryList`.
 */

import React from 'react'
import { useNavigate } from 'react-router-dom'
import { EmptyState } from '../ui/EmptyState'
import { StatusBadge } from '../ui/StatusBadge'
import { formatLocalDateTime } from '../../utils/dateFormat'
import {
  EXERCISE_ATTEMPT_STATUS_BADGE_CLASSES,
  EXERCISE_ATTEMPT_STATUS_LABELS,
} from '../../utils/exerciseLabels'
import type { ExerciseAttemptHistoryEntry } from '../../hooks/learning-activity/useExerciseAttemptHistory'

interface ExerciseAttemptHistoryListProps {
  entries: ExerciseAttemptHistoryEntry[]
}

export function ExerciseAttemptHistoryList({ entries }: ExerciseAttemptHistoryListProps) {
  const navigate = useNavigate()

  if (entries.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center">
        <EmptyState message="Aucun exercice passé pour le moment." />
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
              onClick={() => navigate(`/content/exercises/${entry.exerciseId}`)}
              className="text-sm font-medium text-indigo-700 hover:text-indigo-900 truncate text-left"
            >
              {entry.exerciseTitle}
            </button>
            <p className="text-xs text-gray-400 mt-0.5">
              Commencé le {formatLocalDateTime(entry.startedAt)}
            </p>
          </div>
          <StatusBadge
            status={entry.status}
            label={EXERCISE_ATTEMPT_STATUS_LABELS[entry.status]}
            badgeClasses={EXERCISE_ATTEMPT_STATUS_BADGE_CLASSES}
          />
        </li>
      ))}
    </ul>
  )
}
