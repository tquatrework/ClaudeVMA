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
import { fetchHealthStatus, type HealthStatusReport } from '../api/adminObservability'
import { getRailGroupsForRole } from '../navigation/navigationConfig'
import { useCanAccess } from '../navigation/navigationFilters'
import { InfrastructureHealthCard } from '../components/admin/InfrastructureHealthCard'
import '../styles/tokens.css'

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
      <InfrastructureHealthCard healthReport={healthReport} isLoadingHealth={isLoadingHealth} />

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
