/**
 * Catégorie d'un bloc d'exercice — refonte du 2026-08-29 (docs/architecture.md,
 * "Refonte des Exercices"), étendue le 2026-09-01 (docs/architecture.md,
 * "Bloc 'image' de premier niveau pour l'Exercice") : un exercice est une
 * séquence ordonnée de blocs `statement` (énoncé), `image` et `question`,
 * librement entrelacés. Une solution n'existe que pour un bloc `question`
 * (1-à-1, FK `partId` obligatoire).
 *
 * `IMAGE` porte directement une image (exactement un item de type `image`
 * dans `ExercisePart.items`) — ce n'est plus un item parmi d'autres au sein
 * d'un bloc `statement`/`question` (ancien mécanisme retiré le 2026-09-01).
 */
export enum ExercisePartCategory {
  STATEMENT = 'statement',
  IMAGE = 'image',
  QUESTION = 'question',
}
