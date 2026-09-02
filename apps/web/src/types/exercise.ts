/**
 * Types partagés — Exercices (content-catalog-service + learning-activity-service)
 *
 * Refonte du 2026-08-29 (`docs/architecture.md` > « Refonte des Exercices »), alignée point par
 * point sur le modèle Quizz (2026-08-28) : `content-catalog-service` porte la création, la
 * définition, la solution et la validation d'un exercice ; `learning-activity-service` porte
 * l'inscription (tentative), le passage (réponses, révélation de solution) et l'historique.
 *
 * Un exercice est une séquence ordonnée de blocs (`parts`) — énoncé, image ou question — portant du
 * contenu texte/formule/image (même mécanisme que le Mémo, `pedagogical-log-service`). Un bloc
 * « question » porte exactement une solution (mêmes types de contenu), jamais exposée par une
 * route publique de `content-catalog-service` — voir `docs/routes.md` > content-catalog-service >
 * « Exercices — refonte du 2026-08-29 ».
 *
 * Depuis le 2026-09-01 (`docs/architecture.md` > « Bloc "image" de premier niveau pour
 * l'Exercice »), l'image n'est plus un item embarqué dans un bloc énoncé/question : c'est un bloc
 * de premier niveau à part entière (`category: 'image'`), au même rang que énoncé et question dans
 * la séquence ordonnée.
 *
 * **Contrat réel confirmé par `content-catalog-service` (PR #191)** : contrairement à l'hypothèse
 * initiale d'un flux en deux temps (structure d'abord, upload multipart ensuite), l'image est
 * envoyée **en base64, inline, dans le même appel `POST`/`PUT /exercises`** que le reste de la
 * séquence — `CreateExerciseItemPayload.imageData`. Il n'existe **aucune** route multipart
 * post-création : `POST /exercises/:id/parts/:partId/images` et `.../solution/images` sont
 * **retirées** côté serveur. Un bloc image reste 1 item de type `image` en lecture
 * (`PublicContentItem`, forme inchangée, jamais `imageData` — servi par
 * `GET /exercises/:id/images/:itemId`, blob route inchangée). Disponible **dès la création**,
 * contrairement à l'ancien mécanisme `ExerciseImageManager` (retiré). Voir
 * `utils/exerciseImageEncoding.ts` pour l'encodage local (`FileReader`), et
 * `utils/exercisePayload.ts` (`resolveExerciseImagePayloadItems`) pour la résolution — nouveau
 * fichier vs. ancien fichier vs. re-lecture d'une image déjà enregistrée en édition.
 *
 * Solutions : contrairement au Quizz, `content-catalog-service` ne renvoie **jamais** le contenu
 * d'une solution via la route publique de consultation (`GET /exercises/:id`) — seule
 * `GET /exercises/:id/solutions` (réservée à l'auteur et aux AP/RP/TI, voir plus bas) l'expose,
 * pour que l'écran d'édition puisse réellement pré-remplir une solution déjà saisie. Une image de
 * solution y est elle aussi embarquée en base64 (`AuthorContentItem.imageData`), corrigeant le bug
 * "image de solution jamais rerelisible". Depuis le 2026-09-01, elle est aussi éditable/remplaçable
 * depuis le formulaire (`ExerciseSolutionImageEditor`) — le contrat d'écriture
 * (`solution.items[].imageData` sur `PUT /exercises/:id`) a été confirmé en HTTP direct contre la
 * production.
 */

export type ExercisePartCategory = 'statement' | 'image' | 'question'

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

/**
 * Un bloc (énoncé, image ou question), tel qu'exposé publiquement — jamais le contenu d'une
 * solution. `items` porte 0 ou 1 item de type `image` pour un bloc `category: 'image'`.
 */
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

/**
 * `content` est requis pour `type: 'text'|'formula'`, optionnel (légende) pour `type: 'image'`.
 * `imageData`/`imageOriginalFilename` ne s'appliquent qu'à `type: 'image'` — `imageData` est
 * **requis** dans ce cas (base64, avec ou sans préfixe data URI ; `FileReader.readAsDataURL`
 * produit directement une forme acceptée par le serveur).
 */
export interface CreateExerciseItemPayload {
  type: 'text' | 'formula' | 'image'
  content?: string
  imageData?: string
  imageOriginalFilename?: string
}

export interface CreateExercisePartPayload {
  category: ExercisePartCategory
  /**
   * `items` peut être vide/absent pour `category: 'statement'` (un énoncé peut être vide).
   * Exactement **un** item `type: 'image'` pour `category: 'image'`. Non vide (texte/formule)
   * pour `category: 'question'`.
   */
  items?: CreateExerciseItemPayload[]
  /** Obligatoire si `category === 'question'`, interdit sinon. */
  solution?: { items: CreateExerciseItemPayload[] }
}

/**
 * `title` est désormais obligatoire et unique par auteur côté serveur (arbitrage du 2026-09-01,
 * `docs/architecture.md` > « Titre des Exercices et des Quizz »). `description` a été retiré de
 * l'écran de création/édition (même arbitrage, point 4) et n'est donc plus envoyé — le champ reste
 * lisible sur `ExerciseSummary`/`PublicExerciseDetail` pour les exercices créés avant ce retrait.
 */
export interface CreateExercisePayload {
  title: string
  level?: string
  difficulty?: string
  theme?: string
  competencies?: string[]
  tags?: string[]
  parts: CreateExercisePartPayload[]
}

/** Réponse de `GET /exercises/default-title` — suggestion de titre par défaut ("Exercice {n}"). */
export interface DefaultExerciseTitle {
  title: string
}

/**
 * Réponse de `GET /exercises/image-constraints` (ajoutée le 2026-09-01) — à lire par le front
 * **avant** d'afficher le bouton d'ajout d'image, même discipline que
 * `GET /profiles/avatar/constraints`. `maxImageInputBytes` borne le fichier choisi par
 * l'utilisateur (avant ré-encodage serveur) ; `maxImageOutputBytes` est informatif (taille après
 * ré-encodage WebP, non vérifiable côté front) ; `maxRequestBodyBytes` borne le corps JSON entier
 * de `POST`/`PUT /exercises` — pertinent si plusieurs blocs image sont envoyés dans le même appel.
 */
export interface ExerciseImageConstraints {
  maxImageInputBytes: number
  maxImageOutputBytes: number
  maxRequestBodyBytes: number
}

// ─── Lecture par l'auteur, avec solutions (2026-09-01) ─────────────────────────
//
// `GET /exercises/:id/solutions`, sur le modèle de `GET /quizzes/:id/solution` : réservée à
// l'auteur et aux AP/RP/TI, corrige le bug signalé le 2026-09-01 où les solutions déjà saisies
// n'étaient jamais réaffichées à l'édition (voir `docs/architecture.md`, arbitrage du même jour,
// point 6). Le front tolère l'absence de cette route (voir `fetchExerciseForEdit` dans
// `api/exercises.ts`) tant que le déploiement de `content-catalog-service` n'est pas confirmé.

/**
 * Un item de solution, tel qu'exposé à l'auteur — `imageData` (base64) présent uniquement pour
 * `type: 'image'` (correctif du 2026-09-01, "image de solution jamais rerelisible").
 */
export interface AuthorContentItem extends PublicContentItem {
  imageData?: string | null
}

/** Un bloc, tel qu'exposé à l'auteur — porte le contenu complet de sa solution si elle existe. */
export interface AuthorExercisePart extends PublicExercisePart {
  /** Présent uniquement pour un bloc `question` dont la solution est enregistrée. */
  solution?: { items: AuthorContentItem[] } | null
}

/** Détail complet d'un exercice AVEC solutions — réservé à l'auteur et aux AP/RP/TI. */
export interface AuthorExerciseDetail extends ExerciseSummary {
  parts: AuthorExercisePart[]
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

// ─── Import depuis un tableur (content-catalog-service) ───────────────────────
//
// Contrat posé par `docs/architecture.md` > « Import d'Exercice depuis un tableur
// (CSV/Excel), et modèle de type identique pour l'import de Quizz » (arbitrage du
// 2026-09-02), documenté dans `docs/routes.md` > content-catalog-service > « Import
// d'exercices depuis un fichier tableur ». Même forme que l'import Quizz
// (`types/quiz.ts`), un résultat par bloc d'Exercice détecté dans le fichier.

/** `created` : le bloc a produit un Exercice. `error` : le bloc a été rejeté, en entier. */
export type ExerciseImportBlockStatus = 'created' | 'error'

/** Une ligne fautive d'un bloc en erreur, avec le motif du refus. */
export interface ExerciseImportBlockError {
  row: number
  message: string
}

/**
 * Résultat d'un bloc d'Exercice détecté dans le fichier importé. Un bloc en erreur
 * n'empêche jamais la création des autres blocs valides du même fichier — la
 * réponse est donc toujours un compte-rendu par bloc, jamais un état global.
 *
 * Le titre de l'Exercice créé n'est **pas** porté par ce contrat (seul
 * `exerciseId` l'est) : le front le relit via `GET /exercises/:id` après import,
 * voir `useExerciseImport` (`src/hooks/content-catalog/useExerciseImport.ts`).
 */
export interface ExerciseImportBlockResult {
  blockIndex: number
  status: ExerciseImportBlockStatus
  exerciseId?: string
  validationStatus?: Extract<ExerciseStatus, 'pending_validation' | 'validated'>
  errors?: ExerciseImportBlockError[]
}

/** `GET /exercises/import/constraints` — plafond de taille en vigueur pour un envoi. */
export interface ExerciseImportConstraints {
  maxFileSizeBytes: number
}
