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
import { filterTopNavItems, getRailGroupsForRole } from '../navigation/navigationConfig'
import type { UserRole } from '../context/AuthContext'

/* ─────────────────────────────────────────────────────────
   Composant principal
   Navigation et rail lus depuis navigationConfig — source unique.
───────────────────────────────────────────────────────── */

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout, isAuthenticated, hasRole } = useAuth()
  const { accentClass } = useRoleAccent()
  const navigate = useNavigate()
  const location = useLocation()

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isMobileRailOpen, setIsMobileRailOpen] = useState(false)

  // Navigation haute — filtrée depuis la config centralisée
  const visibleTopNavItems = filterTopNavItems(user?.role, hasRole)

  // Rail gauche — depuis la config centralisée, avec résolution du carnet personnel
  const baseRailGroups = user ? getRailGroupsForRole(user.role) : []
  const railGroups = user?.role === 'eleve'
    ? baseRailGroups.map((group) => ({
        ...group,
        items: group.items.map((item) =>
          item.label === 'Carnet personnel' ? { ...item, path: `/notebook/${user.id}` } : item,
        ),
      }))
    : baseRailGroups

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const isActivePath = (path: string) =>
    location.pathname === path || location.pathname.startsWith(`${path}/`)

  const hasConsentWarning =
    isAuthenticated && user?.validationStatus === 'pending'

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
            {/* Icône notifications */}
            <Link
              to="/notifications"
              title="Notifications"
              aria-label="Notifications"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '30px',
                height: '30px',
                borderRadius: 'var(--radius-field)',
                color: 'var(--color-text-secondary)',
                textDecoration: 'none',
                fontSize: '17px',
                transition: 'color 0.15s',
                flexShrink: 0,
              }}
            >
              🔔
            </Link>

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
