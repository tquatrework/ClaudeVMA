/**
 * EleveDashboardPage — Dashboard Élève
 * Accent : Indigo oklch(0.58 0.13 270)
 *
 * Blocs :
 *   - Salutation
 *   - Carte professeur attitré (ou état vide avec action)
 *   - Prochain cours (hero)
 *   - Grille : Travail en cours | À ne pas oublier
 *   - Contacts importants
 *   - Fil d'activité
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

interface ContactEntry {
  id: string
  displayName?: string
  role?: string
  email?: string
  status: string
  mandatory: boolean
}

const TOP_NAV_ITEMS: NavItem[] = [
  { label: 'Accueil', path: '/dashboard' },
  { label: 'Calendrier', path: '/calendar' },
  { label: 'Contacts', path: '/contacts' },
  { label: 'Messages', path: '/messages' },
  { label: 'Demandes', path: '/teacher-requests' },
  { label: 'Stats / Archives', path: '/archives' },
]

const RAIL_GROUPS: RailGroup[] = [
  {
    groupLabel: 'Cours',
    items: [
      { label: 'Visio', path: '/activities', icon: '🎥' },
      { label: 'Cahier de texte', path: '/pedagogical-log', icon: '📖' },
      { label: 'Mémo', path: '/memos', icon: '💡' },
      { label: 'Carnet personnel', path: '/notebook/', icon: '📓' },
    ],
  },
  {
    groupLabel: 'Contenus',
    items: [
      { label: 'Exercices', path: '/content/exercises', icon: '📐' },
      { label: 'Évaluations', path: '/content/evaluations', icon: '📝' },
      { label: 'Tutos-vidéos', path: '/content/tutorials', icon: '🎬' },
    ],
  },
  {
    groupLabel: 'Communauté',
    items: [
      { label: 'Forums', path: '/community/forums', icon: '💬' },
      { label: 'Parcours', path: '/community/paths', icon: '🗺️' },
      // Jeux : fonctionnalité phase 3 non encore disponible
    ],
  },
  {
    groupLabel: 'Compte',
    items: [
      { label: 'Documents légaux', path: '/legal', icon: '📄' },
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

function formatShortDate(startAt: string): string {
  return new Date(startAt).toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ─── Sous-composants utilitaires ────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3
      style={{
        fontFamily: 'var(--font-heading)',
        fontSize: '15px',
        fontWeight: 600,
        color: 'var(--color-ink)',
        margin: '0 0 14px',
      }}
    >
      {children}
    </h3>
  )
}

function Card({
  children,
  style,
}: {
  children: React.ReactNode
  style?: React.CSSProperties
}) {
  return (
    <div
      style={{
        background: 'var(--color-white)',
        border: '1px solid var(--color-surface)',
        borderRadius: 'var(--radius-card)',
        boxShadow: 'var(--shadow-card)',
        padding: '20px',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

// ─── Composant principal ────────────────────────────────────

export default function EleveDashboardPage() {
  const { user } = useAuth()
  const firstName = user?.loginIdentifier ?? 'vous'

  const [nextCourse, setNextCourse] = useState<CalendarEvent | null>(null)
  const [upcomingCourses, setUpcomingCourses] = useState<CalendarEvent[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [contacts, setContacts] = useState<ContactEntry[]>([])
  const [isLoadingCourses, setIsLoadingCourses] = useState(true)
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(true)
  const [isLoadingContacts, setIsLoadingContacts] = useState(true)

  useEffect(() => {
    if (!user) return

    // Calendrier
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

    // Notifications
    apiClient
      .get<{ data?: Notification[] } | Notification[]>('/notifications')
      .then(({ data }) => {
        const notificationList = Array.isArray(data) ? data : (data.data ?? [])
        setNotifications(notificationList.slice(0, 5))
      })
      .catch(() => {})
      .finally(() => setIsLoadingNotifications(false))

    // Contacts
    apiClient
      .get<ContactEntry[]>('/contacts')
      .then(({ data }) => {
        const contactList = Array.isArray(data) ? data : []
        setContacts(contactList.filter((contact) => contact.status === 'active').slice(0, 5))
      })
      .catch(() => {})
      .finally(() => setIsLoadingContacts(false))
  }, [user])

  // Détecter le professeur principal parmi les contacts
  const principalTeacher = contacts.find(
    (contact) => contact.role === 'formateur' && contact.mandatory,
  ) ?? contacts.find((contact) => contact.role === 'formateur') ?? null

  const isVisioSoon =
    nextCourse !== null &&
    new Date(nextCourse.startAt).getTime() - Date.now() < 30 * 60 * 1000

  const railGroupsWithNotebook: RailGroup[] = RAIL_GROUPS.map((group) => {
    if (group.groupLabel !== 'Cours') return group
    return {
      ...group,
      items: group.items.map((item) =>
        item.label === 'Carnet personnel' && user
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
      {/* ── Salutation ─────────────────────────────────────── */}
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

      {/* ── LIGNE 1 : Professeur attitré + Prochain cours ─── */}
      <div
        style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px', marginBottom: '20px' }}
        className="vm-grid-hero"
      >
        {/* Carte professeur attitré */}
        <Card>
          <p
            style={{
              fontSize: '10px',
              fontWeight: 700,
              color: 'var(--color-text-secondary)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: '12px',
            }}
          >
            Mon professeur
          </p>

          {principalTeacher ? (
            <div>
              {/* Avatar + nom */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
                <div
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '50%',
                    background: 'var(--accent-alpha-15, rgba(91,108,240,0.15))',
                    border: '2px solid var(--accent)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--accent)',
                    fontWeight: 700,
                    fontSize: '18px',
                    flexShrink: 0,
                  }}
                >
                  {(principalTeacher.displayName ?? '?').charAt(0).toUpperCase()}
                </div>
                <div>
                  <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-ink)', margin: 0 }}>
                    {principalTeacher.displayName ?? 'Formateur'}
                  </p>
                  <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: '2px 0 0' }}>
                    Mathématiques
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <Link
                  to={`/profiles/${principalTeacher.id}`}
                  style={{
                    fontSize: '12px',
                    fontWeight: 500,
                    color: 'var(--accent)',
                    border: '1px solid var(--color-surface)',
                    borderRadius: 'var(--radius-field)',
                    padding: '7px 12px',
                    textDecoration: 'none',
                    textAlign: 'center',
                    display: 'block',
                  }}
                >
                  Voir le profil
                </Link>
                {isVisioSoon && nextCourse && (
                  <Link
                    to={`/activities/${nextCourse.id}`}
                    style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#fff',
                      background: 'var(--accent)',
                      borderRadius: 'var(--radius-field)',
                      padding: '7px 12px',
                      textDecoration: 'none',
                      textAlign: 'center',
                      display: 'block',
                    }}
                  >
                    Rejoindre la visio
                  </Link>
                )}
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  background: 'var(--color-surface)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 12px',
                  fontSize: '20px',
                }}
              >
                ?
              </div>
              <p
                style={{
                  fontSize: '13px',
                  color: 'var(--color-text-secondary)',
                  marginBottom: '14px',
                  lineHeight: 1.4,
                }}
              >
                Vous n'avez pas pour l'instant de professeur attitré
              </p>
              <Link
                to="/teacher-requests"
                style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#fff',
                  background: 'var(--accent)',
                  borderRadius: 'var(--radius-field)',
                  padding: '8px 14px',
                  textDecoration: 'none',
                  display: 'inline-block',
                }}
              >
                Demander un professeur
              </Link>
            </div>
          )}
        </Card>

        {/* Hero — Prochain cours */}
        <Card style={{ padding: '24px' }}>
          <p
            style={{
              fontSize: '10px',
              fontWeight: 700,
              color: 'var(--color-text-secondary)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: '10px',
            }}
          >
            Prochain cours
          </p>

          {isLoadingCourses ? (
            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>Chargement…</p>
          ) : nextCourse ? (
            <div>
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
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

              {/* Prochains cours */}
              {upcomingCourses.length > 0 && (
                <div
                  style={{
                    marginTop: '16px',
                    paddingTop: '14px',
                    borderTop: '1px solid var(--color-surface)',
                  }}
                >
                  <p
                    style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      color: 'var(--color-text-secondary)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      marginBottom: '8px',
                    }}
                  >
                    À venir
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {upcomingCourses.map((courseEvent) => (
                      <Link
                        key={courseEvent.id}
                        to={`/activities/${courseEvent.id}`}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '6px 0',
                          borderBottom: '1px solid var(--color-surface)',
                          textDecoration: 'none',
                        }}
                      >
                        <span style={{ fontSize: '13px', color: 'var(--color-ink)' }}>
                          {courseEvent.title ?? 'Séance'}
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                          {formatShortDate(courseEvent.startAt)}
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', marginBottom: '16px' }}>
                Aucun cours à venir
              </p>
              {!isLoadingContacts && principalTeacher === null && (
                <Link
                  to="/contacts"
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
              )}
            </div>
          )}
        </Card>
      </div>

      {/* ── LIGNE 2 : Travail en cours | À ne pas oublier ── */}
      <div
        style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}
        className="vm-grid-work"
      >
        {/* Travail en cours */}
        <Card>
          <SectionTitle>Travail en cours</SectionTitle>

          <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '16px' }}>
            Aucun travail en cours pour l'instant.
          </p>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <Link
              to="/content/exercises"
              style={{ fontSize: '12px', color: 'var(--accent)', textDecoration: 'none' }}
            >
              Exercices →
            </Link>
            <Link
              to="/content/evaluations"
              style={{ fontSize: '12px', color: 'var(--accent)', textDecoration: 'none' }}
            >
              Évaluations →
            </Link>
            <Link
              to="/community/paths"
              style={{ fontSize: '12px', color: 'var(--accent)', textDecoration: 'none' }}
            >
              Parcours →
            </Link>
          </div>
        </Card>

        {/* À ne pas oublier */}
        <Card>
          <SectionTitle>À ne pas oublier</SectionTitle>

          <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '14px' }}>
            Aucun rappel pour l'instant.
          </p>

          <Link
            to="/calendar"
            style={{
              display: 'inline-block',
              fontSize: '12px',
              color: 'var(--accent)',
              textDecoration: 'none',
            }}
          >
            Voir le calendrier →
          </Link>
        </Card>
      </div>

      {/* ── LIGNE 3 : Contacts importants + Fil d'activité ─ */}
      <div
        style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px' }}
        className="vm-grid-bottom"
      >
        {/* Contacts importants */}
        <Card>
          <SectionTitle>Contacts importants</SectionTitle>

          {isLoadingContacts ? (
            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>Chargement…</p>
          ) : contacts.length === 0 ? (
            <div>
              <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '12px' }}>
                Aucun contact pour l'instant.
              </p>
              <Link
                to="/contacts"
                style={{ fontSize: '12px', color: 'var(--accent)', textDecoration: 'none' }}
              >
                Gérer les contacts →
              </Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {contacts.map((contact) => (
                <div
                  key={contact.id}
                  style={{ display: 'flex', alignItems: 'center', gap: '10px' }}
                >
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: 'var(--accent-alpha-10, rgba(91,108,240,0.10))',
                      border: '1px solid var(--color-surface)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--accent)',
                      fontWeight: 700,
                      fontSize: '13px',
                      flexShrink: 0,
                    }}
                  >
                    {(contact.displayName ?? '?').charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p
                      style={{
                        fontSize: '13px',
                        fontWeight: 500,
                        color: 'var(--color-ink)',
                        margin: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {contact.displayName ?? contact.email ?? 'Contact'}
                    </p>
                    {contact.role && (
                      <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', margin: 0 }}>
                        {contact.role}
                      </p>
                    )}
                  </div>
                  <Link
                    to={`/messages`}
                    style={{
                      fontSize: '11px',
                      color: 'var(--accent)',
                      border: '1px solid var(--color-surface)',
                      borderRadius: 'var(--radius-pill)',
                      padding: '3px 8px',
                      textDecoration: 'none',
                      flexShrink: 0,
                    }}
                  >
                    Écrire
                  </Link>
                </div>
              ))}
              <Link
                to="/contacts"
                style={{ fontSize: '12px', color: 'var(--accent)', textDecoration: 'none', marginTop: '4px' }}
              >
                Tous les contacts →
              </Link>
            </div>
          )}
        </Card>

        {/* Fil d'activité */}
        <Card>
          <SectionTitle>Activité récente</SectionTitle>

          {isLoadingNotifications ? (
            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>Chargement…</p>
          ) : notifications.length === 0 ? (
            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
              Aucune activité récente.
            </p>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0' }}>
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
                      width: '7px',
                      height: '7px',
                      borderRadius: '50%',
                      background: notification.read ? 'var(--color-surface)' : 'var(--accent)',
                      flexShrink: 0,
                      marginTop: '4px',
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p
                      style={{
                        fontSize: '13px',
                        color: 'var(--color-ink)',
                        fontWeight: notification.read ? 400 : 500,
                        margin: '0 0 2px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
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
        </Card>
      </div>

      {/* Responsive */}
      <style>{`
        @media (max-width: 900px) {
          .vm-grid-hero { grid-template-columns: 1fr !important; }
          .vm-grid-work { grid-template-columns: 1fr !important; }
          .vm-grid-bottom { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </DashboardShell>
  )
}
