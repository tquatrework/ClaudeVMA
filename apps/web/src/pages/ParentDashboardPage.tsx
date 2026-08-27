/**
 * ParentDashboardPage — Dashboard Parent financeur
 * Accent : Cyan oklch(0.60 0.12 210)
 */

import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import DashboardShell from '../components/dashboard/DashboardShell'
import '../styles/tokens.css'
import { getRailGroupsForRole, filterTopNavItems } from '../navigation/navigationConfig'
import { PageTitle } from '../components/ui/PageTitle'
import { useParentDashboard } from '../hooks/dashboard/useParentDashboard'
import { MemoReadOnlyModal } from '../components/pedagogical-log/MemoReadOnlyModal'

export default function ParentDashboardPage() {
  const { user, hasRole } = useAuth()
  const firstName = user?.loginIdentifier ?? 'vous'

  const topNavItems = filterTopNavItems('parent_financeur', hasRole)
  const railGroups = getRailGroupsForRole('parent_financeur')

  const { studentCards, isLoading } = useParentDashboard(user?.id)

  // Pas de navigation : la page reste affichée derrière la modale — état
  // local de l'élève dont le mémo est actuellement consulté (`null` = aucune
  // modale ouverte). Même pattern que MyStudentsPage.
  const [memoModalStudent, setMemoModalStudent] = useState<{
    studentId: string
    displayName: string
  } | null>(null)

  return (
    <DashboardShell
      accentClass="role-parent"
      railGroups={railGroups}
      topNavItems={topNavItems}
      userName={firstName}
      userRole="Parent"
    >
      {/* Salutation */}
      <PageTitle title={`Bonjour, ${firstName}`} subtitle="Vue d'ensemble de vos élèves" />

      {/* Actions rapides */}
      <div className="grid grid-cols-3 gap-3 mb-7 vm-quick-grid">
        {[
          { label: 'Calendrier', path: '/calendar' },
          { label: 'Finances', path: '/finance' },
          { label: 'Rattacher un élève', path: '/parent-link-requests' },
        ].map((quickAction) => (
          <Link
            key={quickAction.path}
            to={quickAction.path}
            style={{ boxShadow: 'var(--shadow-card)' }}
            className="flex items-center justify-center py-3.5 px-3 bg-[var(--color-white)] border border-[var(--color-surface)] rounded-[var(--radius-card)] text-[13px] font-medium text-[color:var(--color-ink)] no-underline text-center transition-shadow duration-150"
          >
            {quickAction.label}
          </Link>
        ))}
      </div>

      {/* Cards élèves */}
      <div>
        <h2 className="font-[var(--font-heading)] text-[15px] font-semibold text-[color:var(--color-ink)] mb-4">
          Mes élèves
        </h2>

        {isLoading ? (
          <p className="text-[13px] text-[color:var(--color-text-secondary)]">Chargement…</p>
        ) : studentCards.length === 0 ? (
          <div className="bg-[var(--color-white)] border border-[var(--color-surface)] rounded-[var(--radius-card)] p-8 text-center">
            <p className="text-[14px] text-[color:var(--color-text-secondary)] mb-4">
              Aucun élève rattaché à votre compte.
            </p>
            <Link
              to="/parent-link-requests"
              className="text-[13px] font-semibold text-white bg-[var(--accent)] rounded-[var(--radius-pill)] py-2 px-5 no-underline"
            >
              Rattacher un élève
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,_minmax(300px,_1fr))] gap-4">
            {studentCards.map((studentCard) => (
              <div
                key={studentCard.studentId}
                style={{ boxShadow: 'var(--shadow-card)' }}
                className="bg-[var(--color-white)] border border-[var(--color-surface)] rounded-[var(--radius-card)] p-5"
              >
                {/* En-tête carte */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-[var(--accent)] flex items-center justify-center text-white font-bold text-[16px] shrink-0">
                    {studentCard.displayName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-[15px] font-semibold text-[color:var(--color-ink)] m-0">
                      {studentCard.displayName}
                    </p>
                    {studentCard.loginIdentifier && (
                      <p className="text-[11px] text-[color:var(--color-text-secondary)] m-0">
                        {studentCard.loginIdentifier}
                      </p>
                    )}
                  </div>
                </div>

                {/* Prochain cours */}
                <div className="p-3 bg-[var(--color-bg)] rounded-[var(--radius-field)] mb-3">
                  <p className="text-[11px] font-semibold text-[color:var(--color-text-secondary)] mb-1">
                    PROCHAIN COURS
                  </p>
                  {studentCard.nextCourse ? (
                    <p className="text-[13px] text-[color:var(--color-ink)] font-medium">
                      {studentCard.nextCourse.title ?? 'Séance programmée'}{' '}
                      <span className="text-[color:var(--color-text-secondary)] font-normal">
                        — {new Date(studentCard.nextCourse.startAt).toLocaleDateString('fr-FR', {
                          weekday: 'short',
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </p>
                  ) : studentCard.calendarError ? (
                    <p className="text-[13px] text-red-700">{studentCard.calendarError}</p>
                  ) : (
                    <p className="text-[13px] text-[color:var(--color-text-secondary)]">
                      Aucun cours à venir
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2 flex-wrap">
                  <Link
                    to={`/profiles/${studentCard.studentId}`}
                    className="text-[12px] text-[color:var(--accent)] border border-[var(--color-surface)] rounded-[var(--radius-pill)] py-[5px] px-3 no-underline font-medium"
                  >
                    Profil
                  </Link>
                  <Link
                    to={`/calendar?studentId=${studentCard.studentId}`}
                    className="text-[12px] text-[color:var(--accent)] border border-[var(--color-surface)] rounded-[var(--radius-pill)] py-[5px] px-3 no-underline font-medium"
                  >
                    Calendrier
                  </Link>
                  <Link
                    to={`/pedagogical-log?studentId=${studentCard.studentId}`}
                    className="text-[12px] text-[color:var(--accent)] border border-[var(--color-surface)] rounded-[var(--radius-pill)] py-[5px] px-3 no-underline font-medium"
                  >
                    Cahier
                  </Link>
                  <button
                    type="button"
                    onClick={() =>
                      setMemoModalStudent({
                        studentId: studentCard.studentId,
                        displayName: studentCard.displayName,
                      })
                    }
                    className="text-[12px] text-[color:var(--accent)] border border-[var(--color-surface)] rounded-[var(--radius-pill)] py-[5px] px-3 font-medium"
                  >
                    Mémos
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {memoModalStudent && (
        <MemoReadOnlyModal
          studentId={memoModalStudent.studentId}
          title={`Mémo de ${memoModalStudent.displayName}`}
          onClose={() => setMemoModalStudent(null)}
        />
      )}

      <style>{`
        @media (max-width: 768px) {
          .vm-quick-grid { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>
    </DashboardShell>
  )
}
