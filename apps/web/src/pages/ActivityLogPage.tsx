/**
 * ActivityLogPage — Phase 15 (admin-observability-service)
 *
 * Consultation des logs d'activité utilisateurs par le TI, RP et AF.
 *
 * Routes API consommées :
 *   GET /admin/activity-log
 */

import React, { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import { useAuth } from '../hooks/useAuth'
import {
  fetchActivityLog,
  type ActivityLogEntry,
  type ActivityLogFilters,
} from '../api/adminObservability'

function formatOccurredAt(isoDate: string): string {
  return new Date(isoDate).toLocaleString('fr-FR')
}

export default function ActivityLogPage() {
  const { hasRole } = useAuth()

  const [logEntries, setLogEntries] = useState<ActivityLogEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Filtres
  const [filterUserId, setFilterUserId] = useState('')
  const [filterAction, setFilterAction] = useState('')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')

  const isTi = hasRole('technicien_informatique')
  const isRp = hasRole('responsable_pedagogique')
  const isAf = hasRole('administrateur_financier')
  const canAccess = isTi || isRp || isAf

  const loadLogs = (filters?: ActivityLogFilters) => {
    setIsLoading(true)
    setLoadError(null)

    fetchActivityLog(filters)
      .then((entries) => setLogEntries(entries))
      .catch(() => setLoadError('Impossible de charger les logs d\'activité.'))
      .finally(() => setIsLoading(false))
  }

  useEffect(() => {
    if (!canAccess) return
    loadLogs()
  }, [canAccess])

  const handleApplyFilters = (event: React.FormEvent) => {
    event.preventDefault()
    const filters: ActivityLogFilters = {}
    if (filterUserId.trim()) filters.userId = filterUserId.trim()
    if (filterAction.trim()) filters.action = filterAction.trim()
    if (filterFrom) filters.from = filterFrom
    if (filterTo) filters.to = filterTo
    loadLogs(filters)
  }

  const handleResetFilters = () => {
    setFilterUserId('')
    setFilterAction('')
    setFilterFrom('')
    setFilterTo('')
    loadLogs()
  }

  if (!canAccess) {
    return (
      <Layout>
        <p className="text-red-600 text-sm">
          Accès réservé aux techniciens informatiques, responsables pédagogiques et administrateurs financiers.
        </p>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* En-tête */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Logs d'activité</h1>
          <p className="text-gray-500 text-sm mt-1">
            Historique des actions effectuées par les utilisateurs sur la plateforme.
          </p>
        </div>

        {/* Filtres */}
        <form
          onSubmit={handleApplyFilters}
          className="bg-white border border-gray-200 rounded-xl p-4 space-y-3"
        >
          <h2 className="text-sm font-semibold text-gray-700">Filtrer les logs</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label htmlFor="filter-user-id" className="block text-xs text-gray-600 mb-1">
                ID utilisateur
              </label>
              <input
                id="filter-user-id"
                type="text"
                value={filterUserId}
                onChange={(e) => setFilterUserId(e.target.value)}
                placeholder="ex: user-abc123"
                className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label htmlFor="filter-action" className="block text-xs text-gray-600 mb-1">
                Action
              </label>
              <input
                id="filter-action"
                type="text"
                value={filterAction}
                onChange={(e) => setFilterAction(e.target.value)}
                placeholder="ex: login, profile_update…"
                className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label htmlFor="filter-from" className="block text-xs text-gray-600 mb-1">
                Depuis
              </label>
              <input
                id="filter-from"
                type="datetime-local"
                value={filterFrom}
                onChange={(e) => setFilterFrom(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label htmlFor="filter-to" className="block text-xs text-gray-600 mb-1">
                Jusqu'au
              </label>
              <input
                id="filter-to"
                type="datetime-local"
                value={filterTo}
                onChange={(e) => setFilterTo(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={handleResetFilters}
              className="px-3 py-1.5 text-sm text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
            >
              Réinitialiser
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 transition-colors"
            >
              Appliquer
            </button>
          </div>
        </form>

        {/* Contenu */}
        {isLoading && (
          <p className="text-gray-400 text-sm">Chargement des logs d'activité…</p>
        )}

        {!isLoading && loadError && (
          <p className="text-red-600 text-sm">{loadError}</p>
        )}

        {!isLoading && !loadError && (
          <ActivityLogTable logEntries={logEntries} />
        )}
      </div>
    </Layout>
  )
}

// ─── Sous-composant : tableau des logs d'activité ─────────────────────────────

interface ActivityLogTableProps {
  logEntries: ActivityLogEntry[]
}

export function ActivityLogTable({ logEntries }: ActivityLogTableProps) {
  if (logEntries.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center">
        <p className="text-gray-400 text-sm">Aucun log d'activité trouvé.</p>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-100">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Date
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Utilisateur
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Rôle
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Action
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Ressource
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {logEntries.map((entry) => (
              <tr key={entry.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                  {formatOccurredAt(entry.occurredAt)}
                </td>
                <td className="px-4 py-3 text-xs text-gray-900">
                  <div>{entry.userEmail ?? entry.userId ?? '—'}</div>
                </td>
                <td className="px-4 py-3 text-xs text-gray-600">
                  {entry.userRole ?? '—'}
                </td>
                <td className="px-4 py-3 text-xs font-medium text-gray-900">
                  {entry.action}
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {entry.targetResource ? `${entry.targetResource}${entry.targetId ? ` (${entry.targetId})` : ''}` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
