/**
 * WorkflowIncidentView — Phase 16 (orchestration-service)
 *
 * Consultation de l'historique des événements d'intégration pour un
 * correlationId donné (diagnostic d'incidents transverses).
 *
 * Routes API consommées :
 *   GET /orchestration/events/:correlationId
 */

import React, { useState } from 'react'
import Layout from '../components/Layout'
import { useAuth } from '../hooks/useAuth'
import {
  fetchEventHistory,
  type IntegrationEvent,
  type IntegrationEventHistory,
} from '../api/orchestration'

const ADMIN_ROLES = [
  'technicien_informatique',
  'responsable_pedagogique',
  'administrateur_financier',
] as const

export default function WorkflowIncidentView() {
  const { hasRole } = useAuth()

  const [searchCorrelationId, setSearchCorrelationId] = useState('')
  const [eventHistory, setEventHistory] = useState<IntegrationEventHistory | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const canAccess = ADMIN_ROLES.some((role) => hasRole(role))

  if (!canAccess) {
    return (
      <Layout>
        <p className="text-red-600 text-sm">
          Accès réservé aux techniciens informatiques, responsables pédagogiques et administrateurs
          financiers.
        </p>
      </Layout>
    )
  }

  const handleSearch = async (event: React.FormEvent) => {
    event.preventDefault()
    const trimmedId = searchCorrelationId.trim()
    if (!trimmedId) return

    setIsLoading(true)
    setLoadError(null)
    setEventHistory(null)

    try {
      const history = await fetchEventHistory(trimmedId)
      setEventHistory(history)
    } catch {
      setLoadError('Impossible de charger l\'historique des événements pour ce correlationId.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* En-tête */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Historique des événements</h1>
          <p className="text-gray-500 text-sm mt-1">
            Consultez l'historique chronologique des événements d'intégration par correlationId.
          </p>
        </div>

        {/* Formulaire de recherche */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <form onSubmit={handleSearch} className="flex gap-3">
            <input
              type="text"
              value={searchCorrelationId}
              onChange={(e) => setSearchCorrelationId(e.target.value)}
              placeholder="correlationId (UUID)"
              aria-label="correlationId"
              className="flex-1 px-3 py-2 text-sm font-mono border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              type="submit"
              disabled={isLoading || !searchCorrelationId.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              Rechercher
            </button>
          </form>
        </div>

        {/* État de chargement */}
        {isLoading && (
          <p className="text-gray-400 text-sm">Chargement des événements…</p>
        )}

        {/* Erreur */}
        {loadError && (
          <p className="text-red-600 text-sm">{loadError}</p>
        )}

        {/* Résultats */}
        {eventHistory && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-800">
                Événements ({eventHistory.count})
              </h2>
              <span className="text-xs text-gray-400 font-mono">
                {eventHistory.correlationId}
              </span>
            </div>

            {eventHistory.events.length === 0 ? (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center">
                <p className="text-gray-400 text-sm">
                  Aucun événement trouvé pour ce correlationId.
                </p>
              </div>
            ) : (
              <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
                {eventHistory.events.map((integrationEvent: IntegrationEvent) => (
                  <div key={integrationEvent.id} className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-gray-900">
                          {integrationEvent.eventType}
                        </p>
                        {integrationEvent.sourceService && (
                          <p className="text-xs text-gray-500 mt-0.5">
                            Source : {integrationEvent.sourceService}
                          </p>
                        )}
                        {integrationEvent.payload &&
                          Object.keys(integrationEvent.payload).length > 0 && (
                            <pre className="mt-2 text-xs text-gray-600 bg-gray-50 rounded p-2 overflow-x-auto">
                              {JSON.stringify(integrationEvent.payload, null, 2)}
                            </pre>
                          )}
                      </div>
                      <span className="text-xs text-gray-400 shrink-0">
                        {new Date(integrationEvent.occurredAt).toLocaleString('fr-FR')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  )
}
