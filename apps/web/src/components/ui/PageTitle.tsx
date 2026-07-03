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
    <div style={{ marginBottom: '24px' }}>
      <h1
        style={{
          fontFamily: 'var(--font-heading)',
          fontSize: '24px',
          fontWeight: 700,
          color: 'var(--color-ink)',
          margin: 0,
        }}
      >
        {title}
      </h1>
      {subtitle && (
        <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
          {subtitle}
        </p>
      )}
    </div>
  )
}
