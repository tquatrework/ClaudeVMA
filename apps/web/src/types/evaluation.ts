/**
 * Types partagés — Évaluations, volet content-catalog-service.
 *
 * Refonte du 2026-09-01 (`docs/architecture.md` > « Refonte des Evaluations : notation manuelle,
 * demande de correction, notifications »), alignée point par point sur le modèle Quizz/Exercice
 * pour le cycle de vie (création/validation), tout en restant fidèle à la structure pré-existante
 * d'une évaluation : un titre + métadonnées + une **suite ordonnée d'Exercices déjà existants**
 * (`exerciseItems`), jamais ses propres questions.
 *
 * Contrat confirmé par `.claude/reports/content-catalog-service-evaluations-2026-09-01.md` (PR
 * #195) : `tags`/`competencies` sont des `string[]` en lecture (comme Quizz/Exercice), `tags` sur
 * colonne `text[]` native depuis ce chantier. **Pas de `PUT /evaluations/:id`** (aucune édition
 * possible, contrairement à Quizz/Exercice — confirmé explicitement absent du périmètre livré) et
 * **pas de `GET /evaluations/pending-validation`** (même écart) : voir `api/evaluations.ts` pour
 * la manière dont le front compense ces deux gaps côté lecture, sans jamais inventer de route.
 *
 * `learning-activity-service` porte tout le cycle de vie de la tentative (démarrage chronométré,
 * réponses, clôture, demande de correction, historique) — voir `types/evaluationAttempt.ts`.
 */

export type EvaluationStatus = 'pending_validation' | 'validated' | 'rejected'

/** Valeurs attendues par `POST /validations/evaluation/:id/decision` — mêmes valeurs que Quizz/Exercice. */
export type EvaluationValidationDecision = 'validated' | 'rejected'

export interface EvaluationExerciseItem {
  exerciseId: string
  titleOverride?: string | null
  order: number
}

/** Forme complète d'une évaluation — `GET /evaluations` et `GET /evaluations/:id` renvoient la
 * même forme (pas de distinction résumé/détail documentée, contrairement à Quizz/Exercice). */
export interface Evaluation {
  id: string
  title: string
  description?: string | null
  exerciseItems: EvaluationExerciseItem[]
  level?: string | null
  difficulty?: string | null
  theme?: string | null
  competencies?: string[]
  tags: string[]
  durationSeconds: number
  blockBackNavigation: boolean
  status: EvaluationStatus
  authorId: string
  authorRole?: string
  createdAt: string
  updatedAt: string
}

export interface CreateEvaluationExerciseItemPayload {
  exerciseId: string
  titleOverride?: string
  order: number
}

export interface CreateEvaluationPayload {
  title: string
  description?: string
  exerciseItems: CreateEvaluationExerciseItemPayload[]
  level?: string
  difficulty?: string
  theme?: string
  competencies?: string[]
  tags?: string[]
  durationSeconds: number
  blockBackNavigation?: boolean
}

/**
 * Entrée d'historique de validation — même forme que Quizz/Exercice. Route
 * `GET /validations/evaluation/:id/history` **non documentée séparément** pour l'Évaluation dans
 * `docs/routes.md`, mais le flux générique partagé (`ValidationsController`) l'expose pour
 * exercise/tutorial/quiz sur le même patron paramétré par type — voir `fetchEvaluationValidationHistory`
 * dans `api/evaluations.ts` pour la tolérance appliquée si cette hypothèse s'avérait fausse.
 */
export interface EvaluationValidationHistoryEntry {
  id: string
  contentId: string
  contentType: string
  validatorId: string
  validatorRole: string
  decision: EvaluationValidationDecision
  comment?: string | null
  createdAt: string
  updatedAt: string
}
