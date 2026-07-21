/**
 * AdminActivityPage — Supervision des workflows et commandes d'orchestration.
 *
 * Routes API consommées :
 *   GET  /orchestration/workflows
 *   POST /orchestration/workflows/:workflowId/start
 *   POST /orchestration/commands
 *   GET  /orchestration/events/:correlationId
 */

import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../components/Layout'
import { ErrorMessage } from '../components/ui/ErrorMessage'
import { WorkflowCommandPanel } from '../components/admin/WorkflowCommandPanel'
import { WorkflowEventsPanel } from '../components/admin/WorkflowEventsPanel'
import { WorkflowInstancesPanel, type WorkflowInstance } from '../components/admin/WorkflowInstancesPanel'
import { useWorkflowActivity } from '../hooks/admin/useWorkflowActivity'
import type { WorkflowType } from '../api/orchestration'

type ActivePanel = 'workflows' | 'commands' | 'events'

const WORKFLOW_TYPES: WorkflowType[] = [
  'student-onboarding',
  'teacher-onboarding',
  'teacher-request-to-assignment',
  'scheduled-video-course',
]

export default function AdminActivityPage() {
  const {
    availableWorkflowTypes,
    isLoadingWorkflowTypes,
    workflowTypesError,
    launchWorkflow,
    isLaunchingWorkflow,
    launchError,
    resetLaunchError,
  } = useWorkflowActivity()

  const [activePanel, setActivePanel] = useState<ActivePanel>('workflows')

  // Aucune route de listing des instances de workflow n'existe côté orchestration-service
  // (seule /workflows/:workflowInstanceId permet de lire une instance précise) : cette liste
  // reste locale et vide, à l'identique du comportement préexistant.
  const [workflowInstances] = useState<WorkflowInstance[]>([])

  const [isStartingWorkflow, setIsStartingWorkflow] = useState(false)
  const [selectedWorkflowType, setSelectedWorkflowType] = useState<WorkflowType>(WORKFLOW_TYPES[0])
  const [workflowPayload, setWorkflowPayload] = useState('{}')
  const [workflowStartResult, setWorkflowStartResult] = useState<string | null>(null)
  const [payloadParseError, setPayloadParseError] = useState<string | null>(null)

  const handleStartWorkflow = async (event: React.FormEvent) => {
    event.preventDefault()
    setPayloadParseError(null)
    setWorkflowStartResult(null)

    let parsedPayload: Record<string, unknown> = {}
    try {
      parsedPayload = JSON.parse(workflowPayload)
    } catch {
      setPayloadParseError('Le payload doit être un JSON valide')
      return
    }

    const result = await launchWorkflow(selectedWorkflowType, parsedPayload)
    if (result) {
      setWorkflowStartResult(JSON.stringify(result, null, 2))
      setIsStartingWorkflow(false)
    }
  }

  const workflowStartError = payloadParseError ?? launchError

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
            <div>
              <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">
                Types de workflows disponibles
              </h2>
              {isLoadingWorkflowTypes ? (
                <p className="text-gray-400 text-sm">Chargement…</p>
              ) : workflowTypesError ? (
                <ErrorMessage message={workflowTypesError} />
              ) : availableWorkflowTypes.length === 0 ? (
                <p className="text-gray-400 text-sm">Aucun type de workflow disponible.</p>
              ) : (
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
              )}
            </div>

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
                  onClose={() => {
                    setPayloadParseError(null)
                    resetLaunchError()
                  }}
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
                      onChange={(e) => setSelectedWorkflowType(e.target.value as WorkflowType)}
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
            <WorkflowInstancesPanel instances={workflowInstances} />
          </div>
        )}

        {activePanel === 'commands' && <WorkflowCommandPanel />}
        {activePanel === 'events' && <WorkflowEventsPanel />}
      </div>
    </Layout>
  )
}
