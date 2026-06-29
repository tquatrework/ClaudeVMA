/**
 * ProfesseurDashboardPage — Dashboard Formateur
 * Accent : Vert oklch(0.60 0.12 155)
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
  { label: 'Mes élèves', path: '/my-students' },
  { label: 'Demandes', path: '/teacher-requests' },
  { label: 'Paiements', path: '/teacher-payment-requests' },
]

const RAIL_GROUPS: RailGroup[] = [
  {
    groupLabel: 'Cours',
    items: [
      { label: 'Mes cours', path: '/activities', icon: '🎥' },
      { label: 'Tableau blanc', path: '/activities', icon: '✏️' },
      { label: 'Demandes ouvertes', path: '/open-activities', icon: '📢' },
    ],
  },
  {
    groupLabel: 'Suivi',
    items: [
      { label: 'Cahier de texte', path: '/pedagogical-log', icon: '📖' },
      { label: 'Mes élèves', path: '/my-students', icon: '👥' },
      { label: 'Mémos', path: '/memos', icon: '💡' },
    ],
  },
  {
    groupLabel: 'Contenus',
    items: [
      { label: 'Exercices', path: '/content/exercises', icon: '📐' },
      { label: 'Évaluations', path: '/content/evaluations', icon: '📝' },
      { label: 'Tutoriels vidéo', path: '/content/tutorials', icon: '🎬' },
    ],
  },
]

function formatEventDate(startAt: string): string {
  return new Date(startAt).toLocaleString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatShortDate(startAt: string): string {
  return new Date(startAt).toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function ProfesseurDashboardPage() {
  const { user } = useAuth()
  const firstName = user?.loginIdentifier ?? 'vous'

  const [nextCourse, setNextCourse] = useState<CalendarEvent | null>(null)
  const [upcomingCourses, setUpcomingCourses] = useState<CalendarEvent[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isLoadingCourses, setIsLoadingCourses] = useState(true)
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(true)

  useEffect(() => {
    if (!user) return

    apiClient
      .get<CalendarEvent[]>(`/calendars/${user.id}/events`)
      .then(({ data }) => {
        const futureEvents = (Array.isArray(data) ? data : [])
          .filter((event) => new Date(event.startAt) >= new Date())
          .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())

        setNextCourse(futureEvents[0] ?? null)
        setUpcomingCourses(futureEvents.slice(1, 5))
      })
      .catch(() => {})
      .finally(() => setIsLoadingCourses(false))

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
      accentClass="role-formateur"
      railGroups={RAIL_GROUPS}
      topNavItems={TOP_NAV_ITEMS}
      userName={firstName}
      userRole="Formateur"
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
          Votre espace formateur
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
              {nextCourse.title ?? 'Séance de cours'}
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '0 0 16px' }}>
              {formatEventDate(nextCourse.startAt)}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
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
                ▶ Démarrer la visio
              </Link>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', marginBottom: '16px' }}>
              Aucun cours planifié
            </p>
            <Link
              to="/calendar"
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
              Voir le calendrier
            </Link>
          </div>
        )}
      </div>

      {/* Grille : Fil activité + À venir */}
      <div
        style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '24px' }}
        className="vm-grid-prof"
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

        {/* Cours de la semaine */}
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
            Cette semaine
          </h3>

          {isLoadingCourses ? (
            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>Chargement…</p>
          ) : upcomingCourses.length === 0 ? (
            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
              Aucun cours à venir cette semaine
            </p>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {upcomingCourses.map((courseEvent) => (
                <li key={courseEvent.id} style={{ marginBottom: '0' }}>
                  <Link
                    to={`/activities/${courseEvent.id}`}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      padding: '10px 0',
                      borderBottom: '1px solid var(--color-surface)',
                      textDecoration: 'none',
                    }}
                  >
                    <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-ink)' }}>
                      {courseEvent.title ?? 'Séance'}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                      {formatShortDate(courseEvent.startAt)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <Link
            to="/calendar"
            style={{
              display: 'inline-block',
              marginTop: '16px',
              fontSize: '12px',
              color: 'var(--accent)',
              textDecoration: 'none',
            }}
          >
            Voir le calendrier complet →
          </Link>

          {/* Lien vers demandes ouvertes */}
          <div
            style={{
              marginTop: '20px',
              paddingTop: '16px',
              borderTop: '1px solid var(--color-surface)',
            }}
          >
            <Link
              to="/open-activities"
              style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 500,
                color: 'var(--accent)',
                textDecoration: 'none',
                padding: '10px 14px',
                background: 'color-mix(in srgb, var(--accent) 10%, transparent)',
                borderRadius: 'var(--radius-field)',
              }}
            >
              Voir les activités sans formateur →
            </Link>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .vm-grid-prof { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </DashboardShell>
  )
}
