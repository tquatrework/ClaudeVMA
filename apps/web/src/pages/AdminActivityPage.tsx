/**
 * AdminActivityPage — Supervision des workflows et commandes d'orchestration.
 *
 * Routes API consommées :
 *   GET  /orchestration/workflows
 *   POST /orchestration/workflows/:workflowId/start
 *   POST /orchestration/commands
 *   GET  /orchestration/events/:correlationId
 */

import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import apiClient from '../api/client'
import Layout from '../components/Layout'
import { StatusBadge } from '../components/ui/StatusBadge'
import { ErrorMessage } from '../components/ui/ErrorMessage'
import { WorkflowCommandPanel } from '../components/admin/WorkflowCommandPanel'
import { WorkflowEventsPanel } from '../components/admin/WorkflowEventsPanel'
import { formatLocalDateTime } from '../utils/dateFormat'

interface WorkflowType {
  id: string
  name: string
  phase?: string
  stepCount?: number
}

interface WorkflowInstance {
  workflowInstanceId: string
  workflowType: string
  status: string
  startedAt: string
  correlationId: string
}

type ActivePanel = 'workflows' | 'commands' | 'events'

const WORKFLOW_STATUS_BADGE_CLASSES: Record<string, string> = {
  in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  needs_arbitration: 'bg-yellow-100 text-yellow-700',
  suspended: 'bg-gray-100 text-gray-500',
}

const WORKFLOW_TYPES = [
  'student-onboarding',
  'teacher-onboarding',
  'teacher-request-to-assignment',
  'scheduled-video-course',
]

export default function AdminActivityPage() {
  const [activePanel, setActivePanel] = useState<ActivePanel>('workflows')
  const [workflowInstances, setWorkflowInstances] = useState<WorkflowInstance[]>([])
  const [availableWorkflowTypes, setAvailableWorkflowTypes] = useState<WorkflowType[]>([])
  const [isLoadingWorkflows, setIsLoadingWorkflows] = useState(true)
  const [workflowError, setWorkflowError] = useState<string | null>(null)

  const [isStartingWorkflow, setIsStartingWorkflow] = useState(false)
  const [selectedWorkflowType, setSelectedWorkflowType] = useState(WORKFLOW_TYPES[0])
  const [workflowPayload, setWorkflowPayload] = useState('{}')
  const [isLaunchingWorkflow, setIsLaunchingWorkflow] = useState(false)
  const [workflowStartResult, setWorkflowStartResult] = useState<string | null>(null)
  const [workflowStartError, setWorkflowStartError] = useState<string | null>(null)

  useEffect(() => {
    apiClient
      .get<WorkflowType[]>('/orchestration/workflows')
      .then(({ data }) => {
        if (Array.isArray(data)) setAvailableWorkflowTypes(data)
      })
      .catch(() => { /* non-blocking */ })

    setIsLoadingWorkflows(false)
  }, [])

  const handleStartWorkflow = async (event: React.FormEvent) => {
    event.preventDefault()
    setIsLaunchingWorkflow(true)
    setWorkflowStartError(null)
    setWorkflowStartResult(null)

    let parsedPayload: unknown = {}
    try {
      parsedPayload = JSON.parse(workflowPayload)
    } catch {
      setWorkflowStartError('Le payload doit être un JSON valide')
      setIsLaunchingWorkflow(false)
      return
    }

    try {
      const { data } = await apiClient.post(
        `/orchestration/workflows/${selectedWorkflowType}/start`,
        { workflowType: selectedWorkflowType, payload: parsedPayload },
      )
      setWorkflowStartResult(JSON.stringify(data, null, 2))
      setIsStartingWorkflow(false)
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Erreur lors du déclenchement du workflow'
      setWorkflowStartError(message)
    } finally {
      setIsLaunchingWorkflow(false)
    }
  }

  return (
    <Layout>
      <div className="max-w-5xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Activité interne</h1>
            <p className="text-sm text-gray-500 mt-1">
              Supervision des workflows et commandes d'intégration
            </p>
          </div>
          <Link
            to="/incidents"
            className="text-sm border border-gray-200 text-gray-600 px-4 py-2 rounded-lg hover:border-indigo-300 hover:text-indigo-600 transition-colors"
          >
            Voir les incidents
          </Link>
        </div>

        {/* Onglets de panneau */}
        <div className="flex border-b border-gray-200 mb-6">
          {(
            [
              { id: 'workflows', label: 'Workflows' },
              { id: 'commands', label: 'Commandes' },
              { id: 'events', label: 'Événements' },
            ] as const
          ).map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setActivePanel(id)}
              className={`px-5 py-2 text-sm font-medium border-b-2 transition-colors ${
                activePanel === id
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Panneau Workflows */}
        {activePanel === 'workflows' && (
          <div className="space-y-6">
            {/* Types disponibles */}
            {availableWorkflowTypes.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">
                  Types de workflows disponibles
                </h2>
                <div className="flex flex-wrap gap-2">
                  {availableWorkflowTypes.map((workflowType) => (
                    <span
                      key={workflowType.id}
                      className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-100 px-3 py-1 rounded-full"
                    >
                      {workflowType.name ?? workflowType.id}
                      {workflowType.stepCount != null && (
                        <span className="ml-1 text-indigo-400">
                          ({workflowType.stepCount} étapes)
                        </span>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Déclencher un workflow */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
                  Déclencher un workflow
                </h2>
                <button
                  onClick={() => setIsStartingWorkflow(!isStartingWorkflow)}
                  className="text-sm text-indigo-600 hover:underline"
                >
                  {isStartingWorkflow ? 'Annuler' : 'Nouveau workflow'}
                </button>
              </div>

              {workflowStartError && (
                <ErrorMessage
                  message={workflowStartError}
                  onClose={() => setWorkflowStartError(null)}
                  className="mb-3"
                />
              )}

              {workflowStartResult && (
                <div className="mb-3">
                  <p className="text-sm font-medium text-green-700 mb-1">Workflow démarré :</p>
                  <pre className="p-3 bg-green-50 border border-green-200 rounded-lg text-xs text-green-800 overflow-auto">
                    {workflowStartResult}
                  </pre>
                </div>
              )}

              {isStartingWorkflow && (
                <form
                  onSubmit={handleStartWorkflow}
                  className="bg-white border border-gray-200 rounded-xl p-5 space-y-4"
                >
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Type de workflow
                    </label>
                    <select
                      value={selectedWorkflowType}
                      onChange={(e) => setSelectedWorkflowType(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    >
                      {WORKFLOW_TYPES.map((workflowTypeName) => (
                        <option key={workflowTypeName} value={workflowTypeName}>
                          {workflowTypeName}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Payload (JSON)
                    </label>
                    <textarea
                      value={workflowPayload}
                      onChange={(e) => setWorkflowPayload(e.target.value)}
                      rows={4}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isLaunchingWorkflow}
                    className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {isLaunchingWorkflow ? 'Lancement…' : 'Déclencher'}
                  </button>
                </form>
              )}
            </div>

            {/* Instances actives */}
            <div>
              <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">
                Instances actives
              </h2>
              {isLoadingWorkflows && <p className="text-gray-400 text-sm">Chargement…</p>}
              {workflowError && <ErrorMessage message={workflowError} />}
              {!isLoadingWorkflows && workflowInstances.length === 0 && (
                <div className="text-center py-8 bg-white border border-gray-200 rounded-xl">
                  <p className="text-gray-400 text-sm">Aucune instance de workflow active</p>
                  <p className="text-xs text-gray-300 mt-1">
                    Déclenchez un workflow ci-dessus pour le voir apparaître ici
                  </p>
                </div>
              )}
              {workflowInstances.length > 0 && (
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
                      {workflowInstances.map((workflowInstance) => (
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
          </div>
        )}

        {activePanel === 'commands' && <WorkflowCommandPanel />}
        {activePanel === 'events' && <WorkflowEventsPanel />}
      </div>
    </Layout>
  )
}
