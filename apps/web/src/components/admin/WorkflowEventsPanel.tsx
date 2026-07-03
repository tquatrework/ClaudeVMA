/**
 * WorkflowEventsPanel — Panneau "Événements" de AdminActivityPage
 *
 * Recherche l'historique des événements d'intégration par correlationId.
 * Route API : GET /orchestration/events/:correlationId
 */

import React, { useState } from 'react'
import apiClient from '../../api/client'
import { ErrorMessage } from '../ui/ErrorMessage'
import { formatLocalDateTime } from '../../utils/dateFormat'

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

export function WorkflowEventsPanel() {
  const [correlationIdSearch, setCorrelationIdSearch] = useState('')
  const [eventsResult, setEventsResult] = useState<EventsResponse | null>(null)
  const [isSearchingEvents, setIsSearchingEvents] = useState(false)
  const [eventsError, setEventsError] = useState<string | null>(null)

  const handleSearchEvents = async (event: React.FormEvent) => {
    event.preventDefault()
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

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-gray-800 mb-1">
          Historique des événements
        </h2>
        <p className="text-sm text-gray-500">
          Recherchez tous les événements d'intégration associés à un correlationId.
        </p>
      </div>

      <form onSubmit={handleSearchEvents} className="flex gap-3">
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
        <ErrorMessage message={eventsError} onClose={() => setEventsError(null)} />
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
                      {formatLocalDateTime(integrationEvent.occurredAt)}
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
  )
}
