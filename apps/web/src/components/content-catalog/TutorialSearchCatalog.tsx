/**
 * TutorialSearchCatalog — recherche par tag/mot-clé + liste paginée de l'onglet « Catalogue » de
 * `TutorialCatalogPage`. Même patron d'extraction que `ExerciseSearchCatalog`.
 */

import React from 'react'
import { EmptyState } from '../ui/EmptyState'
import { ErrorMessage } from '../ui/ErrorMessage'
import { StatusBadge } from '../ui/StatusBadge'
import { CatalogItemCard } from '../ui/CatalogItemCard'
import {
  TUTORIAL_FORMAT_LABELS,
  TUTORIAL_STATUS_BADGE_CLASSES,
  TUTORIAL_STATUS_LABELS,
} from '../../utils/tutorialLabels'
import type { TutorialSearchResult } from '../../api/tutorials'
import type { TutorialSummary } from '../../types/tutorial'

interface TutorialSearchCatalogProps {
  tagFilter: string
  onTagFilterChange: (value: string) => void
  keywordFilter: string
  onKeywordFilterChange: (value: string) => void
  onSearchSubmit: (event: React.FormEvent) => void
  isLoading: boolean
  loadError: string | null
  searchResult: TutorialSearchResult | undefined
  page: number
  totalPages: number
  onPageChange: (page: number) => void
  onSelectTutorial: (tutorial: TutorialSummary) => void
}

export function TutorialSearchCatalog({
  tagFilter,
  onTagFilterChange,
  keywordFilter,
  onKeywordFilterChange,
  onSearchSubmit,
  isLoading,
  loadError,
  searchResult,
  page,
  totalPages,
  onPageChange,
  onSelectTutorial,
}: TutorialSearchCatalogProps) {
  return (
    <div className="space-y-4">
      <form onSubmit={onSearchSubmit} className="flex flex-wrap gap-3 items-end">
        <div>
          <label htmlFor="tutorial-search-tag" className="block text-xs text-gray-600 mb-1">
            Tag
          </label>
          <input
            id="tutorial-search-tag"
            type="text"
            value={tagFilter}
            onChange={(e) => onTagFilterChange(e.target.value)}
            placeholder="fractions"
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label htmlFor="tutorial-search-keyword" className="block text-xs text-gray-600 mb-1">
            Mot-clé (titre)
          </label>
          <input
            id="tutorial-search-keyword"
            type="text"
            value={keywordFilter}
            onChange={(e) => onKeywordFilterChange(e.target.value)}
            placeholder="géométrie"
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
          />
        </div>
        <button
          type="submit"
          className="px-4 py-1.5 text-sm font-medium text-white bg-gray-700 rounded-md hover:bg-gray-800 transition-colors"
        >
          Rechercher
        </button>
      </form>

      {isLoading && <p className="text-gray-400 text-sm">Chargement des tutoriels…</p>}
      {loadError && <ErrorMessage message={loadError} />}

      {!isLoading && !loadError && searchResult && (
        <>
          {searchResult.items.length === 0 ? (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center">
              <EmptyState message="Aucun tutoriel ne correspond à cette recherche." />
            </div>
          ) : (
            <ul className="space-y-3">
              {searchResult.items.map((tutorial) => (
                <CatalogItemCard
                  key={tutorial.id}
                  id={tutorial.id}
                  title={tutorial.title}
                  description={tutorial.description ?? undefined}
                  tags={[
                    { label: TUTORIAL_FORMAT_LABELS[tutorial.format], colorClass: 'bg-blue-50 text-blue-700' },
                    ...tutorial.tags.map((tag) => ({ label: tag })),
                  ]}
                  rightBadge={
                    tutorial.status !== 'validated' ? (
                      <StatusBadge
                        status={tutorial.status}
                        label={TUTORIAL_STATUS_LABELS[tutorial.status]}
                        badgeClasses={TUTORIAL_STATUS_BADGE_CLASSES}
                      />
                    ) : undefined
                  }
                  onSelect={() => onSelectTutorial(tutorial)}
                />
              ))}
            </ul>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => onPageChange(Math.max(1, page - 1))}
                disabled={page <= 1}
                className="px-3 py-1 text-sm text-gray-600 disabled:opacity-40"
              >
                Précédent
              </button>
              <span className="text-sm text-gray-500">
                Page {page} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => onPageChange(Math.min(totalPages, page + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1 text-sm text-gray-600 disabled:opacity-40"
              >
                Suivant
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
