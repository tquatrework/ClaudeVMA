/**
 * MyEvaluationsList — liste des Évaluations créées par l'utilisateur courant, tous statuts
 * confondus. Même patron que `MyExercisesList`/`MyQuizzesList`, avec une différence assumée :
 * **pas de bouton « Modifier »** — aucune route `PUT /evaluations/:id` n'existe côté serveur
 * (confirmé par `.claude/reports/content-catalog-service-evaluations-2026-09-01.md`). Une
 * évaluation `rejected` se resoumet telle quelle, elle ne se réécrit pas depuis cet écran.
 */

import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { requestEvaluationValidation } from '../../api/evaluations'
import { getErrorMessage } from '../../utils/apiError'
import { EmptyState } from '../ui/EmptyState'
import { StatusBadge } from '../ui/StatusBadge'
import {
  EVALUATION_STATUS_BADGE_CLASSES,
  EVALUATION_STATUS_LABELS,
  getEvaluationDisplayTitle,
} from '../../utils/evaluationLabels'
import type { MyEvaluationListItem } from '../../hooks/content-catalog/useMyEvaluations'

interface MyEvaluationsListProps {
  evaluations: MyEvaluationListItem[]
  onResubmitted: (evaluationId: string) => void
}

export function MyEvaluationsList({ evaluations, onResubmitted }: MyEvaluationsListProps) {
  const navigate = useNavigate()
  const [resubmittingEvaluationId, setResubmittingEvaluationId] = useState<string | null>(null)
  const [rowErrorByEvaluationId, setRowErrorByEvaluationId] = useState<Record<string, string>>({})

  if (evaluations.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center">
        <EmptyState message="Vous n'avez encore créé aucune évaluation." />
      </div>
    )
  }

  const handleResubmit = async (evaluationId: string) => {
    setResubmittingEvaluationId(evaluationId)
    setRowErrorByEvaluationId((previous) => ({ ...previous, [evaluationId]: '' }))
    try {
      await requestEvaluationValidation(evaluationId)
      onResubmitted(evaluationId)
    } catch (error: unknown) {
      setRowErrorByEvaluationId((previous) => ({
        ...previous,
        [evaluationId]: getErrorMessage(error, 'Impossible de resoumettre cette évaluation.'),
      }))
    } finally {
      setResubmittingEvaluationId(null)
    }
  }

  return (
    <ul className="space-y-3">
      {evaluations.map((evaluation) => (
        <li key={evaluation.id} className="bg-white border border-gray-200 rounded-lg p-4 space-y-2">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-900 truncate">
                {getEvaluationDisplayTitle(evaluation.title)}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {evaluation.exerciseItems.length} exercice(s)
                {evaluation.durationSeconds
                  ? ` · ${Math.round(evaluation.durationSeconds / 60)} min`
                  : ''}
              </p>
            </div>
            <StatusBadge
              status={evaluation.status}
              label={EVALUATION_STATUS_LABELS[evaluation.status]}
              badgeClasses={EVALUATION_STATUS_BADGE_CLASSES}
            />
          </div>

          {evaluation.status === 'rejected' && (
            <div className="bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {evaluation.rejectionCommentStatus === 'loading' && (
                <p className="text-xs text-gray-500">Chargement du motif de refus…</p>
              )}
              {evaluation.rejectionCommentStatus === 'loaded' && (
                <p className="text-xs text-red-700">
                  <span className="font-medium">Motif du refus : </span>
                  {evaluation.rejectionComment || 'Aucun commentaire renseigné.'}
                </p>
              )}
              {evaluation.rejectionCommentStatus === 'unavailable' && (
                <p className="text-xs text-gray-500">Motif du refus indisponible pour le moment.</p>
              )}
            </div>
          )}

          {rowErrorByEvaluationId[evaluation.id] && (
            <p className="text-xs text-red-600">{rowErrorByEvaluationId[evaluation.id]}</p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => navigate(`/content/evaluations/${evaluation.id}`)}
              className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
            >
              Voir la fiche
            </button>
            {evaluation.status === 'rejected' && (
              <button
                type="button"
                onClick={() => handleResubmit(evaluation.id)}
                disabled={resubmittingEvaluationId === evaluation.id}
                className="px-3 py-1.5 text-xs font-medium text-white bg-amber-600 rounded hover:bg-amber-700 disabled:opacity-50 transition-colors"
              >
                {resubmittingEvaluationId === evaluation.id ? 'Envoi…' : 'Resoumettre à validation'}
              </button>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}
