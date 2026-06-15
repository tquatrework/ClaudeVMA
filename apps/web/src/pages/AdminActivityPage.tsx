import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import apiClient from '../api/client'
import Layout from '../components/Layout'

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

interface IntegrationEvent {
  eventId?: string
  eventType: string
  occurredAt: string
  payload?: Record<string, unknown>
}

interface EventsResponse {
  correlationId: string
  count: number
  events: IntegrationEvent[]
}

type ActivePanel = 'workflows' | 'commands' | 'events'

const STATUS_COLORS: Record<string, string> = {
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
  const [workflows, setWorkflows] = useState<WorkflowInstance[]>([])
  const [availableWorkflowTypes, setAvailableWorkflowTypes] = useState<WorkflowType[]>([])
  const [isLoadingWorkflows, setIsLoadingWorkflows] = useState(true)
  const [workflowError, setWorkflowError] = useState<string | null>(null)

  // Commands panel state
  const [commandTargetService, setCommandTargetService] = useState('')
  const [commandAction, setCommandAction] = useState('')
  const [commandPayload, setCommandPayload] = useState('{}')
  const [commandIdempotencyKey, setCommandIdempotencyKey] = useState('')
  const [isSendingCommand, setIsSendingCommand] = useState(false)
  const [commandResult, setCommandResult] = useState<string | null>(null)
  const [commandError, setCommandError] = useState<string | null>(null)

  // Events panel state
  const [correlationIdSearch, setCorrelationIdSearch] = useState('')
  const [eventsResult, setEventsResult] = useState<EventsResponse | null>(null)
  const [isSearchingEvents, setIsSearchingEvents] = useState(false)
  const [eventsError, setEventsError] = useState<string | null>(null)

  // Workflow start panel state
  const [isStartingWorkflow, setIsStartingWorkflow] = useState(false)
  const [selectedWorkflowType, setSelectedWorkflowType] = useState(WORKFLOW_TYPES[0])
  const [workflowPayload, setWorkflowPayload] = useState('{}')
  const [isLaunchingWorkflow, setIsLaunchingWorkflow] = useState(false)
  const [workflowStartResult, setWorkflowStartResult] = useState<string | null>(null)
  const [workflowStartError, setWorkflowStartError] = useState<string | null>(null)

  useEffect(() => {
    // Load available workflow types
    apiClient
      .get<WorkflowType[]>('/orchestration/workflows')
      .then(({ data }) => {
        if (Array.isArray(data)) {
          setAvailableWorkflowTypes(data)
          // Use workflows data if it contains instances (the API returns types, not instances)
        }
      })
      .catch(() => { /* non-blocking */ })

    // Note: The GET /workflows endpoint returns types, not instances.
    // In production, a separate endpoint would list instances.
    // We'll show an empty state with a note.
    setIsLoadingWorkflows(false)
  }, [])

  const handleSendCommand = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!commandTargetService.trim() || !commandAction.trim()) return
    setIsSendingCommand(true)
    setCommandError(null)
    setCommandResult(null)

    let parsedPayload: unknown = {}
    try {
      parsedPayload = JSON.parse(commandPayload)
    } catch {
      setCommandError('Le payload doit être un JSON valide')
      setIsSendingCommand(false)
      return
    }

    try {
      const { data } = await apiClient.post('/orchestration/commands', {
        targetService: commandTargetService.trim(),
        action: commandAction.trim(),
        payload: parsedPayload,
        idempotencyKey: commandIdempotencyKey.trim() || crypto.randomUUID(),
      })
      setCommandResult(JSON.stringify(data, null, 2))
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Erreur lors de l'envoi de la commande"
      setCommandError(message)
    } finally {
      setIsSendingCommand(false)
    }
  }

  const handleSearchEvents = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!correlationIdSearch.trim()) return
    setIsSearchingEvents(true)
    setEventsError(null)
    setEventsResult(null)
    try {
      const { data } = await apiClient.get<EventsResponse>(
        `/orchestration/events/${correlationIdSearch.trim()}`,
      )
      setEventsResult(data)
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 404) setEventsError('Aucun événement trouvé pour ce correlationId')
      else setEventsError('Erreur lors de la recherche des événements')
    } finally {
      setIsSearchingEvents(false)
    }
  }

  const handleStartWorkflow = async (e: React.FormEvent) => {
    e.preventDefault()
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
        {
          workflowType: selectedWorkflowType,
          payload: parsedPayload,
        },
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
            <p className="text-sm text-gray-500 mt-1">Supervision des workflows et commandes d'intégration</p>
          </div>
          <Link
            to="/incidents"
            className="text-sm border border-gray-200 text-gray-600 px-4 py-2 rounded-lg hover:border-indigo-300 hover:text-indigo-600 transition-colors"
          >
            Voir les incidents
          </Link>
        </div>

        {/* Panel tabs */}
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

        {/* Workflows panel */}
        {activePanel === 'workflows' && (
          <div className="space-y-6">
            {/* Available workflow types */}
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
                        <span className="ml-1 text-indigo-400">({workflowType.stepCount} étapes)</span>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Start workflow */}
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
                <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {workflowStartError}
                </div>
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

            {/* Workflow instances */}
            <div>
              <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">
                Instances actives
              </h2>
              {isLoadingWorkflows && <p className="text-gray-400 text-sm">Chargement…</p>}
              {workflowError && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                  {workflowError}
                </div>
              )}
              {!isLoadingWorkflows && workflows.length === 0 && (
                <div className="text-center py-8 bg-white border border-gray-200 rounded-xl">
                  <p className="text-gray-400 text-sm">Aucune instance de workflow active</p>
                  <p className="text-xs text-gray-300 mt-1">
                    Déclenchez un workflow ci-dessus pour le voir apparaître ici
                  </p>
                </div>
              )}
              {workflows.length > 0 && (
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
                      {workflows.map((wf) => (
                        <tr key={wf.workflowInstanceId} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-800">{wf.workflowType}</td>
                          <td className="px-4 py-3">
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                STATUS_COLORS[wf.status] ?? 'bg-gray-100 text-gray-500'
                              }`}
                            >
                              {wf.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-600">
                            {new Date(wf.startedAt).toLocaleString('fr-FR')}
                          </td>
                          <td className="px-4 py-3 text-gray-400 font-mono text-xs">
                            {wf.correlationId?.slice(0, 12)}…
                          </td>
                          <td className="px-4 py-3">
                            {wf.status === 'needs_arbitration' && (
                              <Link
                                to={`/agreements/${wf.workflowInstanceId}`}
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

        {/* Commands panel */}
        {activePanel === 'commands' && (
          <div className="space-y-5">
            <div>
              <h2 className="text-base font-semibold text-gray-800 mb-1">Commande d'intégration</h2>
              <p className="text-sm text-gray-500">
                Émet une commande idempotente vers un microservice cible. Utilisez une clé d'idempotence
                unique pour éviter les doublons.
              </p>
            </div>

            {commandError && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                {commandError}
              </div>
            )}

            {commandResult && (
              <div>
                <p className="text-sm font-medium text-green-700 mb-2">Réponse :</p>
                <pre className="p-4 bg-green-50 border border-green-200 rounded-xl text-xs text-green-800 overflow-auto">
                  {commandResult}
                </pre>
              </div>
            )}

            <form
              onSubmit={handleSendCommand}
              className="bg-white border border-gray-200 rounded-xl p-6 space-y-4"
            >
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Service cible <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={commandTargetService}
                    onChange={(e) => setCommandTargetService(e.target.value)}
                    placeholder="Ex : identity-access-service"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Action <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={commandAction}
                    onChange={(e) => setCommandAction(e.target.value)}
                    placeholder="Ex : validate-account"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Clé d'idempotence
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={commandIdempotencyKey}
                    onChange={(e) => setCommandIdempotencyKey(e.target.value)}
                    placeholder="Laissez vide pour générer automatiquement"
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                  <button
                    type="button"
                    onClick={() => setCommandIdempotencyKey(crypto.randomUUID())}
                    className="text-xs border border-gray-200 text-gray-500 px-3 py-2 rounded-lg hover:border-indigo-300 hover:text-indigo-600 whitespace-nowrap"
                  >
                    Générer
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Payload (JSON)
                </label>
                <textarea
                  value={commandPayload}
                  onChange={(e) => setCommandPayload(e.target.value)}
                  rows={5}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={isSendingCommand || !commandTargetService.trim() || !commandAction.trim()}
                className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50"
              >
                {isSendingCommand ? 'Envoi…' : 'Envoyer la commande'}
              </button>
            </form>
          </div>
        )}

        {/* Events panel */}
        {activePanel === 'events' && (
          <div className="space-y-5">
            <div>
              <h2 className="text-base font-semibold text-gray-800 mb-1">
                Historique des événements
              </h2>
              <p className="text-sm text-gray-500">
                Recherchez tous les événements d'intégration associés à un correlationId.
              </p>
            </div>

            <form
              onSubmit={handleSearchEvents}
              className="flex gap-3"
            >
              <input
                type="text"
                value={correlationIdSearch}
                onChange={(e) => setCorrelationIdSearch(e.target.value)}
                placeholder="UUID du correlationId"
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
              <button
                type="submit"
                disabled={isSearchingEvents || !correlationIdSearch.trim()}
                className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50 whitespace-nowrap"
              >
                {isSearchingEvents ? 'Recherche…' : 'Rechercher'}
              </button>
            </form>

            {eventsError && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                {eventsError}
              </div>
            )}

            {eventsResult && (
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <p className="text-sm font-medium text-gray-700">
                    {eventsResult.count} événement{eventsResult.count !== 1 ? 's' : ''}
                  </p>
                  <span className="text-xs text-gray-400 font-mono">{eventsResult.correlationId}</span>
                </div>

                {eventsResult.events.length === 0 ? (
                  <p className="text-gray-400 text-sm">Aucun événement trouvé</p>
                ) : (
                  <ul className="space-y-3">
                    {eventsResult.events.map((integrationEvent, eventIndex) => (
                      <li
                        key={integrationEvent.eventId ?? eventIndex}
                        className="bg-white border border-gray-200 rounded-xl p-4"
                      >
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <span className="text-sm font-medium text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                            {integrationEvent.eventType}
                          </span>
                          <span className="text-xs text-gray-400 shrink-0">
                            {new Date(integrationEvent.occurredAt).toLocaleString('fr-FR')}
                          </span>
                        </div>
                        {integrationEvent.payload && Object.keys(integrationEvent.payload).length > 0 && (
                          <pre className="text-xs text-gray-600 bg-gray-50 p-2 rounded overflow-auto">
                            {JSON.stringify(integrationEvent.payload, null, 2)}
                          </pre>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  )
}
