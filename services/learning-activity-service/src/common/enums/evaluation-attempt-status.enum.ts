/**
 * Statut d'une tentative d'Évaluation (docs/architecture.md > « Refonte des
 * Evaluations », point 4a) :
 *   - IN_PROGRESS : le chronomètre court, les réponses peuvent être
 *                    soumises/modifiées tant que deadlineAt n'est pas dépassé.
 *   - COMPLETED   : l'utilisateur a cliqué « enregistrer sa réponse » — la
 *                    tentative est close, ses réponses sont figées.
 *   - ABANDONED   : réservé (parité de nommage avec l'ancienne entité de
 *                    content-catalog-service), aucune route ne le positionne
 *                    aujourd'hui — point ouvert, voir rapport de chantier.
 */
export enum EvaluationAttemptStatus {
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  ABANDONED = 'abandoned',
}
