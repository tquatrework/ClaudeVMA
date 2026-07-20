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
        style={{ boxShadow: 'var(--shadow-card)' }}
        className="bg-[var(--color-white)] border border-[var(--color-surface)] rounded-[var(--radius-card)] p-6 mb-6"
      >
        {isLoadingCourses ? (
          <p className="text-[13px] text-[color:var(--color-text-secondary)]">Chargement…</p>
        ) : nextCourse ? (
          <div>
            <p className="text-[11px] font-semibold text-[color:var(--color-text-secondary)] uppercase tracking-[0.06em] mb-2">
              Prochain cours
            </p>
            <h2 className="font-[var(--font-heading)] text-[20px] font-bold text-[color:var(--color-ink)] mb-1">
              {nextCourse.title ?? 'Séance de cours'}
            </h2>
            <p className="text-[13px] text-[color:var(--color-text-secondary)] mb-4">
              {formatEventDate(nextCourse.startAt)}
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              <Link
                to={`/activities/${nextCourse.id}`}
                className="ml-auto text-[13px] font-semibold text-white bg-[var(--accent)] rounded-[var(--radius-pill)] py-2 px-5 no-underline inline-flex items-center gap-1.5"
              >
                ▶ Démarrer la visio
              </Link>
            </div>
          </div>
        ) : (
          <div className="text-center py-3">
            <p className="text-[14px] text-[color:var(--color-text-secondary)] mb-4">
              Aucun cours planifié
            </p>
            <Link
              to="/calendar"
              className="text-[13px] font-medium text-[color:var(--accent)] border border-[var(--accent)] rounded-[var(--radius-pill)] py-2 px-5 no-underline"
            >
              Voir le calendrier
            </Link>
          </div>
        )}
      </div>

      {/* Grille : Fil activité + À venir */}
      <div className="grid grid-cols-[3fr_2fr] gap-6 vm-grid-prof">
        {/* Fil d'activité */}
        <div
          style={{ boxShadow: 'var(--shadow-card)' }}
          className="bg-[var(--color-white)] border border-[var(--color-surface)] rounded-[var(--radius-card)] p-5"
        >
          <ActivityFeed notifications={notifications} isLoading={isLoadingNotifications} />
        </div>

        {/* Cours de la semaine */}
        <div
          style={{ boxShadow: 'var(--shadow-card)' }}
          className="bg-[var(--color-white)] border border-[var(--color-surface)] rounded-[var(--radius-card)] p-5"
        >
          <h3 className="font-[var(--font-heading)] text-[15px] font-semibold text-[color:var(--color-ink)] mb-4">
            Cette semaine
          </h3>

          {isLoadingCourses ? (
            <p className="text-[13px] text-[color:var(--color-text-secondary)]">Chargement…</p>
          ) : upcomingCourses.length === 0 ? (
            <p className="text-[13px] text-[color:var(--color-text-secondary)]">
              Aucun cours à venir cette semaine
            </p>
          ) : (
            <ul className="list-none m-0 p-0">
              {upcomingCourses.map((courseEvent) => (
                <li key={courseEvent.id} className="mb-0">
                  <Link
                    to={`/activities/${courseEvent.id}`}
                    className="flex flex-col py-2.5 border-b border-[var(--color-surface)] no-underline"
                  >
                    <span className="text-[13px] font-medium text-[color:var(--color-ink)]">
                      {courseEvent.title ?? 'Séance'}
                    </span>
                    <span className="text-[11px] text-[color:var(--color-text-secondary)] mt-0.5">
                      {formatShortDate(courseEvent.startAt)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <Link
            to="/calendar"
            className="inline-block mt-4 text-[12px] text-[color:var(--accent)] no-underline"
          >
            Voir le calendrier complet →
          </Link>

          {/* Lien vers demandes ouvertes */}
          <div className="mt-5 pt-4 border-t border-[var(--color-surface)]">
            {/* background gardé en inline : valeur color-mix() calculée, pas un token statique */}
            <Link
              to="/open-activities"
              style={{ background: 'color-mix(in srgb, var(--accent) 10%, transparent)' }}
              className="block text-[13px] font-medium text-[color:var(--accent)] no-underline py-2.5 px-3.5 rounded-[var(--radius-field)]"
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
