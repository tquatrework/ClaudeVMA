import React, { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

// Re-export des types centralisés pour la rétrocompatibilité
export type { NavItem, RailItem, RailGroup } from '../../types/navigation'
import type { NavItem, RailGroup } from '../../types/navigation'
import { DashboardMobileRailDrawer } from './DashboardMobileRailDrawer'
import { DashboardMobileTopMenu } from './DashboardMobileTopMenu'
import { AccountStatusBanners } from '../layout/AccountStatusBanners'

interface DashboardShellProps {
  accentClass: string
  railGroups: RailGroup[]
  topNavItems: NavItem[]
  userName: string
  userRole: string
  children: React.ReactNode
}

export default function DashboardShell({
  accentClass,
  railGroups,
  topNavItems,
  userName,
  children,
}: DashboardShellProps) {
  const { logout, user } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [isMobileRailOpen, setIsMobileRailOpen] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isRailCollapsed, setIsRailCollapsed] = useState(false)

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(`${path}/`)

  const railWidth = isRailCollapsed ? '56px' : 'var(--rail-width)'

  return (
    <div
      className={`vm-shell ${accentClass} min-h-screen bg-[var(--color-bg)] text-[color:var(--color-ink)] font-[var(--font-body)] flex flex-col`}
    >
      {/* Bannières statut de compte (consentement, dossier formateur) */}
      <AccountStatusBanners />

      {/* TOP BAR */}
      {/* box-shadow gardé en inline : la syntaxe Tailwind shadow-[var(...)] interprète
          une valeur commençant par var( comme une couleur de teinte, pas comme le
          box-shadow complet — cf. valeurs "shadow-card" définies dans tokens.css */}
      <header
        style={{ boxShadow: 'var(--shadow-card)' }}
        className="h-[var(--topbar-height)] bg-[var(--color-white)] border-b border-[var(--color-surface)] flex items-center pr-4 sticky top-0 z-[100] shrink-0"
      >
        {/* Zone logo + bouton masquer rail — largeur calée sur le rail */}
        <div
          style={{ width: railWidth }}
          className="flex items-center gap-2 shrink-0 px-3 overflow-hidden transition-[width] duration-200 ease-in-out vm-rail-header-zone"
        >
          {/* Bouton toggle rail (desktop seulement) */}
          <button
            onClick={() => setIsRailCollapsed(!isRailCollapsed)}
            className="bg-transparent border-none cursor-pointer p-1.5 rounded-[var(--radius-field)] text-[color:var(--color-text-secondary)] flex flex-col gap-[3px] shrink-0 vm-rail-toggle-btn"
            aria-label={isRailCollapsed ? 'Afficher le menu outils' : 'Masquer le menu outils'}
          >
            <span className="block w-4 h-0.5 bg-current rounded-[1px]" />
            <span className="block w-4 h-0.5 bg-current rounded-[1px]" />
            <span className="block w-4 h-0.5 bg-current rounded-[1px]" />
          </button>

          {/* Logo — masqué quand rail très étroit */}
          <Link
            to="/dashboard"
            style={{
              opacity: isRailCollapsed ? 0 : 1,
              pointerEvents: isRailCollapsed ? 'none' : 'auto',
            }}
            className="font-[var(--font-heading)] font-bold text-[17px] text-[color:var(--accent)] no-underline shrink-0 tracking-[-0.3px] whitespace-nowrap overflow-hidden transition-opacity duration-150 ease-in-out vm-logo-text"
          >
            VisioMath
          </Link>
        </div>

        {/* Séparateur vertical */}
        <div className="w-px h-7 bg-[var(--color-surface)] shrink-0 vm-header-sep" />

        {/* Nav desktop */}
        <nav className="flex items-center gap-0.5 flex-1 overflow-x-auto px-3 vm-topnav-desktop">
          {topNavItems.map((navItem) => (
            <Link
              key={navItem.path}
              to={navItem.path}
              style={{
                fontWeight: isActive(navItem.path) ? 600 : 500,
                color: isActive(navItem.path) ? 'var(--accent)' : 'var(--color-text-secondary)',
                background: isActive(navItem.path) ? 'var(--accent-alpha-10, rgba(91,108,240,0.10))' : 'transparent',
              }}
              className="text-[13px] no-underline py-1.5 px-2.5 rounded-[var(--radius-field)] whitespace-nowrap transition-colors duration-150 ease-in-out relative"
            >
              {navItem.label}
              {navItem.badge && navItem.badge > 0 ? (
                <span className="absolute top-0.5 right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                  {navItem.badge}
                </span>
              ) : null}
            </Link>
          ))}
        </nav>

        {/* Avatar / profil */}
        <div className="flex items-center gap-2 shrink-0 pr-1">
          {/* Icône notifications */}
          <Link
            to="/notifications"
            title="Notifications"
            aria-label="Notifications"
            className="flex items-center justify-center w-[30px] h-[30px] rounded-[var(--radius-field)] text-[color:var(--color-text-secondary)] no-underline text-[17px] transition-colors duration-150 ease-in-out shrink-0 vm-avatar-name"
          >
            🔔
          </Link>

          <Link
            to={user ? `/profiles/${user.id}` : '/dashboard'}
            className="flex items-center gap-2 no-underline"
          >
            <div className="w-[30px] h-[30px] rounded-full bg-[var(--accent)] flex items-center justify-center text-white font-bold text-[12px] shrink-0">
              {userName.charAt(0).toUpperCase()}
            </div>
            <span
              className="text-[13px] font-medium text-[color:var(--color-ink)] vm-avatar-name"
            >
              {userName}
            </span>
          </Link>

          <button
            onClick={handleLogout}
            className="text-[12px] text-[color:var(--color-text-secondary)] bg-transparent border-none cursor-pointer py-1 px-2 rounded-[var(--radius-field)] vm-avatar-name"
          >
            Déconnexion
          </button>

          {/* Burger mobile */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="bg-transparent border-none cursor-pointer hidden flex-col gap-1 p-1.5 vm-burger"
            aria-label="Menu"
          >
            <span className="block w-5 h-0.5 bg-[var(--color-ink)]" />
            <span className="block w-5 h-0.5 bg-[var(--color-ink)]" />
            <span className="block w-5 h-0.5 bg-[var(--color-ink)]" />
          </button>
        </div>
      </header>

      {/* Menu mobile top */}
      {isMobileMenuOpen && (
        <DashboardMobileTopMenu
          topNavItems={topNavItems}
          isActive={isActive}
          onNavigate={() => setIsMobileMenuOpen(false)}
          onLogout={handleLogout}
        />
      )}

      {/* CORPS : RAIL + ZONE CENTRALE */}
      <div className="flex flex-1 overflow-hidden">

        {/* RAIL gauche — desktop et tablette */}
        <aside
          style={{ width: railWidth }}
          className="shrink-0 bg-[var(--color-white)] border-r border-[var(--color-surface)] overflow-y-auto overflow-x-hidden py-4 transition-[width] duration-200 ease-in-out vm-rail"
        >
          {railGroups.map((group) => (
            <div key={group.groupLabel} className="mb-5">
              {/* Label de groupe — masqué quand rail réduit */}
              {!isRailCollapsed && (
                <p className="text-[10px] font-bold text-[color:var(--color-text-secondary)] uppercase tracking-[0.08em] px-4 mb-1">
                  {group.groupLabel}
                </p>
              )}
              {isRailCollapsed && (
                <div className="h-2" />
              )}
              {group.items.map((railItem) => (
                <Link
                  key={`${railItem.path}-${railItem.label}`}
                  to={railItem.path}
                  title={isRailCollapsed ? railItem.label : undefined}
                  style={{
                    padding: isRailCollapsed ? '10px 0' : '8px 16px',
                    justifyContent: isRailCollapsed ? 'center' : 'flex-start',
                    fontWeight: isActive(railItem.path) ? 600 : 400,
                    color: isActive(railItem.path) ? 'var(--accent)' : 'var(--color-ink)',
                    background: isActive(railItem.path) ? 'var(--accent-alpha-10, rgba(91,108,240,0.10))' : 'transparent',
                    borderLeft: isActive(railItem.path) ? '3px solid var(--accent)' : '3px solid transparent',
                  }}
                  className="flex items-center gap-2 text-[13px] no-underline transition-[background] duration-150 ease-in-out relative whitespace-nowrap overflow-hidden"
                >
                  {railItem.icon && (
                    <span className="text-[16px] shrink-0">{railItem.icon}</span>
                  )}
                  {!isRailCollapsed && (
                    <span>{railItem.label}</span>
                  )}
                  {!isRailCollapsed && railItem.badge && railItem.badge > 0 ? (
                    <span className="ml-auto bg-[var(--accent)] text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                      {railItem.badge}
                    </span>
                  ) : null}
                </Link>
              ))}
            </div>
          ))}
        </aside>

        {/* Tiroir rail mobile */}
        {isMobileRailOpen && (
          <DashboardMobileRailDrawer
            railGroups={railGroups}
            isActive={isActive}
            onClose={() => setIsMobileRailOpen(false)}
          />
        )}

        {/* ZONE CENTRALE */}
        <main className="flex-1 overflow-y-auto p-7 vm-main">
          {/* Barre mobile : logo + bouton ouvrir rail */}
          <div className="hidden items-center justify-between mb-4 vm-mobile-topbar">
            <Link
              to="/dashboard"
              className="font-[var(--font-heading)] font-bold text-[16px] text-[color:var(--accent)] no-underline"
            >
              VisioMath
            </Link>
            <button
              onClick={() => setIsMobileRailOpen(true)}
              className="text-[13px] font-medium text-[color:var(--accent)] bg-transparent border border-[var(--color-surface)] rounded-[var(--radius-field)] py-1.5 px-3.5 cursor-pointer flex items-center gap-1.5"
            >
              Menu outils
            </button>
          </div>

          {children}
        </main>
      </div>

      {/* Styles responsive inlined */}
      <style>{`
        /* Tablette (769px–1024px) : rail visible avec libellés complets, légèrement plus étroit */
        @media (max-width: 1024px) and (min-width: 769px) {
          .vm-rail { width: 148px !important; }
          .vm-rail-header-zone { width: 148px !important; }
        }
        /* Mobile : rail masqué, burger visible, barre mobile visible */
        @media (max-width: 768px) {
          .vm-rail { display: none !important; }
          .vm-rail-header-zone { display: none !important; }
          .vm-header-sep { display: none !important; }
          .vm-rail-toggle-btn { display: none !important; }
          .vm-topnav-desktop { display: none !important; }
          .vm-burger { display: flex !important; }
          .vm-avatar-name { display: none !important; }
          .vm-main { padding: 16px !important; }
          .vm-mobile-topbar { display: flex !important; }
          .vm-logo-text { display: none !important; }
        }
      `}</style>
    </div>
  )
}
