/**
 * RpDashboardPage — Dashboard Responsable Pédagogique
 * Accent : Prune oklch(0.58 0.13 330)
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
import { usePendingTeacherRequestCount } from '../hooks/dashboard/usePendingTeacherRequestCount'
import { usePendingTeacherValidationCount } from '../hooks/dashboard/usePendingTeacherValidationCount'

interface ActionItem {
  label: string
  count: number
  path: string
  urgency: 'high' | 'medium' | 'low'
}

export default function RpDashboardPage() {
  const { user, hasRole } = useAuth()
  const firstName = user?.loginIdentifier ?? 'vous'

  const { pendingRequestCount, isLoadingRequests } = usePendingTeacherRequestCount()
  const { pendingTeacherCount, isLoadingTeacherCount } = usePendingTeacherValidationCount()
  const { notifications, isLoadingNotifications } = useDashboardNotifications(8)

  const topNavItems = filterTopNavItems('responsable_pedagogique', hasRole)
  const railGroups = getRailGroupsForRole('responsable_pedagogique')

  // Les deux files du plan de travail du RP (arbitrage du 2026-08-12) en tête,
  // dans le même ordre que le rail.
  const actionItems: ActionItem[] = [
    {
      label: 'Nouveaux formateurs à examiner',
      count: pendingTeacherCount ?? 0,
      path: '/rp/teacher-validations',
      urgency: pendingTeacherCount && pendingTeacherCount > 0 ? 'high' : 'low',
    },
    {
      label: 'Demandes professeur en attente',
      count: pendingRequestCount ?? 0,
      path: '/teacher-requests',
      urgency: pendingRequestCount && pendingRequestCount > 0 ? 'high' : 'low',
    },
    {
      label: 'Contenus à valider',
      count: 0, // TODO: brancher API content validation
      path: '/content/validation',
      urgency: 'medium',
    },
    {
      label: 'Comptes à valider',
      count: 0, // TODO: brancher API account validation
      path: '/admin/accounts',
      urgency: 'medium',
    },
  ]

  const urgencyColors: Record<ActionItem['urgency'], { bg: string; text: string; border: string }> = {
    high: { bg: '#fef2f2', text: '#b91c1c', border: '#fecaca' },
    medium: { bg: '#fff7ed', text: '#c2410c', border: '#fed7aa' },
    low: { bg: 'var(--color-bg)', text: 'var(--color-text-secondary)', border: 'var(--color-surface)' },
  }

  return (
    <DashboardShell
      accentClass="role-rp"
      railGroups={railGroups}
      topNavItems={topNavItems}
      userName={firstName}
      userRole="Responsable pédagogique"
    >
      {/* Salutation */}
      <PageTitle title={`Bonjour, ${firstName}`} subtitle="Responsable pédagogique — vue de coordination" />

      {/* Stats rapides */}
      <div
        style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '28px' }}
        className="vm-stats-grid"
      >
        {[
          {
            label: 'Demandes ouvertes',
            value: isLoadingRequests ? '…' : String(pendingRequestCount ?? 0),
            isAlert: (pendingRequestCount ?? 0) > 0,
          },
          {
            label: 'Formateurs à examiner',
            value: isLoadingTeacherCount ? '…' : String(pendingTeacherCount ?? 0),
            isAlert: (pendingTeacherCount ?? 0) > 0,
          },
          {
            label: 'Contenus en attente',
            value: '—', // TODO: brancher API
            isAlert: false,
          },
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

      {/* Grille : Actions + Activité récente */}
      <div
        style={{ display: 'grid', gridTemplateColumns: '2fr 3fr', gap: '24px' }}
        className="vm-grid-rp"
      >
        {/* Actions à traiter */}
        <div
          style={{
            background: 'var(--color-white)',
            border: '1px solid var(--color-surface)',
            borderRadius: 'var(--radius-card)',
            boxShadow: 'var(--shadow-card)',
            padding: '20px',
          }}
        >
          <h3
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: '15px',
              fontWeight: 600,
              color: 'var(--color-ink)',
              margin: '0 0 16px',
            }}
          >
            Actions à traiter
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {actionItems.map((actionItem) => {
              const colors = urgencyColors[actionItem.urgency]
              return (
                <Link
                  key={actionItem.path}
                  to={actionItem.path}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px 14px',
                    background: colors.bg,
                    border: `1px solid ${colors.border}`,
                    borderRadius: 'var(--radius-field)',
                    textDecoration: 'none',
                  }}
                >
                  <span style={{ fontSize: '13px', color: 'var(--color-ink)', fontWeight: 500 }}>
                    {actionItem.label}
                  </span>
                  <span
                    style={{
                      fontSize: '13px',
                      fontWeight: 700,
                      color: colors.text,
                      minWidth: '24px',
                      textAlign: 'center',
                    }}
                  >
                    {actionItem.count}
                  </span>
                </Link>
              )
            })}
          </div>

          {/* Accès rapide */}
          <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--color-surface)' }}>
            <p
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--color-text-secondary)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                marginBottom: '10px',
              }}
            >
              Accès direct
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {[
                { label: 'Gérer les comptes', path: '/admin/accounts' },
                { label: 'Délégations', path: '/delegations' },
                { label: 'Activité globale', path: '/admin/activity' },
              ].map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  style={{
                    fontSize: '12px',
                    color: 'var(--accent)',
                    textDecoration: 'none',
                    padding: '4px 0',
                  }}
                >
                  {link.label} →
                </Link>
              ))}
            </div>
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
          }}
        >
          <ActivityFeed notifications={notifications} isLoading={isLoadingNotifications} />
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .vm-stats-grid { grid-template-columns: 1fr 1fr !important; }
          .vm-grid-rp { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 600px) {
          .vm-stats-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </DashboardShell>
  )
}
