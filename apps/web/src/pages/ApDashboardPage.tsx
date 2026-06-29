/**
 * ApDashboardPage — Dashboard Animateur Pédagogique
 * Accent : Ambre oklch(0.65 0.13 65)
 */

import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import DashboardShell, { RailGroup, NavItem } from '../components/dashboard/DashboardShell'
import apiClient from '../api/client'
import '../styles/tokens.css'

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
  { label: 'Contenus', path: '/content/validation' },
  { label: 'Forums', path: '/community/forums' },
  { label: 'Parcours', path: '/community/paths' },
]

const RAIL_GROUPS: RailGroup[] = [
  {
    groupLabel: 'Mes contenus',
    items: [
      { label: 'Exercices', path: '/content/exercises', icon: '📐' },
      { label: 'Évaluations', path: '/content/evaluations', icon: '📝' },
      { label: 'Tutoriels vidéo', path: '/content/tutorials', icon: '🎬' },
      { label: 'File de validation', path: '/content/validation', icon: '✅' },
    ],
  },
  {
    groupLabel: 'Communauté',
    items: [
      { label: 'Forums', path: '/community/forums', icon: '💬' },
      { label: 'Parcours', path: '/community/paths', icon: '🗺️' },
    ],
  },
  {
    groupLabel: 'Suivi',
    items: [
      { label: 'Cahier de texte', path: '/pedagogical-log', icon: '📖' },
      { label: 'Activités non pourvues', path: '/open-activities', icon: '📢' },
      { label: 'Activité globale', path: '/admin/activity', icon: '📊' },
    ],
  },
]

export default function ApDashboardPage() {
  const { user } = useAuth()
  const firstName = user?.loginIdentifier ?? 'vous'

  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(true)

  // TODO: brancher API contenus en attente de validation
  const mockPendingContents = [
    { id: '1', title: 'Exercice intégration par parties', type: 'Exercice', submittedBy: 'M. Dupont', submittedAt: '2026-06-28T10:00:00Z' },
    { id: '2', title: 'Évaluation Suites numériques', type: 'Évaluation', submittedBy: 'Mme Martin', submittedAt: '2026-06-27T14:00:00Z' },
  ]

  // TODO: brancher API forums
  const mockForumActivity = [
    { id: '1', title: 'Forum Terminale Spécialité', newMessages: 5, lastActivity: '2026-06-29T08:30:00Z' },
    { id: '2', title: 'Espace Première Maths', newMessages: 2, lastActivity: '2026-06-28T16:00:00Z' },
  ]

  useEffect(() => {
    if (!user) return

    apiClient
      .get<{ data?: Notification[] } | Notification[]>('/notifications')
      .then(({ data }) => {
        const notificationList = Array.isArray(data) ? data : (data.data ?? [])
        setNotifications(notificationList.slice(0, 6))
      })
      .catch(() => {})
      .finally(() => setIsLoadingNotifications(false))
  }, [user])

  return (
    <DashboardShell
      accentClass="role-ap"
      railGroups={RAIL_GROUPS}
      topNavItems={TOP_NAV_ITEMS}
      userName={firstName}
      userRole="Animateur pédagogique"
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
          Animateur pédagogique — espace de coordination
        </p>
      </div>

      {/* Stats rapides */}
      <div
        style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '28px' }}
        className="vm-ap-stats"
      >
        {[
          { label: 'Contenus en attente', value: String(mockPendingContents.length), isAlert: mockPendingContents.length > 0 },
          { label: 'Contenus publiés', value: '—', isAlert: false }, // TODO: brancher API
          { label: 'Parcours actifs', value: '—', isAlert: false }, // TODO: brancher API
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

          {mockPendingContents.length === 0 ? (
            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
              Aucun contenu en attente
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {mockPendingContents.map((content) => (
                <div
                  key={content.id}
                  style={{
                    padding: '12px',
                    background: 'var(--color-bg)',
                    border: '1px solid var(--color-surface)',
                    borderRadius: 'var(--radius-field)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-ink)', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {content.title}
                      </p>
                      <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', margin: 0 }}>
                        {content.type} — par {content.submittedBy}
                      </p>
                    </div>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        color: '#fff',
                        background: 'var(--accent)',
                        borderRadius: 'var(--radius-pill)',
                        padding: '3px 8px',
                        flexShrink: 0,
                        marginLeft: '8px',
                      }}
                    >
                      À valider
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
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

          {mockForumActivity.length === 0 ? (
            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
              Aucun forum actif
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {mockForumActivity.map((forum) => (
                <Link
                  key={forum.id}
                  to={`/community/forums/${forum.id}`}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px',
                    background: 'var(--color-bg)',
                    border: '1px solid var(--color-surface)',
                    borderRadius: 'var(--radius-field)',
                    textDecoration: 'none',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-ink)', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {forum.title}
                    </p>
                    <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', margin: 0 }}>
                      Dernière activité {new Date(forum.lastActivity).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                  {forum.newMessages > 0 && (
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        color: '#fff',
                        background: 'var(--accent)',
                        borderRadius: 'var(--radius-pill)',
                        padding: '2px 8px',
                        flexShrink: 0,
                        marginLeft: '8px',
                      }}
                    >
                      +{forum.newMessages}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Activité récente */}
      {!isLoadingNotifications && notifications.length > 0 && (
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
                  <p style={{ fontSize: '13px', color: 'var(--color-ink)', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {notification.message}
                  </p>
                  <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', margin: 0 }}>
                    {new Date(notification.createdAt).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

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
