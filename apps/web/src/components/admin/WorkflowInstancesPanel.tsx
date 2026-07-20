/**
 * WorkflowInstancesPanel — Panneau "Instances actives" de AdminActivityPage
 *
 * Aucune route de listing des instances de workflow n'existe côté orchestration-service
 * (seule GET /orchestration/workflows/:workflowInstanceId permet de lire une instance
 * précise) : ce composant reçoit toujours une liste vide depuis la page, à l'identique
 * du comportement préexistant.
 */

import React from 'react'
import { Link } from 'react-router-dom'
import { StatusBadge } from '../ui/StatusBadge'
import { formatLocalDateTime } from '../../utils/dateFormat'

export interface WorkflowInstance {
  workflowInstanceId: string
  workflowType: string
  status: string
  startedAt: string
  correlationId: string
}

const WORKFLOW_STATUS_BADGE_CLASSES: Record<string, string> = {
  in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  needs_arbitration: 'bg-yellow-100 text-yellow-700',
  suspended: 'bg-gray-100 text-gray-500',
}

interface WorkflowInstancesPanelProps {
  instances: WorkflowInstance[]
}

export function WorkflowInstancesPanel({ instances }: WorkflowInstancesPanelProps) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">
        Instances actives
      </h2>
      {instances.length === 0 ? (
        <div className="text-center py-8 bg-white border border-gray-200 rounded-xl">
          <p className="text-gray-400 text-sm">Aucune instance de workflow active</p>
          <p className="text-xs text-gray-300 mt-1">
            Déclenchez un workflow ci-dessus pour le voir apparaître ici
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm bg-white border border-gray-200 rounded-xl overflow-hidden">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-left">Statut</th>
                <th className="px-4 py-3 text-left">Démarré le</th>
                <th className="px-4 py-3 text-left">Correlation ID</th>
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {instances.map((workflowInstance) => (
                <tr key={workflowInstance.workflowInstanceId} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">
                    {workflowInstance.workflowType}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge
                      status={workflowInstance.status}
                      badgeClasses={WORKFLOW_STATUS_BADGE_CLASSES}
                    />
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {formatLocalDateTime(workflowInstance.startedAt)}
                  </td>
                  <td className="px-4 py-3 text-gray-400 font-mono text-xs">
                    {workflowInstance.correlationId?.slice(0, 12)}…
                  </td>
                  <td className="px-4 py-3">
                    {workflowInstance.status === 'needs_arbitration' && (
                      <Link
                        to={`/agreements/${workflowInstance.workflowInstanceId}`}
                        className="text-xs text-indigo-600 hover:underline"
                      >
                        Arbitrer
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
