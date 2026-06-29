/**
 * ParentDashboardPage — Dashboard Parent financeur
 * Accent : Cyan oklch(0.60 0.12 210)
 */

import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import DashboardShell, { RailGroup, NavItem } from '../components/dashboard/DashboardShell'
import { fetchLinkedStudents, fetchStudentProfile } from '../api/relations'
import apiClient from '../api/client'
import '../styles/tokens.css'

interface LinkedStudent {
  studentId: string
  displayName: string
  loginIdentifier: string | null
}

interface CalendarEvent {
  id: string
  title?: string
  startAt: string
  endAt: string
}

interface StudentCard {
  studentId: string
  displayName: string
  loginIdentifier: string | null
  nextCourse: CalendarEvent | null
  creditBalance: number | null
  lastActivityLabel: string | null
}

const TOP_NAV_ITEMS: NavItem[] = [
  { label: 'Accueil', path: '/dashboard' },
  { label: 'Calendrier', path: '/calendar' },
  { label: 'Messages', path: '/messages' },
  { label: 'Finances', path: '/finance' },
  { label: 'Documents', path: '/legal' },
]

const RAIL_GROUPS: RailGroup[] = [
  {
    groupLabel: 'Suivi',
    items: [
      { label: 'Cahier de texte', path: '/pedagogical-log', icon: '📖' },
      { label: 'Calendrier élève', path: '/calendar', icon: '📅' },
      { label: 'Demandes prof.', path: '/teacher-requests', icon: '🎓' },
    ],
  },
  {
    groupLabel: 'Finance',
    items: [
      { label: 'Mon profil financier', path: '/finance', icon: '💳' },
      { label: 'Documents légaux', path: '/legal', icon: '📄' },
      { label: 'Archives', path: '/archives', icon: '🗂️' },
    ],
  },
  {
    groupLabel: 'Rattachement',
    items: [
      { label: 'Rattacher un élève', path: '/parent-link-requests/new', icon: '🔗' },
    ],
  },
]

export default function ParentDashboardPage() {
  const { user } = useAuth()
  const firstName = user?.loginIdentifier ?? 'vous'

  const [studentCards, setStudentCards] = useState<StudentCard[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!user) return

    fetchLinkedStudents(user.id)
      .then(async (links) => {
        const studentCardList = await Promise.all(
          links.map(async (link) => {
            const studentCard: StudentCard = {
              studentId: link.studentId,
              displayName: 'Élève',
              loginIdentifier: null,
              nextCourse: null,
              creditBalance: null,
              lastActivityLabel: null,
            }

            try {
              const profileData = await fetchStudentProfile(link.studentId)
              const firstName = profileData.administrativeProfile?.firstName ?? ''
              const lastName = profileData.administrativeProfile?.lastName ?? ''
              const resolvedName = [firstName, lastName].filter(Boolean).join(' ')
              studentCard.displayName = resolvedName || profileData.loginIdentifier || 'Élève inconnu'
              studentCard.loginIdentifier = profileData.loginIdentifier ?? null
            } catch {
              studentCard.displayName = 'Élève inconnu'
            }

            // TODO: brancher API calendrier par élève
            try {
              const { data: calendarEvents } = await apiClient.get<CalendarEvent[]>(
                `/calendars/${link.studentId}/events`,
              )
              const futureEvents = (Array.isArray(calendarEvents) ? calendarEvents : [])
                .filter((event) => new Date(event.startAt) >= new Date())
                .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
              studentCard.nextCourse = futureEvents[0] ?? null
            } catch {
              // calendrier indisponible pour cet élève
            }

            return studentCard
          }),
        )
        setStudentCards(studentCardList)
      })
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [user])

  return (
    <DashboardShell
      accentClass="role-parent"
      railGroups={RAIL_GROUPS}
      topNavItems={TOP_NAV_ITEMS}
      userName={firstName}
      userRole="Parent"
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
          Vue d'ensemble de vos élèves
        </p>
      </div>

      {/* Actions rapides */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '12px',
          marginBottom: '28px',
        }}
        className="vm-quick-grid"
      >
        {[
          { label: 'Calendrier', path: '/calendar' },
          { label: 'Finances', path: '/finance' },
          { label: 'Rattacher un élève', path: '/parent-link-requests/new' },
        ].map((quickAction) => (
          <Link
            key={quickAction.path}
            to={quickAction.path}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '14px 12px',
              background: 'var(--color-white)',
              border: '1px solid var(--color-surface)',
              borderRadius: 'var(--radius-card)',
              boxShadow: 'var(--shadow-card)',
              fontSize: '13px',
              fontWeight: 500,
              color: 'var(--color-ink)',
              textDecoration: 'none',
              textAlign: 'center',
              transition: 'box-shadow 0.15s',
            }}
          >
            {quickAction.label}
          </Link>
        ))}
      </div>

      {/* Cards élèves */}
      <div>
        <h2
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: '15px',
            fontWeight: 600,
            color: 'var(--color-ink)',
            marginBottom: '16px',
          }}
        >
          Mes élèves
        </h2>

        {isLoading ? (
          <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>Chargement…</p>
        ) : studentCards.length === 0 ? (
          <div
            style={{
              background: 'var(--color-white)',
              border: '1px solid var(--color-surface)',
              borderRadius: 'var(--radius-card)',
              padding: '32px',
              textAlign: 'center',
            }}
          >
            <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', marginBottom: '16px' }}>
              Aucun élève rattaché à votre compte.
            </p>
            <Link
              to="/parent-link-requests/new"
              style={{
                fontSize: '13px',
                fontWeight: 600,
                color: '#fff',
                background: 'var(--accent)',
                borderRadius: 'var(--radius-pill)',
                padding: '8px 20px',
                textDecoration: 'none',
              }}
            >
              Rattacher un élève
            </Link>
          </div>
        ) : (
          <div
            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}
          >
            {studentCards.map((studentCard) => (
              <div
                key={studentCard.studentId}
                style={{
                  background: 'var(--color-white)',
                  border: '1px solid var(--color-surface)',
                  borderRadius: 'var(--radius-card)',
                  boxShadow: 'var(--shadow-card)',
                  padding: '20px',
                }}
              >
                {/* En-tête carte */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      background: 'var(--accent)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontWeight: 700,
                      fontSize: '16px',
                      flexShrink: 0,
                    }}
                  >
                    {studentCard.displayName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-ink)', margin: 0 }}>
                      {studentCard.displayName}
                    </p>
                    {studentCard.loginIdentifier && (
                      <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', margin: 0 }}>
                        {studentCard.loginIdentifier}
                      </p>
                    )}
                  </div>
                </div>

                {/* Prochain cours */}
                <div
                  style={{
                    padding: '12px',
                    background: 'var(--color-bg)',
                    borderRadius: 'var(--radius-field)',
                    marginBottom: '12px',
                  }}
                >
                  <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                    PROCHAIN COURS
                  </p>
                  {studentCard.nextCourse ? (
                    <p style={{ fontSize: '13px', color: 'var(--color-ink)', fontWeight: 500 }}>
                      {studentCard.nextCourse.title ?? 'Séance programmée'}{' '}
                      <span style={{ color: 'var(--color-text-secondary)', fontWeight: 400 }}>
                        — {new Date(studentCard.nextCourse.startAt).toLocaleDateString('fr-FR', {
                          weekday: 'short',
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </p>
                  ) : (
                    <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                      Aucun cours à venir
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <Link
                    to={`/profiles/${studentCard.studentId}`}
                    style={{
                      fontSize: '12px',
                      color: 'var(--accent)',
                      border: '1px solid var(--color-surface)',
                      borderRadius: 'var(--radius-pill)',
                      padding: '5px 12px',
                      textDecoration: 'none',
                      fontWeight: 500,
                    }}
                  >
                    Profil
                  </Link>
                  <Link
                    to={`/calendar?studentId=${studentCard.studentId}`}
                    style={{
                      fontSize: '12px',
                      color: 'var(--accent)',
                      border: '1px solid var(--color-surface)',
                      borderRadius: 'var(--radius-pill)',
                      padding: '5px 12px',
                      textDecoration: 'none',
                      fontWeight: 500,
                    }}
                  >
                    Calendrier
                  </Link>
                  <Link
                    to={`/pedagogical-log?studentId=${studentCard.studentId}`}
                    style={{
                      fontSize: '12px',
                      color: 'var(--accent)',
                      border: '1px solid var(--color-surface)',
                      borderRadius: 'var(--radius-pill)',
                      padding: '5px 12px',
                      textDecoration: 'none',
                      fontWeight: 500,
                    }}
                  >
                    Cahier
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        @media (max-width: 768px) {
          .vm-quick-grid { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>
    </DashboardShell>
  )
}
