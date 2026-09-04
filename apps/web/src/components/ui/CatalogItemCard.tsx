/**
 * CatalogItemCard — Carte d'item de catalogue pédagogique
 *
 * Pattern identique répété dans ExerciseCatalogPage, EvaluationCatalogPage, TutorialCatalogPage.
 * Affiche : titre, description, tags (matière + niveau), badges de droite.
 */

import React from 'react'

interface CatalogTag {
  label: string
  /** Classes CSS Tailwind pour la couleur (défaut : bg-gray-100 text-gray-600) */
  colorClass?: string
}

interface CatalogItemCardProps {
  id: string
  title: string
  description?: string
  tags?: CatalogTag[]
  rightBadge?: React.ReactNode
  onSelect?: (id: string) => void
  /** Vignette optionnelle affichée avant le contenu (ex. image d'illustration d'un forum). */
  leadingVisual?: React.ReactNode
}

export function CatalogItemCard({
  id,
  title,
  description,
  tags = [],
  rightBadge,
  onSelect,
  leadingVisual,
}: CatalogItemCardProps) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect?.(id)}
        className="w-full text-left bg-white border border-gray-200 rounded-xl p-4 hover:border-indigo-300 hover:shadow-sm transition-all"
      >
        <div className="flex items-start justify-between gap-3">
          {leadingVisual}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-900 truncate">{title}</p>
            {description && (
              <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{description}</p>
            )}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {tags.map((tag, index) => (
                  <span
                    key={index}
                    className={`text-xs px-2 py-0.5 rounded ${tag.colorClass ?? 'bg-gray-100 text-gray-600'}`}
                  >
                    {tag.label}
                  </span>
                ))}
              </div>
            )}
          </div>
          {rightBadge && (
            <div className="shrink-0 flex flex-col items-end gap-2">
              {rightBadge}
            </div>
          )}
        </div>
      </button>
    </li>
  )
}
