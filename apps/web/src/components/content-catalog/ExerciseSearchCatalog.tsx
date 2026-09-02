/**
 * ExerciseSearchCatalog — recherche par tag/mot-clé + liste paginée de l'onglet « Catalogue » de
 * `ExerciseCatalogPage`, extraite le 2026-09-02 pour garder la page sous le seuil de 300 lignes
 * (règle du projet) une fois ajouté le mode « choix pour une Évaluation en cours »
 * (`useExercisePickerReturnMode`). Même patron d'extraction que `EvaluationSearchCatalog`.
 */

import React from 'react'
import { EmptyState } from '../ui/EmptyState'
import { ErrorMessage } from '../ui/ErrorMessage'
import { StatusBadge } from '../ui/StatusBadge'
import { CatalogItemCard } from '../ui/CatalogItemCard'
import {
  EXERCISE_STATUS_BADGE_CLASSES,
  EXERCISE_STATUS_LABELS,
  getExerciseDisplayTitle,
} from '../../utils/exerciseLabels'
import type { ExerciseSearchResult } from '../../api/exercises'
import type { ExerciseSummary } from '../../types/exercise'

interface ExerciseSearchCatalogProps {
  tagFilter: string
  onTagFilterChange: (value: string) => void
  keywordFilter: string
  onKeywordFilterChange: (value: string) => void
  onSearchSubmit: (event: React.FormEvent) => void
  isLoading: boolean
  loadError: string | null
  searchResult: ExerciseSearchResult | undefined
  page: number
  totalPages: number
  onPageChange: (page: number) => void
  /** Choisir un exercice — comportement normal (fiche de détail) ou retour vers une Évaluation en
   * cours (`useExercisePickerReturnMode`), décidé par l'appelant. */
  onSelectExercise: (exercise: ExerciseSummary) => void
}

export function ExerciseSearchCatalog({
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
  onSelectExercise,
}: ExerciseSearchCatalogProps) {
  return (
    <div className="space-y-4">
      <form onSubmit={onSearchSubmit} className="flex flex-wrap gap-3 items-end">
        <div>
          <label htmlFor="exercise-search-tag" className="block text-xs text-gray-600 mb-1">
            Tag
          </label>
          <input
            id="exercise-search-tag"
            type="text"
            value={tagFilter}
            onChange={(e) => onTagFilterChange(e.target.value)}
            placeholder="fractions"
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label htmlFor="exercise-search-keyword" className="block text-xs text-gray-600 mb-1">
            Mot-clé (titre)
          </label>
          <input
            id="exercise-search-keyword"
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

      {isLoading && <p className="text-gray-400 text-sm">Chargement des exercices…</p>}
      {loadError && <ErrorMessage message={loadError} />}

      {!isLoading && !loadError && searchResult && (
        <>
          {searchResult.items.length === 0 ? (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center">
              <EmptyState message="Aucun exercice ne correspond à cette recherche." />
            </div>
          ) : (
            <ul className="space-y-3">
              {searchResult.items.map((exercise) => (
                <CatalogItemCard
                  key={exercise.id}
                  id={exercise.id}
                  title={getExerciseDisplayTitle(exercise.title)}
                  description={exercise.description ?? undefined}
                  tags={exercise.tags.map((tag) => ({ label: tag }))}
                  rightBadge={
                    exercise.status !== 'validated' ? (
                      <StatusBadge
                        status={exercise.status}
                        label={EXERCISE_STATUS_LABELS[exercise.status]}
                        badgeClasses={EXERCISE_STATUS_BADGE_CLASSES}
                      />
                    ) : undefined
                  }
                  onSelect={() => onSelectExercise(exercise)}
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
