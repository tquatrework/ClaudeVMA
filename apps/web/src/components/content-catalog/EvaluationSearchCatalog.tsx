/**
 * EvaluationSearchCatalog — recherche par tag/mot-clé + liste paginée de l'onglet « Catalogue » de
 * `EvaluationCatalogPage`, extraite pour garder la page sous le seuil de 300 lignes (règle du
 * projet). Même patron de recherche que `QuizzPage`/`ExerciseCatalogPage`.
 */

import React from 'react'
import { useNavigate } from 'react-router-dom'
import { EmptyState } from '../ui/EmptyState'
import { ErrorMessage } from '../ui/ErrorMessage'
import { StatusBadge } from '../ui/StatusBadge'
import { CatalogItemCard } from '../ui/CatalogItemCard'
import {
  EVALUATION_STATUS_BADGE_CLASSES,
  EVALUATION_STATUS_LABELS,
  getEvaluationDisplayTitle,
} from '../../utils/evaluationLabels'
import type { EvaluationSearchResult } from '../../api/evaluations'

interface EvaluationSearchCatalogProps {
  tagFilter: string
  onTagFilterChange: (value: string) => void
  keywordFilter: string
  onKeywordFilterChange: (value: string) => void
  onSearchSubmit: (event: React.FormEvent) => void
  isLoading: boolean
  loadError: string | null
  searchResult: EvaluationSearchResult | undefined
  page: number
  totalPages: number
  onPageChange: (page: number) => void
}

export function EvaluationSearchCatalog({
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
}: EvaluationSearchCatalogProps) {
  const navigate = useNavigate()

  return (
    <div className="space-y-4">
      <form onSubmit={onSearchSubmit} className="flex flex-wrap gap-3 items-end">
        <div>
          <label htmlFor="evaluation-search-tag" className="block text-xs text-gray-600 mb-1">
            Tag
          </label>
          <input
            id="evaluation-search-tag"
            type="text"
            value={tagFilter}
            onChange={(e) => onTagFilterChange(e.target.value)}
            placeholder="fractions"
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label htmlFor="evaluation-search-keyword" className="block text-xs text-gray-600 mb-1">
            Mot-clé (titre)
          </label>
          <input
            id="evaluation-search-keyword"
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

      {isLoading && <p className="text-gray-400 text-sm">Chargement des évaluations…</p>}
      {loadError && <ErrorMessage message={loadError} />}

      {!isLoading && !loadError && searchResult && (
        <>
          {searchResult.items.length === 0 ? (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center">
              <EmptyState message="Aucune évaluation ne correspond à cette recherche." />
            </div>
          ) : (
            <ul className="space-y-3">
              {searchResult.items.map((evaluation) => (
                <CatalogItemCard
                  key={evaluation.id}
                  id={evaluation.id}
                  title={getEvaluationDisplayTitle(evaluation.title)}
                  description={evaluation.description ?? undefined}
                  tags={[
                    ...evaluation.tags.map((tag) => ({ label: tag })),
                    { label: `${Math.round(evaluation.durationSeconds / 60)} min` },
                  ]}
                  rightBadge={
                    evaluation.status !== 'validated' ? (
                      <StatusBadge
                        status={evaluation.status}
                        label={EVALUATION_STATUS_LABELS[evaluation.status]}
                        badgeClasses={EVALUATION_STATUS_BADGE_CLASSES}
                      />
                    ) : undefined
                  }
                  onSelect={(id) => navigate(`/content/evaluations/${id}/attempt`)}
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
