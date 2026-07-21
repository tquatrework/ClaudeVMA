/**
 * DashboardMobileRailDrawer — tiroir mobile du rail gauche de DashboardShell.
 * Extrait de DashboardShell (lot 10 — normalisation, découpage > 300 lignes).
 * Rendu identique à l'origine.
 */

import React from 'react'
import { Link } from 'react-router-dom'
import type { RailGroup } from '../../types/navigation'

interface DashboardMobileRailDrawerProps {
  railGroups: RailGroup[]
  isActive: (path: string) => boolean
  onClose: () => void
}

export function DashboardMobileRailDrawer({
  railGroups,
  isActive,
  onClose,
}: DashboardMobileRailDrawerProps) {
  return (
    <div className="fixed inset-0 z-[200] flex">
      <div
        style={{ boxShadow: 'var(--shadow-card-hover)' }}
        className="w-[260px] bg-[var(--color-white)] overflow-y-auto py-4"
      >
        {/* En-tête tiroir mobile */}
        <div className="flex items-center justify-between px-4 pb-4 border-b border-[var(--color-surface)] mb-2">
          <span className="font-[var(--font-heading)] font-bold text-[16px] text-[color:var(--accent)]">
            Outils
          </span>
          <button
            onClick={onClose}
            className="bg-transparent border-none cursor-pointer text-[18px] text-[color:var(--color-text-secondary)] p-1 leading-none"
            aria-label="Fermer le menu outils"
          >
            ✕
          </button>
        </div>

        {railGroups.map((group) => (
          <div key={group.groupLabel} className="mb-5">
            <p className="text-[10px] font-bold text-[color:var(--color-text-secondary)] uppercase tracking-[0.08em] px-4 mb-1">
              {group.groupLabel}
            </p>
            {group.items.map((railItem) => (
              <Link
                key={`${railItem.path}-${railItem.label}`}
                to={railItem.path}
                onClick={onClose}
                style={{
                  fontWeight: isActive(railItem.path) ? 600 : 400,
                  color: isActive(railItem.path) ? 'var(--accent)' : 'var(--color-ink)',
                  borderLeft: isActive(railItem.path) ? '3px solid var(--accent)' : '3px solid transparent',
                  background: isActive(railItem.path) ? 'var(--accent-alpha-10, rgba(91,108,240,0.10))' : 'transparent',
                }}
                className="flex items-center gap-2.5 py-[11px] px-4 text-sm no-underline"
              >
                {railItem.icon && <span className="text-[17px]">{railItem.icon}</span>}
                {railItem.label}
              </Link>
            ))}
          </div>
        ))}
      </div>
      <div
        className="flex-1 bg-[rgba(30,34,48,0.3)]"
        onClick={onClose}
      />
    </div>
  )
}
