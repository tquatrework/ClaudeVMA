/**
 * Granularité du barème informatif d'une Évaluation (arbitrage du 2026-09-02,
 * docs/architecture.md, "Barème informatif pour l'Évaluation"). Le créateur
 * choisit un seul mode actif à la fois pour toute l'Évaluation :
 *
 *   - PER_EXERCISE : une valeur de points par exercice de `exerciseItems`.
 *   - PER_QUESTION : une valeur de points par bloc de catégorie `question`
 *     (`ExercisePart.id`, déjà exposé par `GET /exercises/:id`) de chaque
 *     exercice référencé.
 *
 * Purement informatif : jamais utilisé pour calculer un score, la correction
 * reste entièrement manuelle (arbitrage du 2026-09-01, non remis en cause).
 */
export enum EvaluationScoringMode {
  PER_EXERCISE = 'per_exercise',
  PER_QUESTION = 'per_question',
}
