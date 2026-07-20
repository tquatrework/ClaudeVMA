/**
 * ProfesseurDashboardPage — Dashboard Formateur
 * Accent : Vert oklch(0.60 0.12 155)
 */

import React from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import DashboardShell from '../components/dashboard/DashboardShell'
import '../styles/tokens.css'
import { formatEventDate, formatShortDate } from '../utils/dateFormat'
import { getRailGroupsForRole, filterTopNavItems } from '../navigation/navigationConfig'
import { ActivityFeed } from '../components/ui/ActivityFeed'
import { PageTitle } from '../components/ui/PageTitle'
import { useUpcomingCourses } from '../hooks/dashboard/useUpcomingCourses'
import { useDashboardNotifications } from '../hooks/dashboard/useDashboardNotifications'

export default function ProfesseurDashboardPage() {
  const { user, hasRole } = useAuth()
  const firstName = user?.loginIdentifier ?? 'vous'

  const { nextCourse, upcomingCourses, isLoadingCourses } = useUpcomingCourses(user?.id, 4)
  const { notifications, isLoadingNotifications } = useDashboardNotifications(6)

  const topNavItems = filterTopNavItems('formateur', hasRole)
  const railGroups = getRailGroupsForRole('formateur')

  return (
    <DashboardShell
      accentClass="role-formateur"
      railGroups={railGroups}
      topNavItems={topNavItems}
      userName={firstName}
      userRole="Formateur"
    >
      {/* Salutation */}
      <PageTitle title={`Bonjour, ${firstName}`} subtitle="Votre espace formateur" />

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
          <ActivityFeed notifications={notifications} isLoading={isLoadingNotifications} />
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
