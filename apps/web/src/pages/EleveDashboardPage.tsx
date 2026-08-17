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

import React from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import DashboardShell from '../components/dashboard/DashboardShell'
import '../styles/tokens.css'
import { formatCountdown, formatEventDate, formatShortDate } from '../utils/dateFormat'
import { getRailGroupsForRole, filterTopNavItems } from '../navigation/navigationConfig'
import { DashboardCard, DashboardSectionTitle, DashboardCardLabel } from '../components/ui/DashboardCard'
import { ActivityFeed } from '../components/ui/ActivityFeed'
import { ImportantContacts } from '../components/ui/ImportantContacts'
import { PageTitle } from '../components/ui/PageTitle'
import { useRoleAccent } from '../hooks/useRoleAccent'
import { useUpcomingCourses } from '../hooks/dashboard/useUpcomingCourses'
import { useDashboardNotifications } from '../hooks/dashboard/useDashboardNotifications'
import { useDashboardContacts } from '../hooks/dashboard/useDashboardContacts'
import { useAssignedTeacher } from '../hooks/dashboard/useAssignedTeacher'
import { useActiveTeacherRequest } from '../hooks/dashboard/useActiveTeacherRequest'
import { useReadOnlyAvatar } from '../hooks/profile/useReadOnlyAvatar'
import { describeTeacherRelationName } from '../utils/relationLabels'
import { getInitials } from '../utils/role'
import { StatusBadge } from '../components/ui/StatusBadge'

// Alias pour la rétrocompatibilité interne
const Card = DashboardCard
const SectionTitle = DashboardSectionTitle

// ─── Composant principal ────────────────────────────────────

export default function EleveDashboardPage() {
  const { user, hasRole } = useAuth()
  const firstName = user?.loginIdentifier ?? 'vous'

  const { nextCourse, upcomingCourses, isLoadingCourses } = useUpcomingCourses(user?.id, 3)
  const { notifications, isLoadingNotifications } = useDashboardNotifications(5)
  const { contacts, isLoadingContacts } = useDashboardContacts(5)
  const { assignedTeacher, isLoadingTeacher } = useAssignedTeacher(user?.id)
  // Troisième état du dashboard élève : une demande de professeur (ou de changement de
  // professeur principal) est encore ouverte. `GET /teacher-requests?scope=open` renvoie déjà
  // les seules demandes non terminales — pending/redirected — donc la présence d'une ligne
  // suffit (docs/routes.md § teacher-request-service).
  const { hasActiveRequest, isLoadingActiveRequest } = useActiveTeacherRequest(user?.id)

  const topNavItems = filterTopNavItems('eleve', hasRole)

  // Rail avec chemin carnet personnel résolu
  const baseRailGroups = getRailGroupsForRole('eleve')
  const railGroupsWithNotebook = user
    ? baseRailGroups.map((group) => ({
        ...group,
        items: group.items.map((item) =>
          item.label === 'Carnet personnel' ? { ...item, path: `/notebook/${user.id}` } : item,
        ),
      }))
    : baseRailGroups

  // Professeur assigné, résolu depuis la relation élève↔formateur de profile-service
  // (source de vérité de l'affectation pédagogique — pas les contacts de
  // communication-service). Nom et photo suivent les mêmes règles UX que partout
  // ailleurs : jamais d'UUID, dégradation silencieuse vers des initiales sans photo.
  const teacherDisplayName = assignedTeacher ? describeTeacherRelationName(assignedTeacher) : null
  const { photoObjectUrl: teacherPhotoObjectUrl } = useReadOnlyAvatar(assignedTeacher?.teacherId)

  const isVisioSoon =
    nextCourse !== null &&
    new Date(nextCourse.startAt).getTime() - Date.now() < 30 * 60 * 1000

  return (
    <DashboardShell
      accentClass="role-eleve"
      railGroups={railGroupsWithNotebook}
      topNavItems={topNavItems}
      userName={firstName}
      userRole="Élève"
    >
      {/* ── Salutation ─────────────────────────────────────── */}
      <PageTitle title={`Bonjour, ${firstName}`} subtitle="Voici votre espace élève" />

      {/* ── LIGNE 1 : Professeur attitré + Prochain cours ─── */}
      <div className="grid grid-cols-[1fr_2fr] gap-4 mb-5 vm-grid-hero">
        {/* Carte professeur attitré */}
        <Card>
          <p className="text-[10px] font-bold text-[color:var(--color-text-secondary)] uppercase tracking-[0.08em] mb-3">
            Mon professeur
          </p>

          {assignedTeacher ? (
            <div>
              {/* Avatar + nom */}
              <div className="flex items-center gap-3 mb-3.5">
                <div className="w-11 h-11 rounded-full bg-[var(--accent-alpha-15)] border-2 border-[var(--accent)] flex items-center justify-center text-[color:var(--accent)] font-bold text-[18px] shrink-0 overflow-hidden">
                  {teacherPhotoObjectUrl ? (
                    <img
                      src={teacherPhotoObjectUrl}
                      alt={`Photo de ${teacherDisplayName}`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    getInitials(teacherDisplayName ?? '')
                  )}
                </div>
                <div>
                  <p className="text-[14px] font-semibold text-[color:var(--color-ink)] m-0">
                    {teacherDisplayName}
                  </p>
                  <p className="text-[12px] text-[color:var(--color-text-secondary)] mt-0.5 mb-0">
                    Mathématiques
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-2">
                <Link
                  to={`/profiles/${assignedTeacher.teacherId}`}
                  className="text-[12px] font-medium text-[color:var(--accent)] border border-[var(--color-surface)] rounded-[var(--radius-field)] py-[7px] px-3 no-underline text-center block"
                >
                  Voir le profil
                </Link>
                {!isLoadingActiveRequest &&
                  (hasActiveRequest ? (
                    <div className="text-center py-[7px] px-3">
                      <StatusBadge
                        status="pending"
                        label="Demande de changement en cours"
                        badgeClasses={{ pending: 'bg-yellow-100 text-yellow-700' }}
                      />
                    </div>
                  ) : (
                    <Link
                      to="/teacher-requests"
                      className="text-[12px] font-medium text-[color:var(--color-text-secondary)] border border-[var(--color-surface)] rounded-[var(--radius-field)] py-[7px] px-3 no-underline text-center block"
                    >
                      Changer de professeur
                    </Link>
                  ))}
                {isVisioSoon && nextCourse && (
                  <Link
                    to={`/activities/${nextCourse.id}`}
                    className="text-[12px] font-semibold text-white bg-[var(--accent)] rounded-[var(--radius-field)] py-[7px] px-3 no-underline text-center block"
                  >
                    Rejoindre la visio
                  </Link>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-2">
              <div className="w-11 h-11 rounded-full bg-[var(--color-surface)] flex items-center justify-center mx-auto mb-3 text-[20px]">
                ?
              </div>
              <p className="text-[13px] text-[color:var(--color-text-secondary)] mb-3.5 leading-[1.4]">
                Vous n'avez pas pour l'instant de professeur attitré
              </p>
              {!isLoadingActiveRequest &&
                (hasActiveRequest ? (
                  <StatusBadge
                    status="pending"
                    label="Demande en cours"
                    badgeClasses={{ pending: 'bg-yellow-100 text-yellow-700' }}
                    size="md"
                  />
                ) : (
                  <Link
                    to="/teacher-requests"
                    className="text-[12px] font-semibold text-white bg-[var(--accent)] rounded-[var(--radius-field)] py-2 px-3.5 no-underline inline-block"
                  >
                    Demander un professeur
                  </Link>
                ))}
            </div>
          )}
        </Card>

        {/* Hero — Prochain cours */}
        <Card style={{ padding: '24px' }}>
          <p className="text-[10px] font-bold text-[color:var(--color-text-secondary)] uppercase tracking-[0.08em] mb-2.5">
            Prochain cours
          </p>

          {isLoadingCourses ? (
            <p className="text-[13px] text-[color:var(--color-text-secondary)]">Chargement…</p>
          ) : nextCourse ? (
            <div>
              <h2 className="font-[var(--font-heading)] text-[20px] font-bold text-[color:var(--color-ink)] mb-1">
                {nextCourse.title ?? 'Séance de mathématiques'}
              </h2>
              <p className="text-[13px] text-[color:var(--color-text-secondary)] mb-4">
                {formatEventDate(nextCourse.startAt)}
              </p>
              <div className="flex items-center gap-2.5 flex-wrap">
                {/* background gardé en inline : valeur color-mix() calculée, pas un token statique */}
                <span
                  style={{ background: 'color-mix(in srgb, var(--accent) 12%, transparent)' }}
                  className="text-[12px] font-semibold text-[color:var(--accent)] rounded-[var(--radius-pill)] py-1 px-3"
                >
                  {formatCountdown(nextCourse.startAt)}
                </span>
                <span className="text-[12px] bg-[var(--color-surface)] text-[color:var(--color-text-secondary)] rounded-[var(--radius-pill)] py-1 px-3">
                  visio
                </span>
                <Link
                  to={`/activities/${nextCourse.id}`}
                  className="ml-auto text-[13px] font-semibold text-white bg-[var(--accent)] rounded-[var(--radius-pill)] py-2 px-5 no-underline inline-flex items-center gap-1.5"
                >
                  ▶ Rejoindre
                </Link>
              </div>

              {/* Prochains cours */}
              {upcomingCourses.length > 0 && (
                <div className="mt-4 pt-3.5 border-t border-[var(--color-surface)]">
                  <p className="text-[10px] font-bold text-[color:var(--color-text-secondary)] uppercase tracking-[0.08em] mb-2">
                    À venir
                  </p>
                  <div className="flex flex-col gap-1">
                    {upcomingCourses.map((courseEvent) => (
                      <Link
                        key={courseEvent.id}
                        to={`/activities/${courseEvent.id}`}
                        className="flex justify-between items-center py-1.5 border-b border-[var(--color-surface)] no-underline"
                      >
                        <span className="text-[13px] text-[color:var(--color-ink)]">
                          {courseEvent.title ?? 'Séance'}
                        </span>
                        <span className="text-[11px] text-[color:var(--color-text-secondary)]">
                          {formatShortDate(courseEvent.startAt)}
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : assignedTeacher ? (
            <div className="text-center py-4">
              <p className="text-[14px] text-[color:var(--color-text-secondary)] mb-4">
                Vous n'avez pas de prochain cours
              </p>
              <button
                type="button"
                disabled
                title="Bientôt disponible, via la messagerie"
                className="text-[13px] font-medium text-[color:var(--color-text-secondary)] border border-[var(--color-surface)] rounded-[var(--radius-pill)] py-2 px-5 opacity-60 cursor-not-allowed"
              >
                Contacter mon professeur
              </button>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-[14px] text-[color:var(--color-text-secondary)] mb-4">
                Aucun cours à venir
              </p>
              {!isLoadingTeacher &&
                !isLoadingActiveRequest &&
                (hasActiveRequest ? (
                  <StatusBadge
                    status="pending"
                    label="Demande en cours"
                    badgeClasses={{ pending: 'bg-yellow-100 text-yellow-700' }}
                    size="md"
                  />
                ) : (
                  <Link
                    to="/contacts"
                    className="text-[13px] font-medium text-[color:var(--accent)] border border-[var(--accent)] rounded-[var(--radius-pill)] py-2 px-5 no-underline"
                  >
                    Demander un professeur
                  </Link>
                ))}
            </div>
          )}
        </Card>
      </div>

      {/* ── LIGNE 2 : Travail en cours | À ne pas oublier ── */}
      <div className="grid grid-cols-2 gap-4 mb-5 vm-grid-work">
        {/* Travail en cours */}
        <Card>
          <SectionTitle>Travail en cours</SectionTitle>

          <p className="text-[13px] text-[color:var(--color-text-secondary)] mb-4">
            Aucun travail en cours pour l'instant.
          </p>

          <div className="flex gap-2 flex-wrap">
            <Link
              to="/content/exercises"
              className="text-[12px] text-[color:var(--accent)] no-underline"
            >
              Exercices →
            </Link>
            <Link
              to="/content/evaluations"
              className="text-[12px] text-[color:var(--accent)] no-underline"
            >
              Évaluations →
            </Link>
            <Link
              to="/community/paths"
              className="text-[12px] text-[color:var(--accent)] no-underline"
            >
              Parcours →
            </Link>
          </div>
        </Card>

        {/* À ne pas oublier */}
        <Card>
          <SectionTitle>À ne pas oublier</SectionTitle>

          <p className="text-[13px] text-[color:var(--color-text-secondary)] mb-3.5">
            Aucun rappel pour l'instant.
          </p>

          <Link
            to="/calendar"
            className="inline-block text-[12px] text-[color:var(--accent)] no-underline"
          >
            Voir le calendrier →
          </Link>
        </Card>
      </div>

      {/* ── LIGNE 3 : Contacts importants + Fil d'activité ─ */}
      <div className="grid grid-cols-[1fr_2fr] gap-4 vm-grid-bottom">
        <Card>
          <ImportantContacts contacts={contacts} isLoading={isLoadingContacts} />
        </Card>

        <Card>
          <ActivityFeed notifications={notifications} isLoading={isLoadingNotifications} />
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
