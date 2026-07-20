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

  // Détecter le professeur principal parmi les contacts
  const principalTeacher = contacts.find(
    (contact) => contact.role === 'formateur' && contact.mandatory,
  ) ?? contacts.find((contact) => contact.role === 'formateur') ?? null

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
