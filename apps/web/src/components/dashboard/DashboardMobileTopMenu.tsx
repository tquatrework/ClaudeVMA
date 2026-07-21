/**
 * DashboardMobileTopMenu — menu mobile déroulant de la barre haute de DashboardShell.
 * Extrait de DashboardShell (lot 10 — normalisation, découpage > 300 lignes).
 * Rendu identique à l'origine.
 */

import React from 'react'
import { Link } from 'react-router-dom'
import type { NavItem } from '../../types/navigation'

interface DashboardMobileTopMenuProps {
  topNavItems: NavItem[]
  isActive: (path: string) => boolean
  onNavigate: () => void
  onLogout: () => void
}

export function DashboardMobileTopMenu({
  topNavItems,
  isActive,
  onNavigate,
  onLogout,
}: DashboardMobileTopMenuProps) {
  return (
    <div className="bg-[var(--color-white)] border-b border-[var(--color-surface)] py-3 px-5 flex flex-col gap-0.5 z-[99] vm-mobile-menu">
      {topNavItems.map((navItem) => (
        <Link
          key={navItem.path}
          to={navItem.path}
          onClick={onNavigate}
          style={{
            fontWeight: isActive(navItem.path) ? 600 : 400,
            color: isActive(navItem.path) ? 'var(--accent)' : 'var(--color-ink)',
          }}
          className="text-sm no-underline py-[11px] border-b border-[var(--color-surface)] flex items-center gap-2.5"
        >
          {navItem.label}
        </Link>
      ))}
      <button
        onClick={onLogout}
        className="text-sm text-red-500 bg-transparent border-none text-left py-[11px] cursor-pointer"
      >
        Déconnexion
      </button>
    </div>
  )
}
