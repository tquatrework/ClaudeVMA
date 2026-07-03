/**
 * TiAdminDashboard — Dashboard Technicien Informatique
 * Accent : Ardoise foncée oklch(0.45 0.06 250)
 * RP et AF ont accès en lecture à ce dashboard.
 */

import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import DashboardShell from '../components/dashboard/DashboardShell'
import type { NavItem } from '../types/navigation'
import { fetchHealthStatus, type HealthStatusReport, type ServiceHealthStatus } from '../api/adminObservability'
import { getRailGroupsForRole } from '../navigation/navigationConfig'
import { useCanAccess } from '../navigation/navigationFilters'
import '../styles/tokens.css'

const HEALTH_STATUS_LABELS: Record<ServiceHealthStatus, string> = {
  healthy: 'Opérationnel',
  degraded: 'Dégradé',
  down: 'Hors service',
  unknown: 'Inconnu',
}

const HEALTH_STATUS_COLORS: Record<ServiceHealthStatus, { bg: string; text: string }> = {
  healthy: { bg: '#f0fdf4', text: '#16a34a' },
  degraded: { bg: '#fefce8', text: '#ca8a04' },
  down: { bg: '#fef2f2', text: '#dc2626' },
  unknown: { bg: '#f9fafb', text: '#6b7280' },
}

// La topbar du dashboard TI est fixe — ces items sont tous accessibles
// aux rôles TI/RP/AF qui ont accès à ce dashboard.
// Les liens qui pointent vers des routes restreintes (ex: /admin/observability/technical-logs)
// seront filtrés dynamiquement dans le composant via useCanAccess.
const ALL_TOP_NAV_ITEMS: NavItem[] = [
  { label: 'Accueil', path: '/admin/observability' },
  { label: 'Messages', path: '/messages' },
  { label: 'Activité', path: '/admin/observability/activity-log' },
  { label: 'Logs', path: '/admin/observability/technical-logs' },
  { label: 'Santé services', path: '/admin/observability/health' },
  { label: 'Incidents', path: '/incidents' },
]

const ALL_ADMIN_TOOL_LINKS = [
  { label: 'Logs d\'activité', path: '/admin/observability/activity-log', description: 'Actions utilisateurs horodatées' },
  { label: 'Logs techniques', path: '/admin/observability/technical-logs', description: 'Erreurs et diagnostics services' },
  { label: 'Masquages temporaires', path: '/admin/observability/visibility-overrides', description: 'Overrides de visibilité' },
  { label: 'Métadonnées du site', path: '/admin/observability/site-metadata', description: 'Bannières et mode maintenance' },
  { label: 'Incidents', path: '/incidents', description: 'Gestion des incidents ouverts' },
  { label: 'Workflows', path: '/admin/orchestration/workflows', description: 'Suivi des instances de workflow' },
]

export default function TiAdminDashboard() {
  const { user, hasRole } = useAuth()
  const { checkAccess } = useCanAccess()
  const firstName = user?.loginIdentifier ?? 'vous'

  const [healthReport, setHealthReport] = useState<HealthStatusReport | null>(null)
  const [isLoadingHealth, setIsLoadingHealth] = useState(true)

  const isTi = hasRole('technicien_informatique')
  const isRp = hasRole('responsable_pedagogique')
  const isAf = hasRole('administrateur_financier')
  const hasDashboardAccess = isTi || isRp || isAf

  // Filtrer la topbar et les outils selon les droits réels du rôle courant
  const visibleTopNavItems = ALL_TOP_NAV_ITEMS.filter((item) => checkAccess(item.path))
  const visibleAdminToolLinks = ALL_ADMIN_TOOL_LINKS.filter((adminLink) =>
    checkAccess(adminLink.path),
  )

  // Rail gauche depuis la config centralisée (déjà scopé par rôle)
  const railGroups = user ? getRailGroupsForRole(user.role) : []

  useEffect(() => {
    if (!hasDashboardAccess) return

    fetchHealthStatus()
      .then((report) => setHealthReport(report))
      .catch(() => setHealthReport(null))
      .finally(() => setIsLoadingHealth(false))
  }, [hasDashboardAccess])

  if (!hasDashboardAccess) {
    return (
      <div style={{ padding: '32px', fontFamily: 'var(--font-body)' }}>
        <p style={{ color: '#dc2626', fontSize: '14px' }}>
          Accès réservé aux techniciens informatiques, responsables pédagogiques et administrateurs financiers.
        </p>
      </div>
    )
  }

  const overallStatus: ServiceHealthStatus = healthReport?.overallStatus ?? 'unknown'
  const overallColors = HEALTH_STATUS_COLORS[overallStatus]

  // Séparer les services en alertes et sains
  const alertServices = (healthReport?.services ?? []).filter(
    (service) => service.status !== 'healthy',
  )
  const healthyServices = (healthReport?.services ?? []).filter(
    (service) => service.status === 'healthy',
  )

  return (
    <DashboardShell
      accentClass="role-ti"
      railGroups={railGroups}
      topNavItems={visibleTopNavItems}
      userName={firstName}
      userRole="Technicien informatique"
    >
      {/* Salutation */}
      <div style={{ marginBottom: '24px' }}>
        <h1
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: '24px',
            fontWeight: 700,
            color: 'var(--color-ink)',
            margin: 0,
          }}
        >
          Administration technique
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
          Observabilité, support et gestion de l'infrastructure VisioMath
        </p>
      </div>

      {/* Bloc santé globale */}
      <div
        style={{
          background: 'var(--color-white)',
          border: `1px solid ${overallColors.bg === '#f0fdf4' ? '#bbf7d0' : overallColors.bg === '#fefce8' ? '#fde68a' : overallColors.bg === '#fef2f2' ? '#fecaca' : 'var(--color-surface)'}`,
          borderRadius: 'var(--radius-card)',
          boxShadow: 'var(--shadow-card)',
          padding: '20px',
          marginBottom: '24px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div>
            <h2
              style={{
                fontFamily: 'var(--font-heading)',
                fontSize: '15px',
                fontWeight: 600,
                color: 'var(--color-ink)',
                margin: '0 0 4px',
              }}
            >
              État de l'infrastructure
            </h2>
            {isLoadingHealth ? (
              <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: 0 }}>
                Vérification en cours…
              </p>
            ) : healthReport ? (
              <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: 0 }}>
                Vérifié le {new Date(healthReport.checkedAt).toLocaleString('fr-FR')}
              </p>
            ) : (
              <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: 0 }}>
                Impossible de récupérer l'état
              </p>
            )}
          </div>
          {!isLoadingHealth && (
            <span
              style={{
                fontSize: '12px',
                fontWeight: 700,
                color: overallColors.text,
                background: overallColors.bg,
                borderRadius: 'var(--radius-pill)',
                padding: '4px 12px',
              }}
            >
              {HEALTH_STATUS_LABELS[overallStatus]}
            </span>
          )}
        </div>

        {/* Alertes en premier */}
        {alertServices.length > 0 && (
          <div style={{ marginBottom: '12px' }}>
            <p style={{ fontSize: '11px', fontWeight: 600, color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
              Services en anomalie
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px' }}>
              {alertServices.map((serviceInfo) => {
                const serviceColors = HEALTH_STATUS_COLORS[serviceInfo.status]
                return (
                  <div
                    key={serviceInfo.service}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 12px',
                      background: serviceColors.bg,
                      borderRadius: 'var(--radius-field)',
                      border: '1px solid transparent',
                    }}
                  >
                    <span style={{ fontSize: '12px', color: 'var(--color-ink)', fontWeight: 500 }}>
                      {serviceInfo.service}
                    </span>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: serviceColors.text, marginLeft: '8px' }}>
                      {HEALTH_STATUS_LABELS[serviceInfo.status]}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Services sains */}
        {healthyServices.length > 0 && (
          <div>
            <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
              Services opérationnels ({healthyServices.length})
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '6px' }}>
              {healthyServices.slice(0, 8).map((serviceInfo) => (
                <div
                  key={serviceInfo.service}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '7px 12px',
                    background: 'var(--color-bg)',
                    borderRadius: 'var(--radius-field)',
                  }}
                >
                  <span style={{ fontSize: '12px', color: 'var(--color-ink)' }}>
                    {serviceInfo.service}
                  </span>
                  <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 600, marginLeft: '8px' }}>
                    OK
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <Link
          to="/admin/observability/health"
          style={{
            display: 'inline-block',
            marginTop: '16px',
            fontSize: '12px',
            color: 'var(--accent)',
            textDecoration: 'none',
          }}
        >
          Vue détaillée →
        </Link>
      </div>

      {/* Outils d'administration */}
      <div>
        <h2
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: '15px',
            fontWeight: 600,
            color: 'var(--color-ink)',
            marginBottom: '12px',
          }}
        >
          Outils d'administration
        </h2>
        <div
          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '10px' }}
        >
          {visibleAdminToolLinks.map((adminLink) => (
            <Link
              key={adminLink.path}
              to={adminLink.path}
              style={{
                display: 'block',
                padding: '16px',
                background: 'var(--color-white)',
                border: '1px solid var(--color-surface)',
                borderRadius: 'var(--radius-card)',
                boxShadow: 'var(--shadow-card)',
                textDecoration: 'none',
              }}
            >
              <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-ink)', margin: '0 0 4px' }}>
                {adminLink.label}
              </p>
              <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: 0 }}>
                {adminLink.description}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </DashboardShell>
  )
}
