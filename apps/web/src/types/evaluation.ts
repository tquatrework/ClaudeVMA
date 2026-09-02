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
 * colonne `text[]` native depuis ce chantier. **`PUT /evaluations/:id` ajoutée le 2026-09-02**
 * (PR #203, avec le barème informatif) — voir `api/evaluations.ts` pour l'appel d'édition.
 * **`GET /evaluations/pending-validation` reste absente** : voir `api/evaluations.ts` pour la
 * manière dont le front compense ce gap côté lecture, sans jamais inventer de route.
 *
 * `learning-activity-service` porte tout le cycle de vie de la tentative (démarrage chronométré,
 * réponses, clôture, demande de correction, historique) — voir `types/evaluationAttempt.ts`.
 *
 * **Barème informatif (`scoring`, arbitrage du 2026-09-02, `docs/architecture.md` > « Barème
 * informatif pour l'Évaluation »)** — livré par `content-catalog-service` (PR #203) : purement
 * informatif, jamais utilisé pour un calcul automatique (la correction reste entièrement
 * manuelle, `learning-activity-service`, inchangé). Le créateur choisit une granularité unique
 * par Évaluation — par Exercice, ou par question (référence aux blocs de catégorie `question` de
 * chaque Exercice) — jamais les deux à la fois. Voir `utils/evaluationScoring.ts` pour la
 * construction du payload et la lecture côté passage.
 */

export type EvaluationStatus = 'pending_validation' | 'validated' | 'rejected'

/** Valeurs attendues par `POST /validations/evaluation/:id/decision` — mêmes valeurs que Quizz/Exercice. */
export type EvaluationValidationDecision = 'validated' | 'rejected'

export interface EvaluationExerciseItem {
  exerciseId: string
  titleOverride?: string | null
  order: number
}

export type EvaluationScoringMode = 'per_exercise' | 'per_question'

/**
 * `partId` obligatoire en mode `per_question` (référence un bloc de catégorie `question` d'un
 * Exercice), interdit en mode `per_exercise` — voir `docs/routes.md` > content-catalog-service >
 * Évaluations > « Barème informatif ».
 */
export interface EvaluationScoringEntry {
  exerciseId: string
  partId?: string
  points: number
}

export interface EvaluationScoring {
  mode: EvaluationScoringMode
  entries: EvaluationScoringEntry[]
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
  scoring?: EvaluationScoring | null
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
  scoring?: EvaluationScoring
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
