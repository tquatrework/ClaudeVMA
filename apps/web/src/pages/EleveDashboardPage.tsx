/**
 * EleveDashboardPage — Dashboard Élève
 * Accent : Indigo oklch(0.58 0.13 270)
 */

import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import DashboardShell, { RailGroup, NavItem } from '../components/dashboard/DashboardShell'
import apiClient from '../api/client'
import '../styles/tokens.css'

interface CalendarEvent {
  id: string
  title?: string
  startAt: string
  endAt: string
  eventType?: string
  description?: string
}

interface Notification {
  id: string
  message: string
  read: boolean
  createdAt: string
}

interface ActivityItem {
  id: string
  label: string
  timestamp: string
  type: 'notification' | 'log' | 'request'
}

const TOP_NAV_ITEMS: NavItem[] = [
  { label: 'Accueil', path: '/dashboard' },
  { label: 'Calendrier', path: '/calendar' },
  { label: 'Messages', path: '/messages' },
  { label: 'Demandes prof.', path: '/teacher-requests' },
  { label: 'Documents', path: '/archives' },
]

const RAIL_GROUPS: RailGroup[] = [
  {
    groupLabel: 'Cours',
    items: [
      { label: 'Rejoindre la visio', path: '/activities', icon: '🎥' },
      { label: 'Tableau blanc', path: '/activities', icon: '✏️' },
    ],
  },
  {
    groupLabel: 'Travail',
    items: [
      { label: 'Cahier de texte', path: '/pedagogical-log', icon: '📖' },
      { label: 'Exercices', path: '/content/exercises', icon: '📐' },
      { label: 'Évaluations', path: '/content/evaluations', icon: '📝' },
    ],
  },
  {
    groupLabel: 'Mon espace',
    items: [
      { label: 'Mon carnet', path: '/notebook/', icon: '📓' },
      { label: 'Mémos', path: '/memos', icon: '💡' },
      { label: 'Parcours', path: '/community/paths', icon: '🗺️' },
      { label: 'Ressources', path: '/content/tutorials', icon: '🎬' },
    ],
  },
]

function formatCountdown(startAt: string): string {
  const diffMs = new Date(startAt).getTime() - Date.now()
  if (diffMs <= 0) return 'en cours'
  const diffMinutes = Math.floor(diffMs / 60000)
  if (diffMinutes < 60) return `dans ${diffMinutes} min`
  const diffHours = Math.floor(diffMinutes / 60)
  const remainingMinutes = diffMinutes % 60
  if (remainingMinutes === 0) return `dans ${diffHours}h`
  return `dans ${diffHours}h${String(remainingMinutes).padStart(2, '0')}`
}

function formatEventDate(startAt: string): string {
  return new Date(startAt).toLocaleString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function EleveDashboardPage() {
  const { user } = useAuth()
  const firstName = user?.loginIdentifier ?? 'vous'

  const [nextCourse, setNextCourse] = useState<CalendarEvent | null>(null)
  const [upcomingCourses, setUpcomingCourses] = useState<CalendarEvent[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isLoadingCourses, setIsLoadingCourses] = useState(true)
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(true)

  // TODO: brancher API progression
  const mockProgressItems = [
    { label: 'Suites et séries', percent: 72 },
    { label: 'Dérivées', percent: 58 },
    { label: 'Géométrie vectorielle', percent: 45 },
  ]

  useEffect(() => {
    if (!user) return

    apiClient
      .get<CalendarEvent[]>(`/calendars/${user.id}/events`)
      .then(({ data }) => {
        const futureEvents = (Array.isArray(data) ? data : [])
          .filter((event) => new Date(event.startAt) >= new Date())
          .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())

        setNextCourse(futureEvents[0] ?? null)
        setUpcomingCourses(futureEvents.slice(1, 4))
      })
      .catch(() => {})
      .finally(() => setIsLoadingCourses(false))

    apiClient
      .get<{ data?: Notification[] } | Notification[]>('/notifications')
      .then(({ data }) => {
        const notificationList = Array.isArray(data) ? data : (data.data ?? [])
        setNotifications(notificationList.slice(0, 5))
      })
      .catch(() => {})
      .finally(() => setIsLoadingNotifications(false))
  }, [user])

  const activityFeed: ActivityItem[] = notifications.map((notification) => ({
    id: notification.id,
    label: notification.message,
    timestamp: notification.createdAt,
    type: 'notification' as const,
  }))

  const railGroupsWithNotebook: RailGroup[] = RAIL_GROUPS.map((group) => {
    if (group.groupLabel !== 'Mon espace') return group
    return {
      ...group,
      items: group.items.map((item) =>
        item.label === 'Mon carnet' && user
          ? { ...item, path: `/notebook/${user.id}` }
          : item,
      ),
    }
  })

  return (
    <DashboardShell
      accentClass="role-eleve"
      railGroups={railGroupsWithNotebook}
      topNavItems={TOP_NAV_ITEMS}
      userName={firstName}
      userRole="Élève"
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
          Voici votre espace élève
        </p>
      </div>

      {/* HERO — Prochain cours */}
      <div
        style={{
          background: 'var(--color-white)',
          border: '1px solid var(--color-surface)',
          borderRadius: 'var(--radius-card)',
          boxShadow: 'var(--shadow-card)',
          padding: '24px',
          marginBottom: '24px',
        }}
      >
        {isLoadingCourses ? (
          <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>Chargement…</p>
        ) : nextCourse ? (
          <div>
            <p
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--color-text-secondary)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                marginBottom: '8px',
              }}
            >
              Prochain cours
            </p>
            <h2
              style={{
                fontFamily: 'var(--font-heading)',
                fontSize: '20px',
                fontWeight: 700,
                color: 'var(--color-ink)',
                margin: '0 0 4px',
              }}
            >
              {nextCourse.title ?? 'Séance de mathématiques'}
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '0 0 16px' }}>
              {formatEventDate(nextCourse.startAt)}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  background: 'color-mix(in srgb, var(--accent) 12%, transparent)',
                  color: 'var(--accent)',
                  borderRadius: 'var(--radius-pill)',
                  padding: '4px 12px',
                }}
              >
                {formatCountdown(nextCourse.startAt)}
              </span>
              <span
                style={{
                  fontSize: '12px',
                  background: 'var(--color-surface)',
                  color: 'var(--color-text-secondary)',
                  borderRadius: 'var(--radius-pill)',
                  padding: '4px 12px',
                }}
              >
                visio
              </span>
              <Link
                to={`/activities/${nextCourse.id}`}
                style={{
                  marginLeft: 'auto',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#fff',
                  background: 'var(--accent)',
                  borderRadius: 'var(--radius-pill)',
                  padding: '8px 20px',
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                ▶ Rejoindre
              </Link>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', marginBottom: '16px' }}>
              Aucun cours à venir
            </p>
            <Link
              to="/teacher-requests"
              style={{
                fontSize: '13px',
                fontWeight: 500,
                color: 'var(--accent)',
                border: '1px solid var(--accent)',
                borderRadius: 'var(--radius-pill)',
                padding: '8px 20px',
                textDecoration: 'none',
              }}
            >
              Demander un professeur
            </Link>
          </div>
        )}
      </div>

      {/* Grille : Fil d'activité + Progression */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '3fr 2fr',
          gap: '24px',
        }}
        className="vm-grid-eleve"
      >
        {/* Fil d'activité */}
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
            Fil d'activité
          </h3>

          {isLoadingNotifications ? (
            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>Chargement…</p>
          ) : activityFeed.length === 0 ? (
            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
              Aucune activité récente
            </p>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {activityFeed.map((activityItem) => (
                <li
                  key={activityItem.id}
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
                      background: 'var(--accent)',
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
                      }}
                    >
                      {activityItem.label}
                    </p>
                    <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', margin: 0 }}>
                      {new Date(activityItem.timestamp).toLocaleString('fr-FR', {
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

          {/* Prochains cours */}
          {!isLoadingCourses && upcomingCourses.length > 0 && (
            <div style={{ marginTop: '20px' }}>
              <p
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: 'var(--color-text-secondary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  marginBottom: '8px',
                }}
              >
                À venir
              </p>
              {upcomingCourses.map((courseEvent) => (
                <Link
                  key={courseEvent.id}
                  to={`/activities/${courseEvent.id}`}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 0',
                    borderBottom: '1px solid var(--color-surface)',
                    textDecoration: 'none',
                  }}
                >
                  <span style={{ fontSize: '13px', color: 'var(--color-ink)' }}>
                    {courseEvent.title ?? 'Séance'}
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                    {new Date(courseEvent.startAt).toLocaleDateString('fr-FR', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                    })}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Progression & Objectifs */}
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
            Ma progression
          </h3>

          {/* TODO: brancher API progression */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {mockProgressItems.map((progressItem) => (
              <div key={progressItem.label}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: '6px',
                  }}
                >
                  <span style={{ fontSize: '13px', color: 'var(--color-ink)', fontWeight: 500 }}>
                    {progressItem.label}
                  </span>
                  <span
                    style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: 'var(--accent)',
                    }}
                  >
                    {progressItem.percent}%
                  </span>
                </div>
                <div
                  style={{
                    height: '6px',
                    background: 'var(--color-surface)',
                    borderRadius: 'var(--radius-pill)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${progressItem.percent}%`,
                      background: 'var(--accent)',
                      borderRadius: 'var(--radius-pill)',
                      transition: 'width 0.5s ease',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div
            style={{
              marginTop: '24px',
              paddingTop: '16px',
              borderTop: '1px solid var(--color-surface)',
            }}
          >
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
              Objectifs
            </p>
            {/* TODO: brancher API objectifs */}
            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
              Aucun objectif défini pour l'instant.
            </p>
            <Link
              to="/community/paths"
              style={{
                display: 'inline-block',
                marginTop: '10px',
                fontSize: '12px',
                color: 'var(--accent)',
                textDecoration: 'none',
              }}
            >
              Découvrir les parcours →
            </Link>
          </div>
        </div>
      </div>

      {/* Responsive — empiler les 2 colonnes sur mobile */}
      <style>{`
        @media (max-width: 768px) {
          .vm-grid-eleve { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </DashboardShell>
  )
}
