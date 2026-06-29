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
  userRole,
  children,
}: DashboardShellProps) {
  const { logout, user } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [isMobileRailOpen, setIsMobileRailOpen] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(`${path}/`)

  const hasConsentWarning = user?.validationStatus === 'pending'

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
          boxShadow: 'var(--shadow-card)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 24px',
          gap: '24px',
          position: 'sticky',
          top: 0,
          zIndex: 100,
          flexShrink: 0,
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

        {/* Nav desktop */}
        <nav
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            flex: 1,
            overflowX: 'auto',
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
          <Link
            to={user ? `/profiles/${user.id}` : '/dashboard'}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}
          >
            <div
              style={{
                width: '32px',
                height: '32px',
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
              padding: '4px',
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
            padding: '12px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
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

      {/* CORPS : RAIL + ZONE CENTRALE */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* RAIL */}
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
                  fontSize: '11px',
                  fontWeight: 600,
                  color: 'var(--color-text-secondary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  padding: '0 16px',
                  marginBottom: '4px',
                }}
              >
                {group.groupLabel}
              </p>
              {group.items.map((railItem) => (
                <Link
                  key={railItem.path}
                  to={railItem.path}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 16px',
                    fontSize: '13px',
                    fontWeight: isActive(railItem.path) ? 600 : 400,
                    color: isActive(railItem.path) ? 'var(--accent)' : 'var(--color-ink)',
                    textDecoration: 'none',
                    background: isActive(railItem.path) ? 'var(--accent-alpha-10, rgba(91,108,240,0.10))' : 'transparent',
                    borderLeft: isActive(railItem.path) ? '3px solid var(--accent)' : '3px solid transparent',
                    transition: 'background 0.15s',
                    position: 'relative',
                  }}
                >
                  {railItem.icon && (
                    <span style={{ fontSize: '16px', flexShrink: 0 }}>{railItem.icon}</span>
                  )}
                  <span className="vm-rail-label">{railItem.label}</span>
                  {railItem.badge && railItem.badge > 0 ? (
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

          {/* Bouton rail mobile */}
          <button
            onClick={() => setIsMobileRailOpen(false)}
            style={{
              display: 'none',
              margin: '12px 16px 0',
              fontSize: '12px',
              color: 'var(--color-text-secondary)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
            }}
            className="vm-rail-close"
          >
            Fermer
          </button>
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
                      fontSize: '11px',
                      fontWeight: 600,
                      color: 'var(--color-text-secondary)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      padding: '0 16px',
                      marginBottom: '4px',
                    }}
                  >
                    {group.groupLabel}
                  </p>
                  {group.items.map((railItem) => (
                    <Link
                      key={railItem.path}
                      to={railItem.path}
                      onClick={() => setIsMobileRailOpen(false)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '10px 16px',
                        fontSize: '14px',
                        fontWeight: isActive(railItem.path) ? 600 : 400,
                        color: isActive(railItem.path) ? 'var(--accent)' : 'var(--color-ink)',
                        textDecoration: 'none',
                        borderLeft: isActive(railItem.path) ? '3px solid var(--accent)' : '3px solid transparent',
                      }}
                    >
                      {railItem.icon && <span style={{ fontSize: '16px' }}>{railItem.icon}</span>}
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
            padding: '32px',
          }}
          className="vm-main"
        >
          {/* Bouton ouvrir rail mobile */}
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
            Menu
          </button>

          {children}
        </main>
      </div>

      {/* Styles responsive inlined */}
      <style>{`
        @media (max-width: 1024px) {
          .vm-rail { width: var(--rail-width-collapsed) !important; }
          .vm-rail-label { display: none !important; }
        }
        @media (max-width: 768px) {
          .vm-rail { display: none !important; }
          .vm-topnav-desktop { display: none !important; }
          .vm-burger { display: flex !important; }
          .vm-rail-toggle { display: block !important; }
          .vm-avatar-name { display: none !important; }
          .vm-main { padding: 16px !important; }
          .vm-mobile-menu { display: flex !important; }
        }
      `}</style>
    </div>
  )
}
