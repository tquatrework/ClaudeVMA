/**
 * RoleBadge — Badge de rôle utilisateur
 * AccessBadge — Badge de type d'accès (contexte)
 *
 * Centralisés : couleur et libellé selon configuration commune.
 */

import React from 'react'
import type { UserRole } from '../../types/user'
import { getRoleLabel } from '../../utils/role'

interface RoleBadgeProps {
  role: UserRole | string
}

export function RoleBadge({ role }: RoleBadgeProps) {
  return (
    <span
      style={{
        fontSize: '11px',
        fontWeight: 600,
        background: 'var(--accent-alpha-10, rgba(91,108,240,0.10))',
        color: 'var(--accent)',
        borderRadius: 'var(--radius-pill)',
        padding: '2px 8px',
        display: 'inline-block',
      }}
    >
      {getRoleLabel(role as UserRole)}
    </span>
  )
}

type AccessLevel = 'own' | 'close' | 'professional' | 'supervision' | 'readonly' | 'sensitive'

const ACCESS_LEVEL_CONFIG: Record<AccessLevel, { label: string; color: string; bg: string }> = {
  own: { label: 'Mon espace', color: '#1d4ed8', bg: '#eff6ff' },
  close: { label: 'Contact proche', color: '#15803d', bg: '#f0fdf4' },
  professional: { label: 'Accès professionnel', color: '#c2410c', bg: '#fff7ed' },
  supervision: { label: 'Supervision', color: '#7c3aed', bg: '#f5f3ff' },
  readonly: { label: 'Lecture seule', color: '#6b7280', bg: '#f9fafb' },
  sensitive: { label: 'Action sensible', color: '#dc2626', bg: '#fef2f2' },
}

interface AccessBadgeProps {
  level: AccessLevel
}

export function AccessBadge({ level }: AccessBadgeProps) {
  const config = ACCESS_LEVEL_CONFIG[level]
  return (
    <span
      style={{
        fontSize: '11px',
        fontWeight: 600,
        background: config.bg,
        color: config.color,
        borderRadius: 'var(--radius-pill)',
        padding: '2px 8px',
        display: 'inline-block',
      }}
    >
      {config.label}
    </span>
  )
}
