/**
 * ActivityGlobalExportPage — Phase 13 (learning-activity-service)
 *
 * Vue export global des activités — réservée aux rôles internes (RP, AP, TI, AF).
 * Permet de filtrer par statut et par période, et d'exporter la liste.
 *
 * Routes API consommées :
 *   GET /activities
 */

import React, { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import { useAuth } from '../hooks/useAuth'
import { fetchActivities, type Activity, type ActivityStatus } from '../api/learningActivity'

const STATUS_LABELS: Record<ActivityStatus, string> = {
  scheduled: 'Planifiée',
  ongoing: 'En cours',
  completed: 'Terminée',
  cancelled: 'Annulée',
}

const STATUS_BADGE_CLASSES: Record<ActivityStatus, string> = {
  scheduled: 'bg-blue-100 text-blue-700',
  ongoing: 'bg-green-100 text-green-700',
  completed: 'bg-gray-100 text-gray-500',
  cancelled: 'bg-red-100 text-red-700',
}

type StatusFilterOption = 'all' | ActivityStatus

export default function ActivityGlobalExportPage() {
  const { hasRole } = useAuth()

  const [activityList, setActivityList] = useState<Activity[]>([])
  const [isLoadingActivities, setIsLoadingActivities] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilterOption>('all')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  const isInternalUser = hasRole(
    'responsable_pedagogique',
    'animateur_pedagogique',
    'technicien_informatique',
    'administrateur_financier',
  )

  const loadActivities = () => {
    setIsLoadingActivities(true)
    setLoadError(null)

    fetchActivities({
      status: statusFilter !== 'all' ? statusFilter : undefined,
      from: fromDate || undefined,
      to: toDate || undefined,
    })
      .then((activities) => setActivityList(activities))
      .catch(() => setLoadError('Impossible de charger les activités.'))
      .finally(() => setIsLoadingActivities(false))
  }

  useEffect(() => {
    if (!isInternalUser) return
    loadActivities()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInternalUser])

  const handleApplyFilters = (event: React.FormEvent) => {
    event.preventDefault()
    loadActivities()
  }

  const handleExportCsv = () => {
    if (activityList.length === 0) return

    const csvHeader = 'ID,Titre,Statut,Début,Fin,Formateur,Élève\n'
    const csvRows = activityList
      .map((activity) =>
        [
          activity.id,
          `"${activity.title ?? ''}"`,
          activity.status,
          activity.startAt,
          activity.endAt,
          activity.teacherId ?? '',
          activity.studentId ?? '',
        ].join(','),
      )
      .join('\n')

    const csvContent = csvHeader + csvRows
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const downloadUrl = URL.createObjectURL(blob)
    const downloadLink = document.createElement('a')
    downloadLink.href = downloadUrl
    downloadLink.download = `activites-export-${new Date().toISOString().slice(0, 10)}.csv`
    downloadLink.click()
    URL.revokeObjectURL(downloadUrl)
  }

  if (!isInternalUser) {
    return (
      <Layout>
        <p className="text-red-600 text-sm">
          Accès réservé aux responsables pédagogiques, animateurs pédagogiques, techniciens
          informatiques et administrateurs financiers.
        </p>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* En-tête */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Export global des activités</h1>
            <p className="text-gray-500 text-sm mt-1">
              Vue d'ensemble de toutes les activités pédagogiques.
            </p>
          </div>
          {activityList.length > 0 && (
            <button
              type="button"
              onClick={handleExportCsv}
              className="px-4 py-2 bg-gray-800 text-white text-sm font-medium rounded-md hover:bg-gray-900 transition-colors"
            >
              Exporter CSV
            </button>
          )}
        </div>

        {/* Filtres */}
        <form
          onSubmit={handleApplyFilters}
          className="bg-white border border-gray-200 rounded-xl p-4"
        >
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label htmlFor="filter-status" className="block text-xs text-gray-500 mb-1">
                Statut
              </label>
              <select
                id="filter-status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilterOption)}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">Tous</option>
                <option value="scheduled">Planifiées</option>
                <option value="ongoing">En cours</option>
                <option value="completed">Terminées</option>
                <option value="cancelled">Annulées</option>
              </select>
            </div>
            <div>
              <label htmlFor="filter-from" className="block text-xs text-gray-500 mb-1">
                Du
              </label>
              <input
                id="filter-from"
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label htmlFor="filter-to" className="block text-xs text-gray-500 mb-1">
                Au
              </label>
              <input
                id="filter-to"
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 transition-colors"
            >
              Appliquer
            </button>
          </div>
        </form>

        {/* État de chargement */}
        {isLoadingActivities && (
          <p className="text-gray-400 text-sm">Chargement des activités…</p>
        )}

        {/* Erreur */}
        {loadError && <p className="text-red-600 text-sm">{loadError}</p>}

        {/* Résultats */}
        {!isLoadingActivities && !loadError && (
          <>
            <p className="text-sm text-gray-500">
              {activityList.length} activité{activityList.length !== 1 ? 's' : ''} trouvée
              {activityList.length !== 1 ? 's' : ''}
            </p>

            {activityList.length === 0 ? (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center">
                <p className="text-gray-400 text-sm">Aucune activité ne correspond aux filtres.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-xs text-gray-500 uppercase tracking-wide">
                      <th className="text-left py-2 pr-4">Titre</th>
                      <th className="text-left py-2 pr-4">Statut</th>
                      <th className="text-left py-2 pr-4">Début</th>
                      <th className="text-left py-2 pr-4">Fin</th>
                      <th className="text-left py-2 pr-4">Formateur</th>
                      <th className="text-left py-2">Élève</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activityList.map((activity) => (
                      <tr
                        key={activity.id}
                        className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                      >
                        <td className="py-3 pr-4 font-medium text-gray-900 max-w-xs truncate">
                          {activity.title ?? `Activité ${activity.id.slice(0, 8)}`}
                        </td>
                        <td className="py-3 pr-4">
                          <span
                            className={`text-xs px-2 py-0.5 rounded font-medium ${
                              STATUS_BADGE_CLASSES[activity.status]
                            }`}
                          >
                            {STATUS_LABELS[activity.status]}
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-gray-600">
                          {new Date(activity.startAt).toLocaleString('fr-FR', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="py-3 pr-4 text-gray-600">
                          {new Date(activity.endAt).toLocaleString('fr-FR', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="py-3 pr-4 text-gray-500 font-mono text-xs">
                          {activity.teacherId ? activity.teacherId.slice(0, 8) + '…' : '—'}
                        </td>
                        <td className="py-3 text-gray-500 font-mono text-xs">
                          {activity.studentId ? activity.studentId.slice(0, 8) + '…' : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  )
}
