/**
 * Types partagés — Quizz (content-catalog-service + learning-activity-service)
 *
 * Décision d'architecture du 2026-08-28 (`docs/architecture.md` > « Fonctionnalite Quizz ») :
 * `content-catalog-service` porte la création/définition/solution/validation d'un quizz,
 * `learning-activity-service` porte l'inscription, le passage et l'historique des tentatives.
 * Ce fichier regroupe les deux domaines car ils forment un seul concept métier pour l'utilisateur.
 *
 * Vérifié directement contre la pile réelle (appels internes aux conteneurs, sans lire le
 * code source des services, conforme au périmètre front) le 2026-08-28 pour fixer les noms de
 * champs exacts — la solution (bonnes réponses, mots-clés) n'est **jamais** présente dans les
 * réponses publiques (`PublicQuizDetail`, `QuizSummary`) : ni `isCorrect` sur les options, ni
 * `keywords` sur les questions à texte court.
 */

export type QuizQuestionCategory = 'single_choice' | 'multiple_choice' | 'short_text'

export type MultipleChoiceScoringMode = 'all_or_nothing' | 'per_option'

export type ShortTextScoringMode = 'all_or_nothing' | 'per_keyword'

/**
 * `pending_validation` (créé par un professeur, en attente d'AP/RP) · `validated` (auto-validé
 * pour AP/RP, ou validé par eux) · `rejected` (refusé, motif en commentaire côté validation).
 */
export type QuizStatus = 'pending_validation' | 'validated' | 'rejected'

/** Option d'une question, telle qu'exposée publiquement — jamais `isCorrect`. */
export interface PublicQuizOption {
  id: string
  text: string
}

/** Question d'un quizz, telle qu'exposée publiquement — jamais la solution. */
export interface PublicQuizQuestion {
  id: string
  order: number
  category: QuizQuestionCategory
  prompt: string
  options?: PublicQuizOption[]
  multipleChoiceScoringMode?: MultipleChoiceScoringMode
  shortTextScoringMode?: ShortTextScoringMode
  /** Barème effectif de la question (individuel s'il a été fixé, sinon dérivé du barème global). */
  points: number
  penaltyEnabled: boolean
  penaltyPoints: number
}

/** Élément de liste (recherche, file de validation) — jamais les questions. */
export interface QuizSummary {
  id: string
  title: string
  description?: string
  tags: string[]
  status: QuizStatus
  authorId: string
  authorRole: string
  defaultPoints: number
  penaltyEnabled: boolean
  penaltyPoints: number
  shareableLink?: string
  createdAt: string
  updatedAt: string
}

/** Détail complet d'un quizz — questions incluses, solution exclue. */
export interface PublicQuizDetail extends QuizSummary {
  questions: PublicQuizQuestion[]
}

export interface CreateQuizOptionPayload {
  text: string
  isCorrect: boolean
}

export interface CreateQuizQuestionPayload {
  category: QuizQuestionCategory
  prompt: string
  options?: CreateQuizOptionPayload[]
  keywords?: string[]
  multipleChoiceScoringMode?: MultipleChoiceScoringMode
  shortTextScoringMode?: ShortTextScoringMode
  pointsOverride?: number
  penaltyEnabledOverride?: boolean
  penaltyPointsOverride?: number
}

export interface CreateQuizPayload {
  title: string
  description?: string
  tags?: string[]
  defaultPoints?: number
  penaltyEnabled?: boolean
  penaltyPoints?: number
  questions: CreateQuizQuestionPayload[]
}

// ─── Passage (learning-activity-service) ──────────────────────────────────────

/** Réponse soumise par l'utilisateur pour une question, selon sa catégorie. */
export interface QuizAnswerPayload {
  questionId: string
  selectedOptionIds?: string[]
  text?: string
}

export interface QuizAttemptQuestionDetail {
  questionId: string
  isCorrect: boolean
  pointsEarned: number
  pointsPossible: number
}

/**
 * Une tentative de quizz. `score`/`maxScore` sont renvoyés en nombre à la soumission mais en
 * chaîne (`"6.00"`) par l'historique (sérialisation décimale Postgres côté serveur) — voir
 * `toQuizScore` dans `src/utils/quizLabels.ts`, qui normalise les deux formes.
 * Le score peut être **négatif** si des pénalités s'appliquent : ne jamais l'afficher en valeur
 * absolue ni le plafonner à zéro côté front (arbitrage du 2026-08-28).
 */
export interface QuizAttempt {
  id: string
  quizId: string
  userId: string
  userRole: string
  status: string
  score: number | string | null
  maxScore: number | string | null
  details: QuizAttemptQuestionDetail[] | null
  startedAt: string
  completedAt: string | null
  updatedAt: string
}
