/**
 * Types partagés — Tentatives d'Évaluation et demandes de correction, volet
 * learning-activity-service (`docs/routes.md` > learning-activity-service > « Tentatives
 * d'Évaluation » / « Demandes de correction », ajouté le 2026-09-01).
 *
 * `content-catalog-service` porte la définition de l'Évaluation (titre, métadonnées,
 * `durationSeconds`, liste ordonnée d'Exercices) — voir `types/evaluation.ts`.
 * `learning-activity-service` porte tout le cycle de vie de la tentative d'un utilisateur :
 * démarrage chronométré, réponses, clôture, demande de correction humaine, historique.
 *
 * Contrat des champs vérifié contre `docs/routes.md` (lignes 3116-3149). Le nom exact du corps de
 * `POST /evaluation-attempts/:id/answers` n'est **pas** donné littéralement par la documentation
 * (elle décrit le comportement, pas le DTO) — `{exerciseId, partId, content}` est déduit par
 * analogie directe avec `POST /exercise-attempts/:id/answers` (`{partId, content}`), étendu de
 * `exerciseId` puisqu'une tentative d'Évaluation porte plusieurs Exercices. À vérifier en HTTP
 * direct contre la pile réelle avant de considérer ce contrat définitivement confirmé.
 */

export type EvaluationAttemptStatus = 'in_progress' | 'completed' | 'abandoned'

/** Un item de réponse soumis par l'utilisateur — même forme que pour l'Exercice. */
export interface EvaluationAttemptAnswerItem {
  type: 'text' | 'formula'
  content: string
}

export interface EvaluationAttemptAnswer {
  exerciseId: string
  partId: string
  content: EvaluationAttemptAnswerItem[]
  answeredAt: string
}

export interface EvaluationAttemptView {
  id: string
  evaluationId: string
  userId: string
  userRole: string
  status: EvaluationAttemptStatus
  startedAt: string
  deadlineAt: string
  completedAt: string | null
  answers: EvaluationAttemptAnswer[]
  /** Calculé à la volée par le serveur (comparaison à `deadlineAt`) — jamais recalculé côté front. */
  timeExpired: boolean
}

// ─── Demandes de correction ────────────────────────────────────────────────────

export type EvaluationCorrectionStatus = 'pending' | 'accepted' | 'corrected' | 'all_declined'

export interface EvaluationCorrectionRequest {
  id: string
  attemptId: string
  evaluationId: string
  studentId: string
  status: EvaluationCorrectionStatus
  linkedTeacherIds: string[]
  declinedByTeacherIds: string[]
  acceptedByTeacherId: string | null
  /** `null` tant qu'aucune correction n'a été soumise. Peut être une chaîne décimale (sérialisation
   * Postgres), même prudence que `QuizAttempt.score` — voir `utils/evaluationLabels.ts`. */
  score: number | string | null
  comment: string | null
  createdAt: string
  acceptedAt: string | null
  correctedAt: string | null
  /** Réponses de l'élève sur la tentative visée — jointes uniquement pour les appelants autorisés
   * (élève propriétaire, professeur lié, professeur ayant accepté, RP). Jamais la solution de
   * l'Exercice (arbitrage explicite du 2026-09-01, point 6 : « une correction n'a rien à voir avec
   * une solution »). */
  attemptAnswers?: EvaluationAttemptAnswer[]
}
