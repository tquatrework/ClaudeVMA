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
      className={`vm-shell ${accentClass} min-h-screen bg-[var(--color-bg)] text-[color:var(--color-ink)] font-[var(--font-body)] flex flex-col`}
    >
      {/* ── Bannière consentement ───────────────────────────── */}
      {hasConsentWarning && (
        <div className="bg-yellow-50 border-b border-amber-200 py-2 px-6 text-center text-[var(--font-size-body-sm)] text-amber-800">
          Votre compte n'est pas encore activé.{' '}
          <Link to="/consents" className="underline font-semibold">
            Signer les consentements
          </Link>{' '}
          pour activer votre espace.
        </div>
      )}

      {/* ── TOP BAR ────────────────────────────────────────── */}
      {/* box-shadow gardé en inline : la syntaxe Tailwind shadow-[var(...)] interprète
          une valeur commençant par var( comme une couleur de teinte, pas comme le
          box-shadow complet — cf. valeurs "shadow-card" définies dans tokens.css */}
      <header
        style={{ boxShadow: 'var(--shadow-card)' }}
        className="h-[var(--topbar-height)] bg-[var(--color-white)] border-b border-[var(--color-surface)] flex items-center px-6 gap-5 sticky top-0 z-[100] shrink-0"
      >
        {/* Logo */}
        <Link
          to="/dashboard"
          className="font-[var(--font-heading)] font-bold text-[18px] text-[color:var(--accent)] no-underline shrink-0 tracking-[-0.3px]"
        >
          VisioMath
        </Link>

        {/* Navigation principale desktop */}
        {isAuthenticated && (
          <nav className="flex items-center gap-0.5 flex-1 overflow-x-auto vm-topnav-desktop">
            {visibleTopNavItems.map((navItem) => (
              <Link
                key={navItem.path}
                to={navItem.path}
                style={{
                  fontWeight: isActivePath(navItem.path) ? 600 : 500,
                  color: isActivePath(navItem.path)
                    ? 'var(--accent)'
                    : 'var(--color-text-secondary)',
                  background: isActivePath(navItem.path)
                    ? 'var(--accent-alpha-10, rgba(91,108,240,0.10))'
                    : 'transparent',
                }}
                className="text-[13px] no-underline py-1.5 px-2.5 rounded-[var(--radius-field)] whitespace-nowrap transition-colors duration-150 ease-in-out"
              >
                {navItem.label}
              </Link>
            ))}
          </nav>
        )}

        {/* Identité + déconnexion */}
        {isAuthenticated && (
          <div className="flex items-center gap-2.5 shrink-0 ml-auto">
            {/* Icône notifications */}
            <Link
              to="/notifications"
              title="Notifications"
              aria-label="Notifications"
              className="flex items-center justify-center w-[30px] h-[30px] rounded-[var(--radius-field)] text-[color:var(--color-text-secondary)] no-underline text-[17px] transition-colors duration-150 ease-in-out shrink-0"
            >
              🔔
            </Link>

            <Link
              to={user ? `/profiles/${user.id}` : '/dashboard'}
              className="flex items-center gap-2 no-underline"
            >
              {/* Avatar */}
              <div className="w-[30px] h-[30px] rounded-full bg-[var(--accent)] flex items-center justify-center text-white font-bold text-[13px] shrink-0">
                {userAvatarLetter}
              </div>
              <span className="text-[13px] font-medium text-[color:var(--color-ink)] vm-avatar-name">
                {userName}
              </span>
              {user?.validationStatus === 'pending' && (
                <span className="text-[11px] bg-amber-100 text-amber-800 py-0.5 px-2 rounded-[var(--radius-pill)] font-semibold vm-avatar-name">
                  non activé
                </span>
              )}
            </Link>

            <button
              onClick={handleLogout}
              className="text-[12px] text-[color:var(--color-text-secondary)] bg-transparent border-none cursor-pointer py-1 px-2 rounded-[var(--radius-field)] transition-colors duration-150 ease-in-out vm-avatar-name"
            >
              Déconnexion
            </button>

            {/* Burger mobile */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="bg-transparent border-none cursor-pointer hidden flex-col gap-1 p-1 vm-burger"
              aria-label="Menu"
            >
              <span className="block w-5 h-0.5 bg-[var(--color-ink)]" />
              <span className="block w-5 h-0.5 bg-[var(--color-ink)]" />
              <span className="block w-5 h-0.5 bg-[var(--color-ink)]" />
            </button>
          </div>
        )}
      </header>

      {/* ── Menu mobile top ─────────────────────────────────── */}
      {isAuthenticated && isMobileMenuOpen && (
        <div className="bg-[var(--color-white)] border-b border-[var(--color-surface)] py-3 px-6 flex flex-col gap-0.5 z-[99] vm-mobile-menu">
          {visibleTopNavItems.map((navItem) => (
            <Link
              key={navItem.path}
              to={navItem.path}
              onClick={() => setIsMobileMenuOpen(false)}
              style={{
                fontWeight: isActivePath(navItem.path) ? 600 : 400,
                color: isActivePath(navItem.path)
                  ? 'var(--accent)'
                  : 'var(--color-ink)',
              }}
              className="text-sm no-underline py-2.5 border-b border-[var(--color-surface)]"
            >
              {navItem.label}
            </Link>
          ))}
          <button
            onClick={handleLogout}
            className="text-sm text-red-500 bg-transparent border-none text-left py-2.5 cursor-pointer"
          >
            Déconnexion
          </button>
        </div>
      )}

      {/* ── CORPS : RAIL + ZONE CENTRALE ────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* RAIL gauche */}
        {isAuthenticated && railGroups.length > 0 && (
          <aside className="w-[var(--rail-width)] shrink-0 bg-[var(--color-white)] border-r border-[var(--color-surface)] overflow-y-auto py-5 vm-rail">
            {railGroups.map((group) => (
              <div key={group.groupLabel} className="mb-6">
                <p className="text-[10px] font-semibold text-[color:var(--color-text-secondary)] uppercase tracking-[0.08em] px-4 mb-1">
                  {group.groupLabel}
                </p>
                {group.items.map((railItem) => (
                  <Link
                    key={railItem.path + railItem.label}
                    to={railItem.path}
                    style={{
                      fontWeight: isActivePath(railItem.path) ? 600 : 400,
                      color: isActivePath(railItem.path)
                        ? 'var(--accent)'
                        : 'var(--color-ink)',
                      background: isActivePath(railItem.path)
                        ? 'var(--accent-alpha-10, rgba(91,108,240,0.10))'
                        : 'transparent',
                      borderLeft: isActivePath(railItem.path)
                        ? '3px solid var(--accent)'
                        : '3px solid transparent',
                    }}
                    className="flex items-center gap-2 py-2 px-4 text-[13px] no-underline transition-[background] duration-150 ease-in-out"
                  >
                    <span className="text-[16px] shrink-0">
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
          <div className="fixed inset-0 z-[200] flex">
            <div
              style={{ boxShadow: 'var(--shadow-card-hover)' }}
              className="w-[240px] bg-[var(--color-white)] overflow-y-auto py-5"
            >
              {railGroups.map((group) => (
                <div key={group.groupLabel} className="mb-6">
                  <p className="text-[10px] font-semibold text-[color:var(--color-text-secondary)] uppercase tracking-[0.08em] px-4 mb-1">
                    {group.groupLabel}
                  </p>
                  {group.items.map((railItem) => (
                    <Link
                      key={railItem.path + railItem.label}
                      to={railItem.path}
                      onClick={() => setIsMobileRailOpen(false)}
                      style={{
                        fontWeight: isActivePath(railItem.path) ? 600 : 400,
                        color: isActivePath(railItem.path)
                          ? 'var(--accent)'
                          : 'var(--color-ink)',
                        borderLeft: isActivePath(railItem.path)
                          ? '3px solid var(--accent)'
                          : '3px solid transparent',
                      }}
                      className="flex items-center gap-2 py-2.5 px-4 text-sm no-underline"
                    >
                      <span className="text-[16px]">{railItem.icon}</span>
                      {railItem.label}
                    </Link>
                  ))}
                </div>
              ))}
              <button
                onClick={() => setIsMobileRailOpen(false)}
                className="mx-4 text-[12px] text-[color:var(--color-text-secondary)] bg-transparent border-none cursor-pointer py-2"
              >
                Fermer
              </button>
            </div>
            {/* Overlay */}
            <div
              className="flex-1 bg-[rgba(30,34,48,0.3)]"
              onClick={() => setIsMobileRailOpen(false)}
            />
          </div>
        )}

        {/* ZONE CONTENU */}
        <main className="flex-1 overflow-y-auto bg-[var(--color-bg)] p-6 vm-main">
          {/* Bouton ouvrir rail mobile (affiché seulement si rail existe) */}
          {isAuthenticated && railGroups.length > 0 && (
            <button
              onClick={() => setIsMobileRailOpen(true)}
              className="hidden mb-4 text-[12px] text-[color:var(--accent)] bg-transparent border border-[var(--color-surface)] rounded-[var(--radius-field)] py-1.5 px-3 cursor-pointer vm-rail-toggle"
            >
              Menu outils
            </button>
          )}

          {children}
        </main>
      </div>

      {/* ── Footer ─────────────────────────────────────────── */}
      <footer className="py-3 px-6 text-center text-[12px] text-[color:var(--color-text-secondary)] border-t border-[var(--color-surface)] bg-[var(--color-white)]">
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
