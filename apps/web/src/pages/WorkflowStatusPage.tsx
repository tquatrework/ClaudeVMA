/**
 * WorkflowStatusPage — Phase 16 (orchestration-service)
 *
 * Liste tous les types de workflows disponibles et permet de consulter
 * le détail d'une instance via son identifiant.
 *
 * Routes API consommées :
 *   GET /orchestration/workflows
 *   GET /orchestration/workflows/:workflowInstanceId
 */

import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { useAuth } from '../hooks/useAuth'
import {
  fetchWorkflowDefinitions,
  type WorkflowDefinition,
} from '../api/orchestration'

const ADMIN_ROLES = [
  'technicien_informatique',
  'responsable_pedagogique',
  'administrateur_financier',
] as const

export default function WorkflowStatusPage() {
  const { hasRole } = useAuth()
  const navigate = useNavigate()

  const [workflowDefinitions, setWorkflowDefinitions] = useState<WorkflowDefinition[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [searchInstanceId, setSearchInstanceId] = useState('')

  const canAccess = ADMIN_ROLES.some((role) => hasRole(role))

  const loadWorkflowDefinitions = () => {
    setIsLoading(true)
    setLoadError(null)
    fetchWorkflowDefinitions()
      .then((definitions) => setWorkflowDefinitions(definitions))
      .catch(() => setLoadError('Impossible de charger les workflows disponibles.'))
      .finally(() => setIsLoading(false))
  }

  useEffect(() => {
    if (!canAccess) return
    loadWorkflowDefinitions()
  }, [canAccess])

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

  const handleSearchInstance = (event: React.FormEvent) => {
    event.preventDefault()
    const trimmedId = searchInstanceId.trim()
    if (trimmedId) {
      navigate(`/admin/orchestration/workflows/${trimmedId}`)
    }
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* En-tête */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Workflows</h1>
            <p className="text-gray-500 text-sm mt-1">
              Suivi des workflows transverses de l'orchestration-service.
            </p>
          </div>
          <button
            type="button"
            onClick={loadWorkflowDefinitions}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
          >
            Actualiser
          </button>
        </div>

        {/* Recherche d'instance */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-800 mb-3">Consulter une instance</h2>
          <form onSubmit={handleSearchInstance} className="flex gap-3">
            <input
              type="text"
              value={searchInstanceId}
              onChange={(e) => setSearchInstanceId(e.target.value)}
              placeholder="Identifiant d'instance (UUID)"
              aria-label="Identifiant d'instance"
              className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              type="submit"
              disabled={!searchInstanceId.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              Consulter
            </button>
          </form>
        </div>

        {/* Liste des types de workflows */}
        {isLoading ? (
          <p className="text-gray-400 text-sm">Chargement des workflows disponibles…</p>
        ) : loadError ? (
          <div className="space-y-3">
            <p className="text-red-600 text-sm">{loadError}</p>
            <button
              type="button"
              onClick={loadWorkflowDefinitions}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 transition-colors"
            >
              Réessayer
            </button>
          </div>
        ) : workflowDefinitions.length === 0 ? (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center">
            <p className="text-gray-400 text-sm">Aucun workflow disponible.</p>
          </div>
        ) : (
          <div>
            <h2 className="text-base font-semibold text-gray-800 mb-3">
              Types de workflows ({workflowDefinitions.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {workflowDefinitions.map((workflowDefinition) => (
                <div
                  key={workflowDefinition.id}
                  className="bg-white border border-gray-200 rounded-xl p-4"
                >
                  <p className="text-sm font-semibold text-gray-900">{workflowDefinition.name}</p>
                  <div className="flex items-center gap-4 mt-2">
                    <span className="text-xs text-gray-500">
                      Phase {workflowDefinition.phase}
                    </span>
                    <span className="text-xs text-gray-500">
                      {workflowDefinition.stepCount} étape
                      {workflowDefinition.stepCount !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
