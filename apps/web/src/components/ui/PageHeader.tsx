/**
 * PageHeader — En-tête de page avec titre, sous-titre et action optionnelle
 *
 * Remplace le pattern répété dans toutes les pages :
 *   <div className="flex items-start justify-between gap-4">
 *     <div><h1>...</h1><p>...</p></div>
 *     <button>...</button>
 *   </div>
 */

import React from 'react'

interface PageHeaderProps {
  /** Titre principal de la page (h1) */
  title: string
  /** Sous-titre ou description courte */
  subtitle?: string
  /** Contenu de droite (bouton d'action, lien, etc.) */
  action?: React.ReactNode
  className?: string
}

export function PageHeader({ title, subtitle, action, className = '' }: PageHeaderProps) {
  return (
    <div className={`flex items-start justify-between gap-4 ${className}`}>
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        {subtitle && (
          <p className="text-gray-500 text-sm mt-1">{subtitle}</p>
        )}
      </div>
      {action && (
        <div className="shrink-0">
          {action}
        </div>
      )}
    </div>
  )
}
