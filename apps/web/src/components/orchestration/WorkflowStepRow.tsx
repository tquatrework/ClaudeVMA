/**
 * WorkflowStepRow — ligne d'étape d'une instance de workflow, avec les libellés
 * et classes de badge de statut partagés par WorkflowTimeline.
 * Extrait de WorkflowTimeline (lot 10 — normalisation, découpage > 300 lignes).
 */

import React from 'react'
import type { WorkflowStep, WorkflowStatus } from '../../api/orchestration'

export const STATUS_LABELS: Record<WorkflowStatus, string> = {
  pending: 'En attente',
  in_progress: 'En cours',
  completed: 'Terminé',
  failed: 'Échoué',
  needs_arbitration: 'Arbitrage requis',
}

export const STATUS_BADGE_CLASSES: Record<WorkflowStatus, string> = {
  pending: 'bg-gray-100 text-gray-600',
  in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  needs_arbitration: 'bg-yellow-100 text-yellow-700',
}

const STEP_INDICATOR_CLASSES: Record<WorkflowStatus, string> = {
  pending: 'bg-gray-300',
  in_progress: 'bg-blue-500',
  completed: 'bg-green-500',
  failed: 'bg-red-500',
  needs_arbitration: 'bg-yellow-400',
}

export function WorkflowStepRow({ step }: { step: WorkflowStep }) {
  return (
    <div className="flex items-start gap-4">
      <div className="flex flex-col items-center">
        <div
          className={`w-3 h-3 rounded-full mt-1 shrink-0 ${STEP_INDICATOR_CLASSES[step.status]}`}
        />
      </div>
      <div className="flex-1 pb-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-gray-900">
              Étape {step.order} — {step.service}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">{step.action}</p>
          </div>
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded shrink-0 ${STATUS_BADGE_CLASSES[step.status]}`}
          >
            {STATUS_LABELS[step.status]}
          </span>
        </div>
        {step.errorMessage && (
          <p className="text-xs text-red-600 mt-1">{step.errorMessage}</p>
        )}
        {step.startedAt && (
          <p className="text-xs text-gray-400 mt-1">
            Démarré le {new Date(step.startedAt).toLocaleString('fr-FR')}
          </p>
        )}
      </div>
    </div>
  )
}
