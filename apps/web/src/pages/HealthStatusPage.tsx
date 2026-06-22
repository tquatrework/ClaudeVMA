/**
 * HealthStatusPage — Phase 15 (admin-observability-service)
 *
 * Vue détaillée de l'état de santé de tous les microservices (TI).
 *
 * Routes API consommées :
 *   GET /admin/health
 */

import React, { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import { useAuth } from '../hooks/useAuth'
import {
  fetchHealthStatus,
  type HealthStatusReport,
  type ServiceHealthStatus,
} from '../api/adminObservability'

const HEALTH_STATUS_LABELS: Record<ServiceHealthStatus, string> = {
  healthy: 'Opérationnel',
  degraded: 'Dégradé',
  down: 'Hors service',
  unknown: 'Inconnu',
}

const HEALTH_STATUS_BADGE_CLASSES: Record<ServiceHealthStatus, string> = {
  healthy: 'bg-green-100 text-green-700',
  degraded: 'bg-yellow-100 text-yellow-700',
  down: 'bg-red-100 text-red-700',
  unknown: 'bg-gray-100 text-gray-500',
}

const OVERALL_STATUS_BANNER_CLASSES: Record<ServiceHealthStatus, string> = {
  healthy: 'bg-green-50 border-green-200 text-green-800',
  degraded: 'bg-yellow-50 border-yellow-200 text-yellow-800',
  down: 'bg-red-50 border-red-200 text-red-800',
  unknown: 'bg-gray-50 border-gray-200 text-gray-700',
}

export default function HealthStatusPage() {
  const { hasRole } = useAuth()

  const [healthReport, setHealthReport] = useState<HealthStatusReport | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const isTi = hasRole('technicien_informatique')
  const isRp = hasRole('responsable_pedagogique')
  const canAccess = isTi || isRp

  const loadHealthReport = () => {
    setIsLoading(true)
    setLoadError(null)

    fetchHealthStatus()
      .then((report) => setHealthReport(report))
      .catch(() => setLoadError('Impossible de récupérer l\'état des services.'))
      .finally(() => setIsLoading(false))
  }

  useEffect(() => {
    if (!canAccess) return
    loadHealthReport()
  }, [canAccess])

  if (!canAccess) {
    return (
      <Layout>
        <p className="text-red-600 text-sm">
          Accès réservé aux techniciens informatiques et responsables pédagogiques.
        </p>
      </Layout>
    )
  }

  if (isLoading) {
    return (
      <Layout>
        <p className="text-gray-400 text-sm">Vérification de l'état des services…</p>
      </Layout>
    )
  }

  if (loadError) {
    return (
      <Layout>
        <div className="space-y-4">
          <h1 className="text-2xl font-bold text-gray-900">État des services</h1>
          <p className="text-red-600 text-sm">{loadError}</p>
          <button
            type="button"
            onClick={loadHealthReport}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 transition-colors"
          >
            Réessayer
          </button>
        </div>
      </Layout>
    )
  }

  const overallStatus = healthReport?.overallStatus ?? 'unknown'

  return (
    <Layout>
      <div className="space-y-6">
        {/* En-tête */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">État des services</h1>
            <p className="text-gray-500 text-sm mt-1">
              Santé en temps réel de tous les microservices VisioMath.
            </p>
          </div>
          <button
            type="button"
            onClick={loadHealthReport}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
          >
            Actualiser
          </button>
        </div>

        {healthReport && (
          <>
            {/* Bannière état global */}
            <div
              className={`border rounded-xl p-4 ${OVERALL_STATUS_BANNER_CLASSES[overallStatus]}`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">État global de l'infrastructure</p>
                  <p className="text-xs mt-0.5">
                    Vérifié le {new Date(healthReport.checkedAt).toLocaleString('fr-FR')}
                  </p>
                </div>
                <span
                  className={`text-sm font-bold px-3 py-1 rounded-full ${HEALTH_STATUS_BADGE_CLASSES[overallStatus]}`}
                >
                  {HEALTH_STATUS_LABELS[overallStatus]}
                </span>
              </div>
            </div>

            {/* Détail par service */}
            {healthReport.services.length > 0 ? (
              <div>
                <h2 className="text-base font-semibold text-gray-800 mb-3">
                  Détail des services ({healthReport.services.length})
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {healthReport.services.map((serviceInfo) => (
                    <div
                      key={serviceInfo.service}
                      className="bg-white border border-gray-200 rounded-xl p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-gray-900 truncate">
                            {serviceInfo.service}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            Vérifié {new Date(serviceInfo.lastCheckedAt).toLocaleString('fr-FR')}
                          </p>
                          {serviceInfo.responseTimeMs !== undefined && (
                            <p className="text-xs text-gray-500 mt-0.5">
                              Temps de réponse : {serviceInfo.responseTimeMs} ms
                            </p>
                          )}
                        </div>
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded shrink-0 ${HEALTH_STATUS_BADGE_CLASSES[serviceInfo.status]}`}
                        >
                          {HEALTH_STATUS_LABELS[serviceInfo.status]}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center">
                <p className="text-gray-400 text-sm">Aucun service remonté pour le moment.</p>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  )
}
