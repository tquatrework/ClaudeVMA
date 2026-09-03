/**
 * Types partagés — Tutoriels/Vidéos (content-catalog-service)
 *
 * Refonte du 2026-09-03 (`docs/architecture.md` > « Refonte des Tutos/Vidéos »), livrée et
 * redéployée le même jour (PR #215/#216, `content-catalog-service`). Remplace intégralement
 * l'ancien modèle (`tutorialType` académie/activité/news, `format` texte/mixte/vidéo,
 * `textContent`/`imageUrl` scalaires) — voir l'ancien `src/api/contentCatalog.ts`, dont les
 * exports `Tutorial`/`CreateTutorialPayload`/`fetchTutorials`/`createTutorial` sont retirés au
 * profit de ce fichier et de `src/api/tutorials.ts`.
 *
 * Une seule entité `Tutorial`, deux formats exclusifs :
 * - `video` : `videoUrl` obligatoire, aucun bloc.
 * - `post` : séquence ordonnée de blocs `text`/`image`, `videoUrl` interdit.
 *
 * **Révision du 2026-09-03 (« Éditeur riche (WYSIWYG) pour les blocs texte du Tutoriel 'post' »,
 * `docs/architecture/contenu-pedagogique-quizz-exercices-evaluations.md`).** La catégorie de bloc
 * `title` est retirée, fusionnée dans `text` — un titre est désormais un texte affiché en grande
 * taille/gras via l'éditeur riche, pas une catégorie de bloc distincte. Le champ `content` d'un
 * bloc `text` porte désormais un **document structuré opaque** — le JSON produit par l'éditeur
 * riche front (TipTap), sérialisé en chaîne — plutôt que du texte brut avec syntaxe légère
 * `$...$`/`[label](url)`. `content-catalog-service` ne parse ni n'interprète ce contenu, il le
 * stocke et le restitue tel quel (seule sa taille est plafonnée à 20 000 caractères côté serveur).
 * Un contenu qui ne se parse pas comme un document TipTap valide (`type: 'doc'`) est traité comme
 * du texte brut historique (blocs créés avant cette révision, ou legacy `$...$`) — voir
 * `utils/tutorialRichTextContent.ts`, point d'entrée unique de cette interprétation côté front.
 * C'est la seule exception du projet à la syntaxe légère texte brut posée le 2026-08-26 : Memo,
 * Quizz et cahier de texte gardent cette syntaxe légère, inchangés par cette révision.
 *
 * Contrairement à l'Exercice (`ExercisePart` + `ExerciseContentItem` imbriqués), un bloc de
 * Tutoriel **est directement son contenu** — pas de table d'items imbriquée
 * (`docs/services/content-catalog-service.md`, entité `TutorialBlock`) : `content` pour `text`,
 * champs `image*` pour `image`. Mêmes colonnes et même mécanisme de stockage que
 * `ExerciseContentItem` (réutilisation directe de `ExerciseImageStorageService`/
 * `ExerciseImageTranscoder` côté serveur) — le front reprend donc le même patron d'encodage
 * base64 inline que le bloc image de premier niveau de l'Exercice (`utils/exerciseImageEncoding.ts`,
 * réutilisé tel quel, voir `utils/tutorialImageResolution.ts`).
 *
 * Droits et cycle de validation alignés point par point sur Quizz/Exercice/Évaluation : créateurs
 * formateur/AP/RP, statut fixé au rôle à la création (`pending_validation` formateur, `validated`
 * AP/RP), édition réservée à l'auteur, validation RP illimité + AP scopé par la relation
 * `animator_of_teacher` via le flux générique `POST /validations/tutorial/:id/decision`. Lecture
 * élargie au validateur (RP illimité, AP scopé) et à l'auteur quel que soit le statut, comme les
 * trois autres types de contenu (`docs/architecture.md` > « Visibilité du contenu en attente de
 * validation »).
 */

export type TutorialFormat = 'video' | 'post'

export type TutorialBlockCategory = 'text' | 'image'

/**
 * `pending_validation` (créé par un professeur, en attente d'AP/RP) · `validated` (auto-validé
 * pour AP/RP, ou validé par eux) · `rejected` (refusé, motif en commentaire côté validation).
 */
export type TutorialStatus = 'pending_validation' | 'validated' | 'rejected'

/** Valeurs attendues par `POST /validations/tutorial/:id/decision` — même vocabulaire que les
 * trois autres types de contenu du flux générique. */
export type TutorialValidationDecision = 'validated' | 'rejected'

/** Un bloc, tel qu'exposé publiquement — un bloc EST son contenu, pas de sous-items. */
export interface PublicTutorialBlock {
  id: string
  blockNumber: number
  category: TutorialBlockCategory
  /** Texte (title/text) ou légende éventuelle (image). */
  content: string | null
  /** Présents uniquement pour `category: 'image'`. */
  imageMimeType?: string | null
  imageSizeBytes?: number | null
}

/** Élément de liste (recherche, file de validation, « mes tutoriels ») — jamais les blocs. */
export interface TutorialSummary {
  id: string
  title: string
  description?: string | null
  theme?: string | null
  level?: string | null
  difficulty?: string | null
  competencies?: string[]
  tags: string[]
  format: TutorialFormat
  status: TutorialStatus
  authorId: string
  authorRole?: string
  createdAt: string
  updatedAt: string
}

/**
 * Détail complet d'un tutoriel — `blocks` seulement pour `format: 'post'`, `videoUrl` seulement
 * pour `format: 'video'`. `linkedQuizId` n'est renvoyé (non `null`) que si le Quizz référencé est
 * `validated` **au moment de la lecture** (jamais mis en cache côté serveur) — un lien vers un
 * Quizz non visible pour l'appelant redevient `null`, jamais une erreur.
 */
export interface PublicTutorialDetail extends TutorialSummary {
  videoUrl?: string | null
  linkedQuizId?: string | null
  blocks: PublicTutorialBlock[]
}

/**
 * `content` requis pour `category: 'text'` (document structuré TipTap sérialisé en JSON, voir
 * `utils/tutorialRichTextContent.ts`), optionnel (légende) pour `category: 'image'`.
 * `imageData` requis pour `category: 'image'` (base64, `FileReader.readAsDataURL` produit
 * directement une forme acceptée par le serveur — même contrat que le bloc image de l'Exercice).
 */
export interface CreateTutorialBlockPayload {
  category: TutorialBlockCategory
  content?: string
  imageData?: string
  imageOriginalFilename?: string
}

/**
 * `format: 'video'` exige `videoUrl` et interdit `blocks` ; `format: 'post'` interdit `videoUrl`
 * (blocs facultatifs mais c'est alors un tuto sans contenu — le formulaire exige au moins un bloc
 * non vide, garde locale avant l'appel réseau). `linkedQuizId` est optionnel dans les deux cas.
 */
export interface CreateTutorialPayload {
  title: string
  description?: string
  theme?: string
  tags?: string[]
  level?: string
  difficulty?: string
  competencies?: string[]
  format: TutorialFormat
  videoUrl?: string
  linkedQuizId?: string
  blocks?: CreateTutorialBlockPayload[]
}

/** Réponse de `GET /tutorials/default-title` — suggestion ("Tutoriel (N)"). */
export interface DefaultTutorialTitle {
  title: string
}

/**
 * Réponse de `GET /tutorials/image-constraints` — mêmes valeurs que
 * `GET /exercises/image-constraints` (même classe de transcodage réutilisée côté serveur), à lire
 * par le front **avant** d'afficher le bouton d'ajout d'image, jamais codé en dur.
 */
export interface TutorialImageConstraints {
  maxImageInputBytes: number
  maxImageOutputBytes: number
  maxRequestBodyBytes: number
}

/** Entrée d'historique de validation — même forme que pour les trois autres types de contenu. */
export interface TutorialValidationHistoryEntry {
  id: string
  contentId: string
  contentType: string
  validatorId: string
  validatorRole: string
  decision: TutorialValidationDecision
  comment?: string | null
  createdAt: string
  updatedAt: string
}
