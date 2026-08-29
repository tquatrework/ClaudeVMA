/**
 * Catégorie d'un bloc d'exercice — refonte du 2026-08-29 (docs/architecture.md,
 * "Refonte des Exercices"). Un exercice est une séquence ordonnée de blocs
 * `statement` (énoncé) et `question`, librement entrelacés. Une solution
 * n'existe que pour un bloc `question` (1-à-1, FK `partId` obligatoire).
 */
export enum ExercisePartCategory {
  STATEMENT = 'statement',
  QUESTION = 'question',
}
