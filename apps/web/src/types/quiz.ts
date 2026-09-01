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

/**
 * Valeurs réelles attendues par `POST /validations/quiz/:id/decision` — vérifiées en HTTP direct
 * contre la pile réelle le 2026-08-28. `'approve'`/`'reject'` (vocabulaire utilisé par erreur par
 * la PR #157 initiale) ne sont **jamais** acceptées par le serveur (`400`).
 */
export type QuizValidationDecision = 'validated' | 'rejected'

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

/**
 * Réponse de `GET /quizzes/default-title` — suggestion de titre par défaut ("Quizz {n}"), à lire
 * à l'ouverture du formulaire de création (arbitrage du 2026-09-01, `docs/architecture.md` >
 * « Titre des Exercices et des Quizz »).
 */
export interface DefaultQuizTitle {
  title: string
}

// ─── Édition par l'auteur (2026-08-28, retour post-production) ────────────────
//
// Suite du 2026-08-28 (PR #167 content-catalog-service, mergée et déployée) :
// `GET /quizzes/:id/solution` renvoie désormais le quizz complet AVEC solution, réservée à
// l'auteur et aux AP/RP/TI (`403` pour tout autre rôle, `404` si absent/non visible). Vérifié en
// HTTP direct contre la pile réelle le 2026-08-28 : même forme que `PublicQuizDetail`, avec en
// plus `isCorrect` sur chaque option et `keywords` sur les questions à texte court. La première
// tentative (PR #164) avait constaté qu'aucune route ne l'exposait — c'est corrigé, l'écran
// d'édition utilise désormais cette route (`fetchQuizSolution` dans `api/quizzes.ts`) au lieu de
// faire ressaisir la solution par l'auteur à chaque édition.

/** Option d'une question, telle qu'exposée à l'auteur — porte la solution. */
export interface AuthorQuizOption extends PublicQuizOption {
  isCorrect: boolean
}

/** Question d'un quizz, telle qu'exposée à l'auteur — porte la solution complète. */
export interface AuthorQuizQuestion extends Omit<PublicQuizQuestion, 'options'> {
  options?: AuthorQuizOption[]
  /** Présent uniquement pour les questions `short_text`. */
  keywords?: string[]
}

/** Détail complet d'un quizz AVEC solution — réservé à l'auteur et aux AP/RP/TI. */
export interface AuthorQuizDetail extends QuizSummary {
  questions: AuthorQuizQuestion[]
}

/**
 * Entrée d'historique de validation d'un quizz (décision + commentaire) — forme vérifiée en
 * HTTP direct le 2026-08-28 contre `GET /validations/quiz/:id/history`. **Route désormais ouverte
 * à l'auteur du contenu, en plus de RP/AP** (PR #167 content-catalog-service, mergée et
 * déployée) : un professeur peut relire le motif de son propre refus. Vérifié en HTTP direct
 * contre la pile réelle le 2026-08-28 : `200` avec le commentaire réel du RP pour l'auteur
 * formateur, sur un quizz `rejected` lui appartenant.
 */
export interface QuizValidationHistoryEntry {
  id: string
  contentId: string
  contentType: string
  validatorId: string
  validatorRole: string
  decision: QuizValidationDecision
  comment?: string | null
  createdAt: string
  updatedAt: string
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

// ─── Import depuis un tableur (content-catalog-service) ───────────────────────
//
// Contrat posé par `docs/architecture.md` > « Import de Quizz depuis un tableur »
// (arbitrage du 2026-08-29, sur la branche `docs/quiz-import-spreadsheet-arbitrage`,
// PR #175 — pas encore mergée dans `master` au moment où ce front a été écrit).
// `content-catalog-service` est développé EN PARALLÈLE sur ce même contrat par un
// autre chantier : les noms de champs ci-dessous sont ceux fixés par l'arbitrage,
// à réconcilier avec la PR `content-catalog-service` une fois ouverte si un écart
// apparaît (voir le rapport de session pour le détail des points à vérifier).

/** `created` : le bloc a produit un Quizz. `error` : le bloc a été rejeté, en entier. */
export type QuizImportBlockStatus = 'created' | 'error'

/** Une ligne fautive d'un bloc en erreur, avec le motif du refus. */
export interface QuizImportBlockError {
  row: number
  message: string
}

/**
 * Résultat d'un bloc de Quizz détecté dans le fichier importé. Un bloc en erreur
 * n'empêche jamais la création des autres blocs valides du même fichier — la
 * réponse est donc toujours un compte-rendu par bloc, jamais un état global.
 *
 * Le titre du Quizz créé n'est **pas** porté par ce contrat (seul `quizId` l'est) :
 * le front le relit via `GET /quizzes/:id` après import, voir
 * `useQuizImport` (`src/hooks/content-catalog/useQuizImport.ts`).
 */
export interface QuizImportBlockResult {
  blockIndex: number
  status: QuizImportBlockStatus
  quizId?: string
  validationStatus?: Extract<QuizStatus, 'pending_validation' | 'validated'>
  errors?: QuizImportBlockError[]
}

/** `GET /quizzes/import/constraints` — plafond de taille en vigueur pour un envoi. */
export interface QuizImportConstraints {
  maxFileSizeBytes: number
}
