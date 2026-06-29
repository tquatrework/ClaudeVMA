/**
 * RpDashboardPage — Dashboard Responsable Pédagogique
 * Accent : Prune oklch(0.58 0.13 330)
 */

import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import DashboardShell, { RailGroup, NavItem } from '../components/dashboard/DashboardShell'
import apiClient from '../api/client'
import '../styles/tokens.css'

interface TeacherRequest {
  id: string
  status: string
  createdAt: string
}

interface Notification {
  id: string
  message: string
  read: boolean
  createdAt: string
}

const TOP_NAV_ITEMS: NavItem[] = [
  { label: 'Accueil', path: '/dashboard' },
  { label: 'Calendrier', path: '/calendar' },
  { label: 'Messages', path: '/messages' },
  { label: 'Demandes prof.', path: '/rp/teacher-requests' },
  { label: 'Comptes', path: '/admin/accounts' },
  { label: 'Admin', path: '/admin/activity' },
]

const RAIL_GROUPS: RailGroup[] = [
  {
    groupLabel: 'Gestion',
    items: [
      { label: 'Demandes professeurs', path: '/rp/teacher-requests', icon: '🎓' },
      { label: 'Formateurs', path: '/admin/accounts', icon: '👨‍🏫' },
      { label: 'Élèves', path: '/admin/accounts', icon: '🎒' },
    ],
  },
  {
    groupLabel: 'Pédagogie',
    items: [
      { label: 'Contenus à valider', path: '/content/validation', icon: '✅' },
      { label: 'Cahier de texte', path: '/pedagogical-log', icon: '📖' },
      { label: 'Archives', path: '/archives', icon: '🗂️' },
    ],
  },
  {
    groupLabel: 'Observabilité',
    items: [
      { label: 'Activité globale', path: '/admin/activity', icon: '📊' },
      { label: 'Santé services', path: '/admin/observability/health', icon: '❤️' },
      { label: 'Incidents', path: '/incidents', icon: '⚠️' },
    ],
  },
]

interface ActionItem {
  label: string
  count: number
  path: string
  urgency: 'high' | 'medium' | 'low'
}

export default function RpDashboardPage() {
  const { user } = useAuth()
  const firstName = user?.loginIdentifier ?? 'vous'

  const [pendingRequestCount, setPendingRequestCount] = useState<number | null>(null)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isLoadingRequests, setIsLoadingRequests] = useState(true)
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(true)

  useEffect(() => {
    if (!user) return

    apiClient
      .get<TeacherRequest[]>('/requests')
      .then(({ data }) => {
        const pendingCount = (Array.isArray(data) ? data : []).filter(
          (request) => request.status === 'pending',
        ).length
        setPendingRequestCount(pendingCount)
      })
      .catch(() => setPendingRequestCount(0))
      .finally(() => setIsLoadingRequests(false))

    apiClient
      .get<{ data?: Notification[] } | Notification[]>('/notifications')
      .then(({ data }) => {
        const notificationList = Array.isArray(data) ? data : (data.data ?? [])
        setNotifications(notificationList.slice(0, 8))
      })
      .catch(() => {})
      .finally(() => setIsLoadingNotifications(false))
  }, [user])

  const actionItems: ActionItem[] = [
    {
      label: 'Demandes professeur en attente',
      count: pendingRequestCount ?? 0,
      path: '/rp/teacher-requests',
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
      railGroups={RAIL_GROUPS}
      topNavItems={TOP_NAV_ITEMS}
      userName={firstName}
      userRole="Responsable pédagogique"
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
          Bonjour, {firstName}
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
          Responsable pédagogique — vue de coordination
        </p>
      </div>

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
            label: 'Formateurs actifs',
            value: '—', // TODO: brancher API
            isAlert: false,
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
          <h3
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: '15px',
              fontWeight: 600,
              color: 'var(--color-ink)',
              margin: '0 0 16px',
            }}
          >
            Activité récente
          </h3>

          {isLoadingNotifications ? (
            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>Chargement…</p>
          ) : notifications.length === 0 ? (
            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
              Aucune activité récente
            </p>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {notifications.map((notification) => (
                <li
                  key={notification.id}
                  style={{
                    display: 'flex',
                    gap: '12px',
                    alignItems: 'flex-start',
                    padding: '10px 0',
                    borderBottom: '1px solid var(--color-surface)',
                  }}
                >
                  <div
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: notification.read ? 'var(--color-surface)' : 'var(--accent)',
                      flexShrink: 0,
                      marginTop: '5px',
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p
                      style={{
                        fontSize: '13px',
                        color: 'var(--color-ink)',
                        margin: '0 0 2px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        fontWeight: notification.read ? 400 : 500,
                      }}
                    >
                      {notification.message}
                    </p>
                    <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', margin: 0 }}>
                      {new Date(notification.createdAt).toLocaleString('fr-FR', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
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
