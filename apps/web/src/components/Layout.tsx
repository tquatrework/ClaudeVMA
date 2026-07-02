/**
 * Layout — AppShell unifié VisioMath
 *
 * Architecture :
 *   - Bannière consentement (si pending)
 *   - Top bar (~52px) : logo accent rôle + navigation principale + identité
 *   - Body (flex row) :
 *       - Rail gauche (~172px desktop / 64px tablette / tiroir mobile)
 *       - Zone contenu (flex:1, padding 24px)
 *   - Footer
 *
 * Règle : ne touche pas à la logique métier ni aux guards de rôles.
 * Tous les `hasRole` existants sont conservés à l'identique.
 */

import React, { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useRoleAccent } from '../hooks/useRoleAccent'
import type { UserRole } from '../context/AuthContext'

/* ─────────────────────────────────────────────────────────
   Types internes
───────────────────────────────────────────────────────── */

interface TopNavItem {
  label: string
  path: string
  /** Rôles autorisés — undefined = accessible à tous les connectés */
  allowedRoles?: UserRole[]
  /** Condition booléenne supplémentaire (ex : besoin du user.id) */
  condition?: boolean
}

interface RailItem {
  label: string
  path: string
  icon: string
}

interface RailGroup {
  groupLabel: string
  items: RailItem[]
}

/* ─────────────────────────────────────────────────────────
   Navigation principale (top bar)
   Les conditions hasRole sont CONSERVÉES À L'IDENTIQUE
   depuis l'ancienne Layout.tsx.
───────────────────────────────────────────────────────── */

function useTopNavItems(): TopNavItem[] {
  return [
    { label: 'Accueil', path: '/dashboard' },

    /*
     * Calendrier : retiré du top pour parent_financeur (déjà dans son rail).
     * Accessible aux autres rôles connectés.
     */
    {
      label: 'Calendrier',
      path: '/calendar',
      allowedRoles: [
        'eleve',
        'formateur',
        'animateur_pedagogique',
        'responsable_pedagogique',
        'technicien_informatique',
        'administrateur_financier',
      ],
    },

    /* Contacts : séparé de Messages comme dans les dashboards dédiés */
    { label: 'Contacts', path: '/contacts' },

    { label: 'Messages', path: '/messages' },

    /*
     * Demandes : retiré du top pour formateur (déjà dans son rail sous "Demandes prof.").
     */
    {
      label: 'Demandes',
      path: '/teacher-requests',
      allowedRoles: [
        'eleve',
        'parent_financeur',
        'animateur_pedagogique',
        'responsable_pedagogique',
        'technicien_informatique',
        'administrateur_financier',
      ],
    },

    /*
     * Incidents : retiré du top pour technicien_informatique (déjà dans son rail).
     * RP n'a pas Incidents dans son rail → conservé.
     */
    {
      label: 'Incidents',
      path: '/incidents',
      allowedRoles: ['responsable_pedagogique'],
    },

    {
      label: 'Admin',
      path: '/admin/activity',
      allowedRoles: [
        'responsable_pedagogique',
        'animateur_pedagogique',
        'technicien_informatique',
        'administrateur_financier',
      ],
    },

    /*
     * Comptes : retiré du top pour responsable_pedagogique et technicien_informatique
     * (déjà dans leurs rails respectifs).
     */

    /*
     * Délégations : retiré du top pour administrateur_financier (déjà dans son rail).
     * Conservé pour responsable_pedagogique et technicien_informatique.
     */
    {
      label: 'Délégations',
      path: '/delegations',
      allowedRoles: ['responsable_pedagogique', 'technicien_informatique'],
    },

    /*
     * Finances : retiré du top pour parent_financeur (déjà dans son rail).
     * Conservé pour administrateur_financier.
     */
    {
      label: 'Finances',
      path: '/finance',
      allowedRoles: ['administrateur_financier'],
    },

    /*
     * Paiements : retiré du top pour administrateur_financier (déjà dans son rail).
     * Conservé pour formateur.
     */
    {
      label: 'Paiements',
      path: '/teacher-payment-requests',
      allowedRoles: ['formateur'],
    },

    /*
     * Documents légaux : retiré du top pour parent_financeur et administrateur_financier
     * (déjà dans leurs rails). Conservé pour eleve et formateur.
     */
    {
      label: 'Documents légaux',
      path: '/legal',
      allowedRoles: ['eleve', 'formateur'],
    },

    {
      label: 'Espace AF',
      path: '/admin/finance',
      allowedRoles: ['administrateur_financier'],
    },
  ]
}

/* ─────────────────────────────────────────────────────────
   Rail par rôle
───────────────────────────────────────────────────────── */

function useRailGroups(): RailGroup[] {
  const { user } = useAuth()

  if (!user) return []

  switch (user.role) {
    case 'eleve':
      return [
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
            { label: 'Mon carnet', path: `/notebook/${user.id}`, icon: '📓' },
            { label: 'Mémos', path: '/memos', icon: '💡' },
            { label: 'Parcours', path: '/community/paths', icon: '🗺️' },
            { label: 'Ressources', path: '/content/tutorials', icon: '🎬' },
          ],
        },
      ]

    case 'parent_financeur':
      return [
        {
          groupLabel: 'Suivi',
          items: [
            { label: 'Cahier de texte', path: '/pedagogical-log', icon: '📖' },
            { label: 'Calendrier enfant', path: '/calendar', icon: '📅' },
            { label: 'Archives', path: '/archives', icon: '🗂️' },
          ],
        },
        {
          groupLabel: 'Finances',
          items: [
            { label: 'Profil financier', path: '/finance', icon: '💳' },
            { label: 'Documents légaux', path: '/legal', icon: '📄' },
          ],
        },
      ]

    case 'formateur':
      return [
        {
          groupLabel: 'Cours',
          items: [
            { label: 'Démarrer la visio', path: '/activities', icon: '🎥' },
            { label: 'Tableau blanc', path: '/activities', icon: '✏️' },
          ],
        },
        {
          groupLabel: 'Travail',
          items: [
            { label: 'Cahier de texte', path: '/pedagogical-log', icon: '📖' },
            { label: 'Mes élèves', path: '/contacts', icon: '👥' },
            { label: 'Demandes prof.', path: '/teacher-requests', icon: '📋' },
          ],
        },
        {
          groupLabel: 'Contenus',
          items: [
            { label: 'Exercices', path: '/content/exercises', icon: '📐' },
            { label: 'Évaluations', path: '/content/evaluations', icon: '📝' },
            { label: 'Tutos vidéo', path: '/content/tutorials', icon: '🎬' },
          ],
        },
      ]

    case 'responsable_pedagogique':
      return [
        {
          groupLabel: 'Gestion',
          items: [
            { label: 'Demandes prof.', path: '/rp/teacher-requests', icon: '📋' },
            { label: 'Formateurs', path: '/contacts', icon: '👨‍🏫' },
            { label: 'Élèves', path: '/admin/accounts', icon: '🎓' },
          ],
        },
        {
          groupLabel: 'Validation',
          items: [
            { label: 'Contenus', path: '/content/validation', icon: '✅' },
            { label: 'Comptes', path: '/admin/accounts', icon: '🔑' },
          ],
        },
        {
          groupLabel: 'Outils',
          items: [
            { label: 'Archives', path: '/archives', icon: '🗂️' },
            { label: 'Parcours', path: '/community/paths', icon: '🗺️' },
            { label: 'Forums', path: '/community/forums', icon: '💬' },
          ],
        },
      ]

    case 'animateur_pedagogique':
      return [
        {
          groupLabel: 'Contenus',
          items: [
            { label: 'Mes contenus', path: '/content/exercises', icon: '📐' },
            { label: 'Évaluations', path: '/content/evaluations', icon: '📝' },
            { label: 'Tutos vidéo', path: '/content/tutorials', icon: '🎬' },
          ],
        },
        {
          groupLabel: 'Communauté',
          items: [
            { label: 'Forums', path: '/community/forums', icon: '💬' },
            { label: 'Parcours', path: '/community/paths', icon: '🗺️' },
          ],
        },
      ]

    case 'administrateur_financier':
      return [
        {
          groupLabel: 'Finances',
          items: [
            { label: 'Paiements', path: '/teacher-payment-requests', icon: '💳' },
            { label: 'Documents légaux', path: '/legal', icon: '📄' },
            { label: 'Modèles', path: '/legal/templates', icon: '📋' },
            { label: 'Exports', path: '/admin/activities/export', icon: '📊' },
          ],
        },
        {
          groupLabel: 'Documents',
          items: [
            { label: 'Archives', path: '/archives', icon: '🗂️' },
            { label: 'Délégations', path: '/delegations', icon: '🔗' },
          ],
        },
      ]

    case 'technicien_informatique':
      return [
        {
          groupLabel: 'Administration',
          items: [
            { label: 'Comptes', path: '/admin/accounts', icon: '🔑' },
            { label: 'Incidents', path: '/incidents', icon: '⚠️' },
            { label: 'Masquages', path: '/admin/observability/visibility-overrides', icon: '👁️' },
          ],
        },
        {
          groupLabel: 'Observabilité',
          items: [
            { label: 'Journaux', path: '/admin/observability/activity-log', icon: '📋' },
            { label: 'Logs techniques', path: '/admin/observability/technical-logs', icon: '🖥️' },
            { label: 'Santé services', path: '/admin/observability/health', icon: '💚' },
            { label: 'Orchestration', path: '/admin/orchestration/workflows', icon: '⚙️' },
          ],
        },
      ]

    default:
      return []
  }
}

/* ─────────────────────────────────────────────────────────
   Composant principal
───────────────────────────────────────────────────────── */

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout, isAuthenticated, hasRole } = useAuth()
  const { accentClass } = useRoleAccent()
  const navigate = useNavigate()
  const location = useLocation()

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isMobileRailOpen, setIsMobileRailOpen] = useState(false)

  const allTopNavItems = useTopNavItems()
  const railGroups = useRailGroups()

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const isActivePath = (path: string) =>
    location.pathname === path || location.pathname.startsWith(`${path}/`)

  const hasConsentWarning =
    isAuthenticated && user?.validationStatus === 'pending'

  /** Filtre les items de navigation selon les conditions de rôle */
  const visibleTopNavItems = allTopNavItems.filter((navItem) => {
    // Condition booléenne explicite (ex. documents légaux)
    if (navItem.condition !== undefined) return navItem.condition
    // Filtre par rôles autorisés
    if (navItem.allowedRoles && navItem.allowedRoles.length > 0) {
      return hasRole(...navItem.allowedRoles)
    }
    // Pas de restriction → visible à tous les connectés
    return true
  })

  const userName = user?.loginIdentifier ?? ''
  const userAvatarLetter = userName.charAt(0).toUpperCase() || '?'

  return (
    <div
      className={`vm-shell ${accentClass}`}
      style={{
        minHeight: '100vh',
        background: 'var(--color-bg)',
        color: 'var(--color-ink)',
        fontFamily: 'var(--font-body)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* ── Bannière consentement ───────────────────────────── */}
      {hasConsentWarning && (
        <div
          style={{
            background: '#fefce8',
            borderBottom: '1px solid #fde68a',
            padding: '8px 24px',
            textAlign: 'center',
            fontSize: '13px',
            color: '#92400e',
          }}
        >
          Votre compte n'est pas encore activé.{' '}
          <Link
            to="/consents"
            style={{ textDecoration: 'underline', fontWeight: 600 }}
          >
            Signer les consentements
          </Link>{' '}
          pour activer votre espace.
        </div>
      )}

      {/* ── TOP BAR ────────────────────────────────────────── */}
      <header
        style={{
          height: 'var(--topbar-height)',
          background: 'var(--color-white)',
          borderBottom: '1px solid var(--color-surface)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 24px',
          gap: '20px',
          position: 'sticky',
          top: 0,
          zIndex: 100,
          flexShrink: 0,
          boxShadow: 'var(--shadow-card)',
        }}
      >
        {/* Logo */}
        <Link
          to="/dashboard"
          style={{
            fontFamily: 'var(--font-heading)',
            fontWeight: 700,
            fontSize: '18px',
            color: 'var(--accent)',
            textDecoration: 'none',
            flexShrink: 0,
            letterSpacing: '-0.3px',
          }}
        >
          VisioMath
        </Link>

        {/* Navigation principale desktop */}
        {isAuthenticated && (
          <nav
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '2px',
              flex: 1,
              overflowX: 'auto',
            }}
            className="vm-topnav-desktop"
          >
            {visibleTopNavItems.map((navItem) => (
              <Link
                key={navItem.path}
                to={navItem.path}
                style={{
                  fontSize: '13px',
                  fontWeight: isActivePath(navItem.path) ? 600 : 500,
                  color: isActivePath(navItem.path)
                    ? 'var(--accent)'
                    : 'var(--color-text-secondary)',
                  textDecoration: 'none',
                  padding: '6px 10px',
                  borderRadius: 'var(--radius-field)',
                  background: isActivePath(navItem.path)
                    ? 'var(--accent-alpha-10, rgba(91,108,240,0.10))'
                    : 'transparent',
                  whiteSpace: 'nowrap',
                  transition: 'color 0.15s, background 0.15s',
                }}
              >
                {navItem.label}
              </Link>
            ))}
          </nav>
        )}

        {/* Identité + déconnexion */}
        {isAuthenticated && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              flexShrink: 0,
              marginLeft: 'auto',
            }}
          >
            <Link
              to={user ? `/profiles/${user.id}` : '/dashboard'}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                textDecoration: 'none',
              }}
            >
              {/* Avatar */}
              <div
                style={{
                  width: '30px',
                  height: '30px',
                  borderRadius: '50%',
                  background: 'var(--accent)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '13px',
                  flexShrink: 0,
                }}
              >
                {userAvatarLetter}
              </div>
              <span
                style={{
                  fontSize: '13px',
                  fontWeight: 500,
                  color: 'var(--color-ink)',
                }}
                className="vm-avatar-name"
              >
                {userName}
              </span>
              {user?.validationStatus === 'pending' && (
                <span
                  style={{
                    fontSize: '11px',
                    background: '#fef3c7',
                    color: '#92400e',
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-pill)',
                    fontWeight: 600,
                  }}
                  className="vm-avatar-name"
                >
                  non activé
                </span>
              )}
            </Link>

            <button
              onClick={handleLogout}
              style={{
                fontSize: '12px',
                color: 'var(--color-text-secondary)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px 8px',
                borderRadius: 'var(--radius-field)',
                transition: 'color 0.15s',
              }}
              className="vm-avatar-name"
            >
              Déconnexion
            </button>

            {/* Burger mobile */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                display: 'none',
                flexDirection: 'column',
                gap: '4px',
                padding: '4px',
              }}
              aria-label="Menu"
              className="vm-burger"
            >
              <span
                style={{
                  display: 'block',
                  width: '20px',
                  height: '2px',
                  background: 'var(--color-ink)',
                }}
              />
              <span
                style={{
                  display: 'block',
                  width: '20px',
                  height: '2px',
                  background: 'var(--color-ink)',
                }}
              />
              <span
                style={{
                  display: 'block',
                  width: '20px',
                  height: '2px',
                  background: 'var(--color-ink)',
                }}
              />
            </button>
          </div>
        )}
      </header>

      {/* ── Menu mobile top ─────────────────────────────────── */}
      {isAuthenticated && isMobileMenuOpen && (
        <div
          style={{
            background: 'var(--color-white)',
            borderBottom: '1px solid var(--color-surface)',
            padding: '12px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
            zIndex: 99,
          }}
          className="vm-mobile-menu"
        >
          {visibleTopNavItems.map((navItem) => (
            <Link
              key={navItem.path}
              to={navItem.path}
              onClick={() => setIsMobileMenuOpen(false)}
              style={{
                fontSize: '14px',
                fontWeight: isActivePath(navItem.path) ? 600 : 400,
                color: isActivePath(navItem.path)
                  ? 'var(--accent)'
                  : 'var(--color-ink)',
                textDecoration: 'none',
                padding: '10px 0',
                borderBottom: '1px solid var(--color-surface)',
              }}
            >
              {navItem.label}
            </Link>
          ))}
          <button
            onClick={handleLogout}
            style={{
              fontSize: '14px',
              color: '#ef4444',
              background: 'none',
              border: 'none',
              textAlign: 'left',
              padding: '10px 0',
              cursor: 'pointer',
            }}
          >
            Déconnexion
          </button>
        </div>
      )}

      {/* ── CORPS : RAIL + ZONE CENTRALE ────────────────────── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* RAIL gauche */}
        {isAuthenticated && railGroups.length > 0 && (
          <aside
            style={{
              width: 'var(--rail-width)',
              flexShrink: 0,
              background: 'var(--color-white)',
              borderRight: '1px solid var(--color-surface)',
              overflowY: 'auto',
              padding: '20px 0',
            }}
            className="vm-rail"
          >
            {railGroups.map((group) => (
              <div key={group.groupLabel} style={{ marginBottom: '24px' }}>
                <p
                  style={{
                    fontSize: '10px',
                    fontWeight: 600,
                    color: 'var(--color-text-secondary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    padding: '0 16px',
                    marginBottom: '4px',
                  }}
                >
                  {group.groupLabel}
                </p>
                {group.items.map((railItem) => (
                  <Link
                    key={railItem.path + railItem.label}
                    to={railItem.path}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 16px',
                      fontSize: '13px',
                      fontWeight: isActivePath(railItem.path) ? 600 : 400,
                      color: isActivePath(railItem.path)
                        ? 'var(--accent)'
                        : 'var(--color-ink)',
                      textDecoration: 'none',
                      background: isActivePath(railItem.path)
                        ? 'var(--accent-alpha-10, rgba(91,108,240,0.10))'
                        : 'transparent',
                      borderLeft: isActivePath(railItem.path)
                        ? '3px solid var(--accent)'
                        : '3px solid transparent',
                      transition: 'background 0.15s',
                    }}
                  >
                    <span style={{ fontSize: '16px', flexShrink: 0 }}>
                      {railItem.icon}
                    </span>
                    <span className="vm-rail-label">{railItem.label}</span>
                  </Link>
                ))}
              </div>
            ))}
          </aside>
        )}

        {/* Tiroir rail mobile */}
        {isMobileRailOpen && railGroups.length > 0 && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 200,
              display: 'flex',
            }}
          >
            <div
              style={{
                width: '240px',
                background: 'var(--color-white)',
                boxShadow: 'var(--shadow-card-hover)',
                overflowY: 'auto',
                padding: '20px 0',
              }}
            >
              {railGroups.map((group) => (
                <div key={group.groupLabel} style={{ marginBottom: '24px' }}>
                  <p
                    style={{
                      fontSize: '10px',
                      fontWeight: 600,
                      color: 'var(--color-text-secondary)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      padding: '0 16px',
                      marginBottom: '4px',
                    }}
                  >
                    {group.groupLabel}
                  </p>
                  {group.items.map((railItem) => (
                    <Link
                      key={railItem.path + railItem.label}
                      to={railItem.path}
                      onClick={() => setIsMobileRailOpen(false)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '10px 16px',
                        fontSize: '14px',
                        fontWeight: isActivePath(railItem.path) ? 600 : 400,
                        color: isActivePath(railItem.path)
                          ? 'var(--accent)'
                          : 'var(--color-ink)',
                        textDecoration: 'none',
                        borderLeft: isActivePath(railItem.path)
                          ? '3px solid var(--accent)'
                          : '3px solid transparent',
                      }}
                    >
                      <span style={{ fontSize: '16px' }}>{railItem.icon}</span>
                      {railItem.label}
                    </Link>
                  ))}
                </div>
              ))}
              <button
                onClick={() => setIsMobileRailOpen(false)}
                style={{
                  margin: '0 16px',
                  fontSize: '12px',
                  color: 'var(--color-text-secondary)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '8px 0',
                }}
              >
                Fermer
              </button>
            </div>
            {/* Overlay */}
            <div
              style={{ flex: 1, background: 'rgba(30,34,48,0.3)' }}
              onClick={() => setIsMobileRailOpen(false)}
            />
          </div>
        )}

        {/* ZONE CONTENU */}
        <main
          style={{
            flex: 1,
            overflowY: 'auto',
            background: 'var(--color-bg)',
            padding: '24px',
          }}
          className="vm-main"
        >
          {/* Bouton ouvrir rail mobile (affiché seulement si rail existe) */}
          {isAuthenticated && railGroups.length > 0 && (
            <button
              onClick={() => setIsMobileRailOpen(true)}
              style={{
                display: 'none',
                marginBottom: '16px',
                fontSize: '12px',
                color: 'var(--accent)',
                background: 'none',
                border: '1px solid var(--color-surface)',
                borderRadius: 'var(--radius-field)',
                padding: '6px 12px',
                cursor: 'pointer',
              }}
              className="vm-rail-toggle"
            >
              Menu outils
            </button>
          )}

          {children}
        </main>
      </div>

      {/* ── Footer ─────────────────────────────────────────── */}
      <footer
        style={{
          padding: '12px 24px',
          textAlign: 'center',
          fontSize: '12px',
          color: 'var(--color-text-secondary)',
          borderTop: '1px solid var(--color-surface)',
          background: 'var(--color-white)',
        }}
      >
        VisioMath © 2026
      </footer>

      {/* ── Styles responsives ──────────────────────────────── */}
      <style>{`
        /* Tablette (769px–1024px) : rail visible avec libellés complets */
        @media (max-width: 1024px) and (min-width: 769px) {
          .vm-rail { width: 148px !important; }
        }
        /* Mobile : rail masqué, burger visible */
        @media (max-width: 768px) {
          .vm-rail { display: none !important; }
          .vm-topnav-desktop { display: none !important; }
          .vm-burger { display: flex !important; }
          .vm-rail-toggle { display: block !important; }
          .vm-avatar-name { display: none !important; }
          .vm-main { padding: 16px !important; }
        }
      `}</style>
    </div>
  )
}
