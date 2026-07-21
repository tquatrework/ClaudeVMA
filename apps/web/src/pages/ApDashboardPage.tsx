/**
 * ApDashboardPage — Dashboard Animateur Pédagogique
 * Accent : Ambre oklch(0.65 0.13 65)
 */

import React from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import DashboardShell from '../components/dashboard/DashboardShell'
import '../styles/tokens.css'
import { getRailGroupsForRole, filterTopNavItems } from '../navigation/navigationConfig'
import { ActivityFeed } from '../components/ui/ActivityFeed'
import { PageTitle } from '../components/ui/PageTitle'
import { useDashboardNotifications } from '../hooks/dashboard/useDashboardNotifications'

export default function ApDashboardPage() {
  const { user, hasRole } = useAuth()
  const firstName = user?.loginIdentifier ?? 'vous'

  const { notifications, isLoadingNotifications } = useDashboardNotifications(6)

  const topNavItems = filterTopNavItems('animateur_pedagogique', hasRole)
  const railGroups = getRailGroupsForRole('animateur_pedagogique')

  return (
    <DashboardShell
      accentClass="role-ap"
      railGroups={railGroups}
      topNavItems={topNavItems}
      userName={firstName}
      userRole="Animateur pédagogique"
    >
      {/* Salutation */}
      <PageTitle title={`Bonjour, ${firstName}`} subtitle="Animateur pédagogique — espace de coordination" />

      {/* Stats rapides */}
      <div
        style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '28px' }}
        className="vm-ap-stats"
      >
        {[
          { label: 'Contenus en attente', value: '—', isAlert: false },
          { label: 'Contenus publiés', value: '—', isAlert: false },
          { label: 'Parcours actifs', value: '—', isAlert: false },
        ].map((stat) => (
          <div
            key={stat.label}
            style={{
              background: 'var(--color-white)',
              border: `1px solid ${stat.isAlert ? 'var(--accent)' : 'var(--color-surface)'}`,
              borderRadius: 'var(--radius-card)',
              boxShadow: 'var(--shadow-card)',
              padding: '16px 20px',
              textAlign: 'center',
            }}
          >
            <p
              style={{
                fontSize: '28px',
                fontFamily: 'var(--font-heading)',
                fontWeight: 700,
                color: stat.isAlert ? 'var(--accent)' : 'var(--color-ink)',
                margin: 0,
              }}
            >
              {stat.value}
            </p>
            <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
              {stat.label}
            </p>
          </div>
        ))}
      </div>

      {/* Grille : Contenus en attente + Activité forums */}
      <div
        style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}
        className="vm-grid-ap"
      >
        {/* Contenus en attente de validation */}
        <div
          style={{
            background: 'var(--color-white)',
            border: '1px solid var(--color-surface)',
            borderRadius: 'var(--radius-card)',
            boxShadow: 'var(--shadow-card)',
            padding: '20px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3
              style={{
                fontFamily: 'var(--font-heading)',
                fontSize: '15px',
                fontWeight: 600,
                color: 'var(--color-ink)',
                margin: 0,
              }}
            >
              Contenus à valider
            </h3>
            <Link
              to="/content/validation"
              style={{ fontSize: '12px', color: 'var(--accent)', textDecoration: 'none' }}
            >
              Voir tout →
            </Link>
          </div>

          <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
            Aucun contenu en attente.
          </p>
        </div>

        {/* Activité des forums */}
        <div
          style={{
            background: 'var(--color-white)',
            border: '1px solid var(--color-surface)',
            borderRadius: 'var(--radius-card)',
            boxShadow: 'var(--shadow-card)',
            padding: '20px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3
              style={{
                fontFamily: 'var(--font-heading)',
                fontSize: '15px',
                fontWeight: 600,
                color: 'var(--color-ink)',
                margin: 0,
              }}
            >
              Mes forums
            </h3>
            <Link
              to="/community/forums"
              style={{ fontSize: '12px', color: 'var(--accent)', textDecoration: 'none' }}
            >
              Voir tout →
            </Link>
          </div>

          <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
            Aucun forum actif pour l'instant.
          </p>
        </div>
      </div>

      {/* Activité récente */}
      <div
        style={{
          background: 'var(--color-white)',
          border: '1px solid var(--color-surface)',
          borderRadius: 'var(--radius-card)',
          boxShadow: 'var(--shadow-card)',
          padding: '20px',
          marginTop: '24px',
        }}
      >
        <ActivityFeed notifications={notifications} isLoading={isLoadingNotifications} />
      </div>

      <style>{`
        @media (max-width: 768px) {
          .vm-ap-stats { grid-template-columns: 1fr 1fr !important; }
          .vm-grid-ap { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 480px) {
          .vm-ap-stats { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </DashboardShell>
  )
}
