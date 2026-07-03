/**
 * Types partagés — Contenu pédagogique (content-catalog-service)
 * Partagés entre ExerciseCatalogPage, EvaluationCatalogPage, TutorialCatalogPage.
 */

export type DifficultyLevel = 'facile' | 'moyen' | 'difficile'

/** Libellés affichés par niveau de difficulté */
export const DIFFICULTY_LABELS: Record<DifficultyLevel, string> = {
  facile: 'Facile',
  moyen: 'Moyen',
  difficile: 'Difficile',
}

/** Classes CSS de badge par niveau de difficulté */
export const DIFFICULTY_BADGE_CLASSES: Record<DifficultyLevel, string> = {
  facile: 'bg-green-100 text-green-700',
  moyen: 'bg-yellow-100 text-yellow-700',
  difficile: 'bg-red-100 text-red-700',
}

export type ContentStatus = 'draft' | 'pending_validation' | 'published' | 'rejected'
