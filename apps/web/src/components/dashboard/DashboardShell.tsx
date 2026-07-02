import React, { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

export interface NavItem {
  label: string
  path: string
  badge?: number
}

export interface RailItem {
  label: string
  path: string
  badge?: number
  icon?: string
}

export interface RailGroup {
  groupLabel: string
  items: RailItem[]
}

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

  const hasConsentWarning = user?.validationStatus === 'pending'

  const railWidth = isRailCollapsed ? '56px' : 'var(--rail-width)'

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
      {/* Bannière consentement */}
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

      {/* TOP BAR */}
      <header
        style={{
          height: 'var(--topbar-height)',
          background: 'var(--color-white)',
          borderBottom: '1px solid var(--color-surface)',
          boxShadow: 'var(--shadow-card)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px 0 0',
          gap: '0',
          position: 'sticky',
          top: 0,
          zIndex: 100,
          flexShrink: 0,
        }}
      >
        {/* Zone logo + bouton masquer rail — largeur calée sur le rail */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            width: railWidth,
            flexShrink: 0,
            padding: '0 12px',
            transition: 'width 0.2s ease',
            overflow: 'hidden',
          }}
          className="vm-rail-header-zone"
        >
          {/* Bouton toggle rail (desktop seulement) */}
          <button
            onClick={() => setIsRailCollapsed(!isRailCollapsed)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: 'var(--radius-field)',
              color: 'var(--color-text-secondary)',
              display: 'flex',
              flexDirection: 'column',
              gap: '3px',
              flexShrink: 0,
            }}
            aria-label={isRailCollapsed ? 'Afficher le menu outils' : 'Masquer le menu outils'}
            className="vm-rail-toggle-btn"
          >
            <span style={{ display: 'block', width: '16px', height: '2px', background: 'currentColor', borderRadius: '1px' }} />
            <span style={{ display: 'block', width: '16px', height: '2px', background: 'currentColor', borderRadius: '1px' }} />
            <span style={{ display: 'block', width: '16px', height: '2px', background: 'currentColor', borderRadius: '1px' }} />
          </button>

          {/* Logo — masqué quand rail très étroit */}
          <Link
            to="/dashboard"
            style={{
              fontFamily: 'var(--font-heading)',
              fontWeight: 700,
              fontSize: '17px',
              color: 'var(--accent)',
              textDecoration: 'none',
              flexShrink: 0,
              letterSpacing: '-0.3px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              opacity: isRailCollapsed ? 0 : 1,
              transition: 'opacity 0.15s ease',
              pointerEvents: isRailCollapsed ? 'none' : 'auto',
            }}
            className="vm-logo-text"
          >
            VisioMath
          </Link>
        </div>

        {/* Séparateur vertical */}
        <div style={{ width: '1px', height: '28px', background: 'var(--color-surface)', flexShrink: 0 }} className="vm-header-sep" />

        {/* Nav desktop */}
        <nav
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '2px',
            flex: 1,
            overflowX: 'auto',
            padding: '0 12px',
          }}
          className="vm-topnav-desktop"
        >
          {topNavItems.map((navItem) => (
            <Link
              key={navItem.path}
              to={navItem.path}
              style={{
                fontSize: '13px',
                fontWeight: isActive(navItem.path) ? 600 : 500,
                color: isActive(navItem.path) ? 'var(--accent)' : 'var(--color-text-secondary)',
                textDecoration: 'none',
                padding: '6px 10px',
                borderRadius: 'var(--radius-field)',
                background: isActive(navItem.path) ? 'var(--accent-alpha-10, rgba(91,108,240,0.10))' : 'transparent',
                whiteSpace: 'nowrap',
                transition: 'color 0.15s, background 0.15s',
                position: 'relative',
              }}
            >
              {navItem.label}
              {navItem.badge && navItem.badge > 0 ? (
                <span
                  style={{
                    position: 'absolute',
                    top: '2px',
                    right: '2px',
                    background: '#ef4444',
                    color: '#fff',
                    fontSize: '10px',
                    fontWeight: 700,
                    borderRadius: '9999px',
                    minWidth: '16px',
                    height: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 4px',
                  }}
                >
                  {navItem.badge}
                </span>
              ) : null}
            </Link>
          ))}
        </nav>

        {/* Avatar / profil */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, paddingRight: '4px' }}>
          <Link
            to={user ? `/profiles/${user.id}` : '/dashboard'}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}
          >
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
                fontSize: '12px',
                flexShrink: 0,
              }}
            >
              {userName.charAt(0).toUpperCase()}
            </div>
            <span
              style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-ink)' }}
              className="vm-avatar-name"
            >
              {userName}
            </span>
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
              padding: '6px',
            }}
            aria-label="Menu"
            className="vm-burger"
          >
            <span style={{ display: 'block', width: '20px', height: '2px', background: 'var(--color-ink)' }} />
            <span style={{ display: 'block', width: '20px', height: '2px', background: 'var(--color-ink)' }} />
            <span style={{ display: 'block', width: '20px', height: '2px', background: 'var(--color-ink)' }} />
          </button>
        </div>
      </header>

      {/* Menu mobile top */}
      {isMobileMenuOpen && (
        <div
          style={{
            background: 'var(--color-white)',
            borderBottom: '1px solid var(--color-surface)',
            padding: '12px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
            zIndex: 99,
          }}
          className="vm-mobile-menu"
        >
          {topNavItems.map((navItem) => (
            <Link
              key={navItem.path}
              to={navItem.path}
              onClick={() => setIsMobileMenuOpen(false)}
              style={{
                fontSize: '14px',
                fontWeight: isActive(navItem.path) ? 600 : 400,
                color: isActive(navItem.path) ? 'var(--accent)' : 'var(--color-ink)',
                textDecoration: 'none',
                padding: '11px 0',
                borderBottom: '1px solid var(--color-surface)',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
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
              padding: '11px 0',
              cursor: 'pointer',
            }}
          >
            Déconnexion
          </button>
        </div>
      )}

      {/* CORPS : RAIL + ZONE CENTRALE */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* RAIL gauche — desktop et tablette */}
        <aside
          style={{
            width: railWidth,
            flexShrink: 0,
            background: 'var(--color-white)',
            borderRight: '1px solid var(--color-surface)',
            overflowY: 'auto',
            overflowX: 'hidden',
            padding: '16px 0',
            transition: 'width 0.2s ease',
          }}
          className="vm-rail"
        >
          {railGroups.map((group) => (
            <div key={group.groupLabel} style={{ marginBottom: '20px' }}>
              {/* Label de groupe — masqué quand rail réduit */}
              {!isRailCollapsed && (
                <p
                  style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    color: 'var(--color-text-secondary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    padding: '0 16px',
                    marginBottom: '4px',
                  }}
                >
                  {group.groupLabel}
                </p>
              )}
              {isRailCollapsed && (
                <div style={{ height: '8px' }} />
              )}
              {group.items.map((railItem) => (
                <Link
                  key={`${railItem.path}-${railItem.label}`}
                  to={railItem.path}
                  title={isRailCollapsed ? railItem.label : undefined}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: isRailCollapsed ? '10px 0' : '8px 16px',
                    justifyContent: isRailCollapsed ? 'center' : 'flex-start',
                    fontSize: '13px',
                    fontWeight: isActive(railItem.path) ? 600 : 400,
                    color: isActive(railItem.path) ? 'var(--accent)' : 'var(--color-ink)',
                    textDecoration: 'none',
                    background: isActive(railItem.path) ? 'var(--accent-alpha-10, rgba(91,108,240,0.10))' : 'transparent',
                    borderLeft: isActive(railItem.path) ? '3px solid var(--accent)' : '3px solid transparent',
                    transition: 'background 0.15s',
                    position: 'relative',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                  }}
                >
                  {railItem.icon && (
                    <span style={{ fontSize: '16px', flexShrink: 0 }}>{railItem.icon}</span>
                  )}
                  {!isRailCollapsed && (
                    <span>{railItem.label}</span>
                  )}
                  {!isRailCollapsed && railItem.badge && railItem.badge > 0 ? (
                    <span
                      style={{
                        marginLeft: 'auto',
                        background: 'var(--accent)',
                        color: '#fff',
                        fontSize: '10px',
                        fontWeight: 700,
                        borderRadius: '9999px',
                        minWidth: '18px',
                        height: '18px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '0 4px',
                      }}
                    >
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
                width: '260px',
                background: 'var(--color-white)',
                boxShadow: 'var(--shadow-card-hover)',
                overflowY: 'auto',
                padding: '16px 0',
              }}
            >
              {/* En-tête tiroir mobile */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0 16px 16px',
                  borderBottom: '1px solid var(--color-surface)',
                  marginBottom: '8px',
                }}
              >
                <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '16px', color: 'var(--accent)' }}>
                  Outils
                </span>
                <button
                  onClick={() => setIsMobileRailOpen(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '18px',
                    color: 'var(--color-text-secondary)',
                    padding: '4px',
                    lineHeight: 1,
                  }}
                  aria-label="Fermer le menu outils"
                >
                  ✕
                </button>
              </div>

              {railGroups.map((group) => (
                <div key={group.groupLabel} style={{ marginBottom: '20px' }}>
                  <p
                    style={{
                      fontSize: '10px',
                      fontWeight: 700,
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
                      key={`${railItem.path}-${railItem.label}`}
                      to={railItem.path}
                      onClick={() => setIsMobileRailOpen(false)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '11px 16px',
                        fontSize: '14px',
                        fontWeight: isActive(railItem.path) ? 600 : 400,
                        color: isActive(railItem.path) ? 'var(--accent)' : 'var(--color-ink)',
                        textDecoration: 'none',
                        borderLeft: isActive(railItem.path) ? '3px solid var(--accent)' : '3px solid transparent',
                        background: isActive(railItem.path) ? 'var(--accent-alpha-10, rgba(91,108,240,0.10))' : 'transparent',
                      }}
                    >
                      {railItem.icon && <span style={{ fontSize: '17px' }}>{railItem.icon}</span>}
                      {railItem.label}
                    </Link>
                  ))}
                </div>
              ))}
            </div>
            <div
              style={{ flex: 1, background: 'rgba(30,34,48,0.3)' }}
              onClick={() => setIsMobileRailOpen(false)}
            />
          </div>
        )}

        {/* ZONE CENTRALE */}
        <main
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '28px',
          }}
          className="vm-main"
        >
          {/* Barre mobile : logo + bouton ouvrir rail */}
          <div
            style={{
              display: 'none',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '16px',
            }}
            className="vm-mobile-topbar"
          >
            <Link
              to="/dashboard"
              style={{
                fontFamily: 'var(--font-heading)',
                fontWeight: 700,
                fontSize: '16px',
                color: 'var(--accent)',
                textDecoration: 'none',
              }}
            >
              VisioMath
            </Link>
            <button
              onClick={() => setIsMobileRailOpen(true)}
              style={{
                fontSize: '13px',
                fontWeight: 500,
                color: 'var(--accent)',
                background: 'none',
                border: '1px solid var(--color-surface)',
                borderRadius: 'var(--radius-field)',
                padding: '6px 14px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
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
