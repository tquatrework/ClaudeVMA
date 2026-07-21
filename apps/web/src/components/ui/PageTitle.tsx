/**
 * PageTitle — Titre de page avec salutation et sous-titre
 *
 * Partagé entre tous les dashboards (bloc "Bonjour, [prénom]").
 */

import React from 'react'

interface PageTitleProps {
  /** Texte principal */
  title: string
  /** Sous-titre ou description */
  subtitle?: string
}

export function PageTitle({ title, subtitle }: PageTitleProps) {
  return (
    <div className="mb-6">
      <h1 className="font-[var(--font-heading)] text-[24px] font-bold text-[color:var(--color-ink)] m-0">
        {title}
      </h1>
      {subtitle && (
        <p className="text-[13px] text-[color:var(--color-text-secondary)] mt-1">
          {subtitle}
        </p>
      )}
    </div>
  )
}
