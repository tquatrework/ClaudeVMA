/**
 * TiAdminDashboard — Phase 15 (admin-observability-service)
 *
 * Tableau de bord TI : accès rapide aux outils d'administration technique.
 * Réservé au technicien informatique (TI).
 *
 * Routes API consommées :
 *   GET /admin/health
 */

import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { useAuth } from '../hooks/useAuth'
import { fetchHealthStatus, type HealthStatusReport, type ServiceHealthStatus } from '../api/adminObservability'

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

const ADMIN_LINKS = [
  { label: 'Logs d\'activité', path: '/admin/observability/activity-log', description: 'Consulter les actions utilisateurs' },
  { label: 'Logs techniques', path: '/admin/observability/technical-logs', description: 'Erreurs et diagnostics des services' },
  { label: 'Masquages temporaires', path: '/admin/observability/visibility-overrides', description: 'Gérer les overrides de visibilité' },
  { label: 'État des services', path: '/admin/observability/health', description: 'Santé de l\'infrastructure' },
  { label: 'Métadonnées du site', path: '/admin/observability/site-metadata', description: 'Bannières, maintenance et contacts' },
]

export default function TiAdminDashboard() {
  const { hasRole } = useAuth()
  const navigate = useNavigate()

  const [healthReport, setHealthReport] = useState<HealthStatusReport | null>(null)
  const [isLoadingHealth, setIsLoadingHealth] = useState(true)

  const isTi = hasRole('technicien_informatique')
  const isRp = hasRole('responsable_pedagogique')
  const isAf = hasRole('administrateur_financier')

  const canAccess = isTi || isRp || isAf

  useEffect(() => {
    if (!canAccess) return

    setIsLoadingHealth(true)
    fetchHealthStatus()
      .then((report) => setHealthReport(report))
      .catch(() => setHealthReport(null))
      .finally(() => setIsLoadingHealth(false))
  }, [canAccess])

  if (!canAccess) {
    return (
      <Layout>
        <p className="text-red-600 text-sm">
          Accès réservé aux techniciens informatiques, responsables pédagogiques et administrateurs financiers.
        </p>
      </Layout>
    )
  }

  const overallStatus = healthReport?.overallStatus ?? 'unknown'

  return (
    <Layout>
      <div className="space-y-6">
        {/* En-tête */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Administration technique</h1>
          <p className="text-gray-500 text-sm mt-1">
            Outils d'observabilité, de support et de gestion de l'infrastructure VisioMath.
          </p>
        </div>

        {/* Résumé santé */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700">État global de l'infrastructure</p>
              {isLoadingHealth ? (
                <p className="text-gray-400 text-xs mt-1">Vérification en cours…</p>
              ) : healthReport ? (
                <p className="text-xs text-gray-500 mt-1">
                  Vérifié le {new Date(healthReport.checkedAt).toLocaleString('fr-FR')}
                </p>
              ) : (
                <p className="text-xs text-gray-400 mt-1">Impossible de récupérer l'état.</p>
              )}
            </div>
            {!isLoadingHealth && (
              <span
                className={`text-xs font-medium px-3 py-1 rounded-full ${HEALTH_STATUS_BADGE_CLASSES[overallStatus]}`}
              >
                {HEALTH_STATUS_LABELS[overallStatus]}
              </span>
            )}
          </div>

          {healthReport && healthReport.services.length > 0 && (
            <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-2">
              {healthReport.services.slice(0, 6).map((serviceInfo) => (
                <div
                  key={serviceInfo.service}
                  className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2"
                >
                  <span className="text-xs text-gray-700 truncate">{serviceInfo.service}</span>
                  <span
                    className={`text-xs font-medium ml-2 px-2 py-0.5 rounded ${HEALTH_STATUS_BADGE_CLASSES[serviceInfo.status]}`}
                  >
                    {HEALTH_STATUS_LABELS[serviceInfo.status]}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Navigation rapide */}
        <div>
          <h2 className="text-base font-semibold text-gray-800 mb-3">Accès rapide</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {ADMIN_LINKS.map((adminLink) => (
              <button
                key={adminLink.path}
                type="button"
                onClick={() => navigate(adminLink.path)}
                className="text-left bg-white border border-gray-200 rounded-xl p-4 hover:border-indigo-300 hover:shadow-sm transition-all"
              >
                <p className="text-sm font-semibold text-gray-900">{adminLink.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{adminLink.description}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  )
}
