/**
 * Statut calculé d'une tentative d'Exercice (jamais persisté tel quel) :
 * docs/architecture.md > « Refonte des Exercices », point 9.
 *
 *   - DONE        : toutes les questions ont une solution révélée, OU toutes
 *                    les questions ont reçu une réponse (l'une des deux
 *                    conditions suffit, pas besoin des deux).
 *   - IN_PROGRESS : sinon.
 */
export enum ExerciseAttemptStatus {
  IN_PROGRESS = 'in_progress',
  DONE = 'done',
}
