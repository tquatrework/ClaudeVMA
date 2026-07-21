/**
 * MobileRailDrawer — tiroir mobile du rail gauche de Layout (AppShell).
 * Extrait de Layout (lot 10 — normalisation, découpage > 300 lignes).
 * Rendu identique à l'origine.
 */

import React from 'react'
import { Link } from 'react-router-dom'
import type { RailGroup } from '../../types/navigation'

interface MobileRailDrawerProps {
  railGroups: RailGroup[]
  isActivePath: (path: string) => boolean
  onClose: () => void
}

export function MobileRailDrawer({ railGroups, isActivePath, onClose }: MobileRailDrawerProps) {
  return (
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
                onClick={onClose}
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
          onClick={onClose}
          className="mx-4 text-[12px] text-[color:var(--color-text-secondary)] bg-transparent border-none cursor-pointer py-2"
        >
          Fermer
        </button>
      </div>
      {/* Overlay */}
      <div
        className="flex-1 bg-[rgba(30,34,48,0.3)]"
        onClick={onClose}
      />
    </div>
  )
}
