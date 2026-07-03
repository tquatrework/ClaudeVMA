/**
 * StatusBadge — Badge de statut générique
 *
 * Affiche un libellé coloré pour n'importe quel statut métier.
 * Accepte une map de classes CSS (badgeClasses) ou utilise le fallback gris.
 */

import React from 'react'

interface StatusBadgeProps {
  /** Valeur brute du statut */
  status: string
  /** Libellé à afficher (si absent, on affiche status brut) */
  label?: string
  /** Map statut → classes CSS Tailwind */
  badgeClasses?: Record<string, string>
  /** Variante de taille */
  size?: 'sm' | 'md'
  /** Classes CSS supplémentaires */
  className?: string
}

const FALLBACK_CLASS = 'bg-gray-100 text-gray-500'

export function StatusBadge({
  status,
  label,
  badgeClasses,
  size = 'sm',
  className = '',
}: StatusBadgeProps) {
  const colorClass = badgeClasses?.[status] ?? FALLBACK_CLASS
  const sizeClass = size === 'sm'
    ? 'text-xs px-2 py-0.5 rounded font-medium'
    : 'text-sm px-3 py-1 rounded-full font-medium'

  return (
    <span className={`${sizeClass} ${colorClass} ${className}`}>
      {label ?? status}
    </span>
  )
}
