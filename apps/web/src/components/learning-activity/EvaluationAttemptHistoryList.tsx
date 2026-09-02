/**
 * EvaluationAttemptHistoryList — liste des tentatives d'Évaluation passées/en cours. Le titre est
 * déjà résolu par `useEvaluationAttemptHistory` — jamais un `evaluationId` affiché.
 *
 * Deux actions par ligne, conformes à l'arbitrage du 2026-09-01 (« deux actions distinctes, non
 * couplées ») :
 * - une tentative `in_progress` propose « Continuer » (route dédiée `/content/evaluations/attempts/:id`,
 *   qui charge la tentative existante directement — pas de nouvelle tentative créée) ;
 * - une tentative `completed` propose « Demander une correction », qui peut aussi se faire plus
 *   tard depuis ici si elle n'a pas été demandée juste après la clôture. Le serveur refuse
 *   explicitement (400) si une demande active existe déjà — affiché comme message informatif,
 *   pas comme une erreur bloquante (aucune route ne permet de connaître par avance l'état de la
 *   demande depuis l'historique élève).
 */

import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { requestEvaluationCorrection } from '../../api/evaluationAttempts'
import { getErrorMessage } from '../../utils/apiError'
import { EmptyState } from '../ui/EmptyState'
import { StatusBadge } from '../ui/StatusBadge'
import { formatLocalDateTime } from '../../utils/dateFormat'
import {
  EVALUATION_ATTEMPT_STATUS_BADGE_CLASSES,
  EVALUATION_ATTEMPT_STATUS_LABELS,
} from '../../utils/evaluationLabels'
import type { EvaluationAttemptHistoryEntry } from '../../hooks/learning-activity/useEvaluationAttemptHistory'

interface EvaluationAttemptHistoryListProps {
  entries: EvaluationAttemptHistoryEntry[]
}

export function EvaluationAttemptHistoryList({ entries }: EvaluationAttemptHistoryListProps) {
  const navigate = useNavigate()
  const [requestingAttemptId, setRequestingAttemptId] = useState<string | null>(null)
  const [messageByAttemptId, setMessageByAttemptId] = useState<Record<string, string>>({})

  if (entries.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center">
        <EmptyState message="Aucune évaluation passée pour le moment." />
      </div>
    )
  }

  const handleRequestCorrection = async (attemptId: string) => {
    setRequestingAttemptId(attemptId)
    setMessageByAttemptId((previous) => ({ ...previous, [attemptId]: '' }))
    try {
      await requestEvaluationCorrection(attemptId)
      setMessageByAttemptId((previous) => ({
        ...previous,
        [attemptId]: 'Demande de correction envoyée.',
      }))
    } catch (error: unknown) {
      setMessageByAttemptId((previous) => ({
        ...previous,
        [attemptId]: getErrorMessage(error, 'Impossible de demander une correction.'),
      }))
    } finally {
      setRequestingAttemptId(null)
    }
  }

  return (
    <ul className="space-y-3">
      {entries.map((entry) => (
        <li key={entry.id} className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-900 truncate">{entry.evaluationTitle}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                Commencée le {formatLocalDateTime(entry.startedAt)}
                {entry.completedAt ? ` · terminée le ${formatLocalDateTime(entry.completedAt)}` : ''}
              </p>
            </div>
            <StatusBadge
              status={entry.status}
              label={EVALUATION_ATTEMPT_STATUS_LABELS[entry.status]}
              badgeClasses={EVALUATION_ATTEMPT_STATUS_BADGE_CLASSES}
            />
          </div>

          {messageByAttemptId[entry.id] && (
            <p className="text-xs text-gray-600">{messageByAttemptId[entry.id]}</p>
          )}

          <div className="flex gap-2">
            {entry.status === 'in_progress' && (
              <button
                type="button"
                onClick={() => navigate(`/content/evaluations/attempts/${entry.id}`)}
                className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded hover:bg-indigo-700 transition-colors"
              >
                Continuer
              </button>
            )}
            {entry.status === 'completed' && (
              <button
                type="button"
                onClick={() => handleRequestCorrection(entry.id)}
                disabled={requestingAttemptId === entry.id}
                className="px-3 py-1.5 text-xs font-medium text-white bg-amber-600 rounded hover:bg-amber-700 disabled:opacity-50 transition-colors"
              >
                {requestingAttemptId === entry.id ? 'Envoi…' : 'Demander une correction'}
              </button>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}
