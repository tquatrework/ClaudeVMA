/**
 * DashboardCard — Carte standard pour les blocs de dashboard
 *
 * Composant de base partagé entre tous les dashboards.
 * Remplace les div inline répétées dans EleveDashboard, ProfesseurDashboard, etc.
 */

import React from 'react'

interface DashboardCardProps {
  children: React.ReactNode
  style?: React.CSSProperties
  className?: string
}

export function DashboardCard({ children, style, className }: DashboardCardProps) {
  return (
    <div
      className={className}
      style={{
        background: 'var(--color-white)',
        border: '1px solid var(--color-surface)',
        borderRadius: 'var(--radius-card)',
        boxShadow: 'var(--shadow-card)',
        padding: '20px',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

interface DashboardSectionTitleProps {
  children: React.ReactNode
}

/**
 * Titre de section dans une card de dashboard.
 * Remplace le composant SectionTitle local de EleveDashboardPage.
 */
export function DashboardSectionTitle({ children }: DashboardSectionTitleProps) {
  return (
    <h3
      style={{
        fontFamily: 'var(--font-heading)',
        fontSize: '15px',
        fontWeight: 600,
        color: 'var(--color-ink)',
        margin: '0 0 14px',
      }}
    >
      {children}
    </h3>
  )
}

interface DashboardCardLabelProps {
  children: React.ReactNode
}

/**
 * Label de catégorie (petits caps) dans une card.
 */
export function DashboardCardLabel({ children }: DashboardCardLabelProps) {
  return (
    <p
      style={{
        fontSize: '10px',
        fontWeight: 700,
        color: 'var(--color-text-secondary)',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        marginBottom: '10px',
      }}
    >
      {children}
    </p>
  )
}
