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
      className={`bg-[var(--color-white)] border border-[var(--color-surface)] rounded-[var(--radius-card)] p-5 ${className ?? ''}`}
      // box-shadow gardé en inline : la syntaxe Tailwind shadow-[var(...)] interprète
      // une valeur commençant par var( comme une couleur de teinte, pas comme le
      // box-shadow complet — cf. valeurs "shadow-card" définies dans tokens.css.
      // `style` reste par ailleurs le point d'extension public du composant (ex.
      // surcharge ponctuelle de padding par un appelant).
      style={{
        boxShadow: 'var(--shadow-card)',
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
    <h3 className="font-[var(--font-heading)] text-[15px] font-semibold text-[color:var(--color-ink)] mb-3.5">
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
    <p className="text-[10px] font-bold text-[color:var(--color-text-secondary)] uppercase tracking-[0.08em] mb-2.5">
      {children}
    </p>
  )
}
