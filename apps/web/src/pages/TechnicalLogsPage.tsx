/**
 * TechnicalLogsPage — Phase 15 (admin-observability-service)
 *
 * Consultation des logs techniques des microservices (TI uniquement).
 *
 * Routes API consommées :
 *   GET /admin/technical-logs
 */

import React, { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import { useAuth } from '../hooks/useAuth'
import {
  fetchTechnicalLogs,
  type TechnicalLogEntry,
  type TechnicalLogFilters,
  type TechnicalLogLevel,
} from '../api/adminObservability'

const LOG_LEVEL_BADGE_CLASSES: Record<TechnicalLogLevel, string> = {
  debug: 'bg-gray-100 text-gray-600',
  info: 'bg-blue-50 text-blue-700',
  warn: 'bg-yellow-100 text-yellow-700',
  error: 'bg-red-100 text-red-700',
  fatal: 'bg-red-700 text-white',
}

const AVAILABLE_LOG_LEVELS: TechnicalLogLevel[] = ['debug', 'info', 'warn', 'error', 'fatal']

export default function TechnicalLogsPage() {
  const { hasRole } = useAuth()

  const [logEntries, setLogEntries] = useState<TechnicalLogEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null)

  // Filtres
  const [filterLevel, setFilterLevel] = useState<TechnicalLogLevel | ''>('')
  const [filterService, setFilterService] = useState('')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')

  const isTi = hasRole('technicien_informatique')

  const loadLogs = (filters?: TechnicalLogFilters) => {
    setIsLoading(true)
    setLoadError(null)

    fetchTechnicalLogs(filters)
      .then((entries) => setLogEntries(entries))
      .catch(() => setLoadError('Impossible de charger les logs techniques.'))
      .finally(() => setIsLoading(false))
  }

  useEffect(() => {
    if (!isTi) return
    loadLogs()
  }, [isTi])

  const handleApplyFilters = (event: React.FormEvent) => {
    event.preventDefault()
    const filters: TechnicalLogFilters = {}
    if (filterLevel) filters.level = filterLevel
    if (filterService.trim()) filters.service = filterService.trim()
    if (filterFrom) filters.from = filterFrom
    if (filterTo) filters.to = filterTo
    loadLogs(filters)
  }

  const handleResetFilters = () => {
    setFilterLevel('')
    setFilterService('')
    setFilterFrom('')
    setFilterTo('')
    loadLogs()
  }

  const toggleLogExpansion = (logId: string) => {
    setExpandedLogId((previous) => (previous === logId ? null : logId))
  }

  if (!isTi) {
    return (
      <Layout>
        <p className="text-red-600 text-sm">
          Accès réservé aux techniciens informatiques.
        </p>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* En-tête */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Logs techniques</h1>
          <p className="text-gray-500 text-sm mt-1">
            Diagnostics, erreurs et traces des microservices VisioMath.
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
              <label htmlFor="filter-level" className="block text-xs text-gray-600 mb-1">
                Niveau
              </label>
              <select
                id="filter-level"
                value={filterLevel}
                onChange={(e) => setFilterLevel(e.target.value as TechnicalLogLevel | '')}
                className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Tous les niveaux</option>
                {AVAILABLE_LOG_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {level.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="filter-service" className="block text-xs text-gray-600 mb-1">
                Service
              </label>
              <input
                id="filter-service"
                type="text"
                value={filterService}
                onChange={(e) => setFilterService(e.target.value)}
                placeholder="ex: identity-access-service"
                className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label htmlFor="filter-from-tech" className="block text-xs text-gray-600 mb-1">
                Depuis
              </label>
              <input
                id="filter-from-tech"
                type="datetime-local"
                value={filterFrom}
                onChange={(e) => setFilterFrom(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label htmlFor="filter-to-tech" className="block text-xs text-gray-600 mb-1">
                Jusqu'au
              </label>
              <input
                id="filter-to-tech"
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
          <p className="text-gray-400 text-sm">Chargement des logs techniques…</p>
        )}

        {!isLoading && loadError && (
          <p className="text-red-600 text-sm">{loadError}</p>
        )}

        {!isLoading && !loadError && (
          <TechnicalLogList
            logEntries={logEntries}
            expandedLogId={expandedLogId}
            onToggleExpand={toggleLogExpansion}
          />
        )}
      </div>
    </Layout>
  )
}

// ─── Sous-composant : liste des logs techniques ───────────────────────────────

interface TechnicalLogListProps {
  logEntries: TechnicalLogEntry[]
  expandedLogId: string | null
  onToggleExpand: (logId: string) => void
}

export function TechnicalLogList({ logEntries, expandedLogId, onToggleExpand }: TechnicalLogListProps) {
  if (logEntries.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center">
        <p className="text-gray-400 text-sm">Aucun log technique trouvé.</p>
      </div>
    )
  }

  return (
    <ul className="space-y-2">
      {logEntries.map((logEntry) => (
        <li key={logEntry.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <button
            type="button"
            onClick={() => onToggleExpand(logEntry.id)}
            className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-gray-50 transition-colors"
          >
            <span
              className={`text-xs font-bold px-2 py-0.5 rounded shrink-0 mt-0.5 ${LOG_LEVEL_BADGE_CLASSES[logEntry.level]}`}
            >
              {logEntry.level.toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-gray-900 font-medium truncate">{logEntry.message}</p>
              <div className="flex gap-3 mt-0.5">
                {logEntry.service && (
                  <span className="text-xs text-indigo-600">{logEntry.service}</span>
                )}
                <span className="text-xs text-gray-400">
                  {new Date(logEntry.occurredAt).toLocaleString('fr-FR')}
                </span>
                {logEntry.traceId && (
                  <span className="text-xs text-gray-400 font-mono">trace:{logEntry.traceId}</span>
                )}
              </div>
            </div>
            <span className="text-gray-400 text-xs shrink-0">
              {expandedLogId === logEntry.id ? '▲' : '▼'}
            </span>
          </button>

          {expandedLogId === logEntry.id && logEntry.stackTrace && (
            <div className="border-t border-gray-100 px-4 py-3 bg-gray-50">
              <p className="text-xs font-semibold text-gray-600 mb-1">Stack trace</p>
              <pre className="text-xs text-gray-700 overflow-x-auto whitespace-pre-wrap font-mono">
                {logEntry.stackTrace}
              </pre>
            </div>
          )}
        </li>
      ))}
    </ul>
  )
}
