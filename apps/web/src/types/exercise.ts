/**
 * Types partagés — Exercices (content-catalog-service + learning-activity-service)
 *
 * Refonte du 2026-08-29 (`docs/architecture.md` > « Refonte des Exercices »), alignée point par
 * point sur le modèle Quizz (2026-08-28) : `content-catalog-service` porte la création, la
 * définition, la solution et la validation d'un exercice ; `learning-activity-service` porte
 * l'inscription (tentative), le passage (réponses, révélation de solution) et l'historique.
 *
 * Un exercice est une séquence ordonnée de blocs (`parts`) — énoncé ou question — portant du
 * contenu texte/formule/image (même mécanisme que le Mémo, `pedagogical-log-service`). Un bloc
 * « question » porte exactement une solution (mêmes types de contenu), jamais exposée par une
 * route publique de `content-catalog-service` — voir `docs/routes.md` > content-catalog-service >
 * « Exercices — refonte du 2026-08-29 ».
 *
 * Contrairement au Quizz, `content-catalog-service` ne renvoie **jamais** la solution à l'auteur
 * via une route publique dédiée (pas d'équivalent de `GET /quizzes/:id/solution`) — seule la route
 * interne `POST /internal/exercises/:exerciseId/parts/:partId/solution`, réservée à
 * `learning-activity-service`, l'expose. Un auteur qui édite un exercice existant ne peut donc pas
 * relire une solution déjà saisie : `ExerciseEditPage` le signale explicitement plutôt que de
 * prétendre pré-remplir un contenu qu'aucune route ne peut fournir — voir le rapport de session.
 */

export type ExercisePartCategory = 'statement' | 'question'

export type ExerciseItemType = 'text' | 'formula' | 'image'

/**
 * `pending_validation` (créé par un professeur, en attente d'AP/RP) · `validated` (auto-validé
 * pour AP/RP, ou validé par eux) · `rejected` (refusé, motif en commentaire côté validation).
 */
export type ExerciseStatus = 'pending_validation' | 'validated' | 'rejected'

/** Valeurs attendues par `POST /validations/exercise/:id/decision` — mêmes valeurs que le Quizz. */
export type ExerciseValidationDecision = 'validated' | 'rejected'

/** Un item de contenu, tel qu'exposé publiquement — jamais un item de solution. */
export interface PublicContentItem {
  id: string
  type: ExerciseItemType
  order: number
  /** Texte ou LaTeX pour `text`/`formula`. Légende éventuelle (ou `null`) pour `image`. */
  content: string | null
  /** Présents uniquement pour `type: 'image'`. */
  imageMimeType?: string | null
  imageSizeBytes?: number | null
}

/** Un bloc (énoncé ou question), tel qu'exposé publiquement — jamais le contenu d'une solution. */
export interface PublicExercisePart {
  id: string
  partNumber: number
  category: ExercisePartCategory
  items: PublicContentItem[]
  /** `true` pour un bloc `question` portant une solution enregistrée — jamais son contenu ici. */
  hasSolution: boolean
}

/** Élément de liste (recherche, file de validation) — jamais les blocs. */
export interface ExerciseSummary {
  id: string
  title: string | null
  description?: string | null
  level?: string | null
  difficulty?: string | null
  theme?: string | null
  competencies?: string[]
  tags: string[]
  status: ExerciseStatus
  authorId: string
  authorRole?: string
  createdAt: string
  updatedAt: string
}

/** Détail complet d'un exercice — blocs inclus, contenu de solution exclu. */
export interface PublicExerciseDetail extends ExerciseSummary {
  parts: PublicExercisePart[]
}

export interface CreateExerciseItemPayload {
  type: 'text' | 'formula'
  content: string
}

export interface CreateExercisePartPayload {
  category: ExercisePartCategory
  items: CreateExerciseItemPayload[]
  /** Obligatoire si `category === 'question'`, interdit si `category === 'statement'`. */
  solution?: { items: CreateExerciseItemPayload[] }
}

export interface CreateExercisePayload {
  title?: string
  description?: string
  level?: string
  difficulty?: string
  theme?: string
  competencies?: string[]
  tags?: string[]
  parts: CreateExercisePartPayload[]
}

/** Entrée d'historique de validation — même forme que pour le Quizz. */
export interface ExerciseValidationHistoryEntry {
  id: string
  contentId: string
  contentType: string
  validatorId: string
  validatorRole: string
  decision: ExerciseValidationDecision
  comment?: string | null
  createdAt: string
  updatedAt: string
}

// ─── Passage (learning-activity-service) ──────────────────────────────────────
//
// Contrat vérifié par preuve HTTP directe contre la pile réelle le 2026-09-01 (une fois les deux
// blocages infra levés — voir le rapport de session du même jour). La forme diffère de ce qui
// avait été supposé initialement (gap de documentation, `docs/routes.md` ne documente toujours pas
// ce volet de `learning-activity-service`) : `answerContent`/`revealedContent` sont portés par
// `parts[]`, pas par des tableaux séparés `answers`/`revealedSolutions`.

export type ExerciseAttemptStatus = 'in_progress' | 'done'

/**
 * Un item de réponse **soumis par l'utilisateur** — même forme que
 * `CreateExerciseItemPayload` (`type`/`content` uniquement, jamais d'`id`/`order` : le serveur ne
 * les renvoie pas sur `answerContent`, contrairement à `revealedContent` qui reprend
 * `PublicContentItem` tel quel).
 */
export interface ExerciseAttemptAnswerItem {
  type: Extract<ExerciseItemType, 'text' | 'formula'>
  content: string
}

/** État d'un bloc « question » au sein d'une tentative. */
export interface ExerciseAttemptPartState {
  partId: string
  /** `null` tant qu'aucune réponse n'a été soumise pour ce bloc. */
  answerContent: ExerciseAttemptAnswerItem[] | null
  answeredAt: string | null
  solutionRevealed: boolean
  revealedAt: string | null
  /** `null` tant que la solution de ce bloc n'a pas été révélée. */
  revealedContent: PublicContentItem[] | null
}

/** Une tentative d'exercice (auto-contrôle — jamais de note ni de score). */
export interface ExerciseAttempt {
  id: string
  exerciseId: string
  userId: string
  userRole?: string
  status: ExerciseAttemptStatus
  parts: ExerciseAttemptPartState[]
  startedAt: string
  updatedAt: string
}
