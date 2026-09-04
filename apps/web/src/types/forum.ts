/**
 * Types partagés — Forums (community-path-service)
 *
 * Refonte du 2026-09-04 (`docs/routes.md` > « community-path-service »,
 * `docs/architecture/identite-profils-acces.md` > « Développement réel des Forums »). Remplace
 * intégralement l'ancien contrat (`ForumStatus` draft/pending_validation/published/closed, création
 * ouverte à l'AP, pas d'image, pas de charte, pas de restriction par rôle) — voir l'ancien
 * `src/api/communityPath.ts`, dont les exports `Forum`/`ForumStatus`/`CreateForumPayload` sont
 * retirés au profit de ce fichier.
 *
 * **Changement structurel du 2026-09-04 (complément « Sujets (topics) »)** : un forum n'est plus
 * une discussion plate, il contient des sujets (`ForumTopic`). Un commentaire (`ForumComment`)
 * appartient désormais à un sujet (`topicId`), plus à un forum directement. `level`/`difficulty`/
 * `theme`/`competences` sont retirés du modèle `Forum` (colonnes supprimées côté serveur, héritage
 * du modèle générique de contenu sans usage réel pour les Forums).
 *
 * Points structurants du contrat actuel :
 * - Seul le RP crée un forum ; il est visible dès sa création, aucun statut de publication.
 * - Un forum est ouvert à tous par défaut, ou restreint à une liste de rôles (`allowedRoles`).
 *   Un rôle non autorisé ne doit jamais voir le forum exister (404 partout : liste, détail, image,
 *   sujets, commentaires) — jamais un 403 qui révélerait son existence.
 * - N'importe quel membre du forum peut créer un sujet (pas réservé au RP), sous réserve d'avoir
 *   accès au forum et d'avoir accepté la charte de bonne conduite.
 * - Un sujet créé par un membre part `pending_validation` et n'est visible qu'à son auteur et aux
 *   administrateurs tant qu'un RP ne l'a pas validé (`validated`) ou refusé (`rejected`). Seul le
 *   sujet système « Sujet général » échappe à ce flux (déjà `validated`, `isDefault: true`).
 * - Une charte de bonne conduite, unique et globale (pas de versionnage), doit être acceptée avant
 *   de créer un sujet ou de publier un commentaire — pas avant de lire.
 * - Suppression d'un commentaire réservée au RP.
 * - Un RP peut cacher un forum (`isHidden`), invisible ensuite à tout le monde sauf lui. Aucune
 *   route de réouverture — `GET /forums?mine=true` est l'unique moyen de retrouver ses forums
 *   cachés.
 *
 * **Résolution de l'auteur (`authorName`), ajoutée le 2026-09-04.** `ForumComment` et `ForumTopic`
 * portent désormais un champ `authorName` résolu côté serveur auprès de `profile-service` — jamais
 * `authorId` seul à l'affichage (règle du 2026-08-09, aucun UUID affiché à un utilisateur). `null`
 * couvre deux cas indistincts côté front : `profile-service` injoignable (dégradation gracieuse) ou
 * nom introuvable ; les deux se traduisent par un état neutre (« Auteur inconnu »).
 */

import type { PersonName } from './profile'

/** Les 4 seules valeurs acceptées pour `allowedRoles` — jamais les rôles administratifs, qui
 * gardent de toute façon un accès illimité quel que soit le réglage. */
export type ForumRestrictableRole = 'eleve' | 'parent_financeur' | 'formateur' | 'animateur_pedagogique'

export const FORUM_RESTRICTABLE_ROLES: ForumRestrictableRole[] = [
  'eleve',
  'parent_financeur',
  'formateur',
  'animateur_pedagogique',
]

export interface Forum {
  id: string
  title: string
  description: string | null
  tags: string | null
  /** `null` ou tableau vide = ouvert à tout compte connecté. */
  allowedRoles: ForumRestrictableRole[] | null
  createdById: string
  /** Toujours `"responsable_pedagogique"` pour un forum créé après le 2026-09-04. */
  createdByRole: string
  /** Détail de stockage interne — jamais construire une URL à partir de ce champ, ni l'afficher.
   * À traiter uniquement comme un indicateur « ce forum a-t-il une image ». */
  imageFilename: string | null
  imageMimeType: string | null
  /** Masquage RP (2026-09-04) : `true` = invisible pour tout le monde sauf le RP. Non destructif,
   * aucune route de réouverture n'existe. */
  isHidden: boolean
  hiddenAt: string | null
  /** UUID technique — jamais destiné à être affiché (règle du 2026-08-09). */
  hiddenByUserId: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateForumPayload {
  title: string
  description?: string
  tags?: string
  allowedRoles?: ForumRestrictableRole[]
}

/**
 * Body de `PATCH /forums/:id` (ajouté le 2026-09-04) — tous les champs optionnels, seuls ceux
 * fournis sont modifiés. `allowedRoles: []` explicite normalise en "ouvert à tous" côté serveur ;
 * pour ne pas toucher `allowedRoles`, ne pas inclure la clé.
 */
export interface UpdateForumPayload {
  title?: string
  description?: string
  tags?: string
  allowedRoles?: ForumRestrictableRole[]
}

// ─── Sujets (topics) ────────────────────────────────────────────────────────────

export type ForumTopicStatus = 'pending_validation' | 'validated' | 'rejected'

export interface ForumTopic {
  id: string
  forumId: string
  title: string
  authorId: string
  authorRole: string
  status: ForumTopicStatus
  /** `true` uniquement pour le sujet système « Sujet général », créé automatiquement à la création
   * du forum, déjà `validated`, jamais soumis au flux de validation. */
  isDefault: boolean
  validatedByUserId: string | null
  validatedAt: string | null
  rejectedByUserId: string | null
  rejectedAt: string | null
  rejectionReason: string | null
  createdAt: string
  updatedAt: string
  /** Nom résolu de l'auteur du sujet (créateur, auteur de son premier message), ajouté le
   * 2026-09-04. `null` = dégradation gracieuse (`profile-service` injoignable) ou nom introuvable —
   * les deux cas se traitent identiquement côté front (« Auteur inconnu »), jamais `authorId`.
   * Optionnel pour tolérer une réponse plus ancienne qui ne porterait pas encore ce champ. */
  authorName?: PersonName | null
}

export interface CreateForumTopicPayload {
  title: string
  /** Devient le tout premier `ForumComment` du sujet — pas de champ de contenu séparé sur le sujet
   * lui-même. */
  content: string
}

/** Réponse de `POST /forums/:id/topics` — le sujet créé, enrichi du premier commentaire tout juste
 * créé (évite un second appel pour l'afficher immédiatement). */
export interface CreateForumTopicResponse extends ForumTopic {
  firstComment: ForumComment
}

/** Réponse paginée de `GET /forums/:id/topics`. */
export interface ForumTopicsPage {
  data: ForumTopic[]
  page: number
  limit: number
  total: number
  totalPages: number
}

export const FORUM_TOPICS_DEFAULT_LIMIT = 20
export const FORUM_TOPICS_MAX_LIMIT = 100

/** Body de `POST /forums/:id/topics/:topicId/decision` — réservé au RP, sans scoping AP. */
export interface ForumTopicDecisionPayload {
  decision: 'validated' | 'rejected'
  reason?: string
}

// ─── Commentaires (au sein d'un sujet) ─────────────────────────────────────────

export interface ForumComment {
  id: string
  /** Un commentaire appartient à un sujet, plus directement à un forum (`forumId` retiré le
   * 2026-09-04). */
  topicId: string
  authorId: string
  authorRole: string
  content: string
  createdAt: string
  /** Nom résolu de l'auteur du commentaire, ajouté le 2026-09-04 — voir `ForumTopic.authorName`
   * pour la sémantique complète (`null` = dégradation gracieuse ou nom introuvable, indistincts).
   * Absent sur `firstComment` de `POST /forums/:id/topics` (l'auteur est l'appelant lui-même). */
  authorName?: PersonName | null
}

export interface CreateForumCommentPayload {
  content: string
}

/** Réponse paginée de `GET /forums/:id/topics/:topicId/comments` — du plus ancien au plus récent. */
export interface ForumCommentsPage {
  data: ForumComment[]
  page: number
  limit: number
  total: number
  totalPages: number
}

export const FORUM_COMMENTS_DEFAULT_LIMIT = 20
export const FORUM_COMMENTS_MAX_LIMIT = 100

export interface ForumExclusion {
  id: string
  forumId: string
  excludedUserId: string
  excludedByUserId: string
  reason: string | null
  createdAt: string
}

export interface CreateForumExclusionPayload {
  excludedUserId: string
  reason?: string
}

// ─── Charte de bonne conduite ──────────────────────────────────────────────────

/** Texte unique et global — pas de versionnage, pas de charte par forum. */
export interface ForumCharter {
  content: string
  updatedAt: string
}

export interface ForumCharterAcceptance {
  accepted: boolean
  acceptedAt: string | null
}

// ─── Image d'illustration ───────────────────────────────────────────────────────

export interface ForumImageConstraints {
  maxSizeBytes: number
  allowedMimeTypes: string[]
}

/** Corps structuré distinctif d'un `403` faute de charte acceptée (création de sujet ou de
 * commentaire) — à différencier du `403` d'exclusion, qui ne porte pas de champ `code`. */
export const CHARTER_NOT_ACCEPTED_ERROR_CODE = 'CHARTER_NOT_ACCEPTED'
