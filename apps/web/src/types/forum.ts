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
 * Points structurants du nouveau contrat :
 * - Seul le RP crée un forum ; il est visible dès sa création, aucun statut de publication.
 * - Un forum est ouvert à tous par défaut, ou restreint à une liste de rôles (`allowedRoles`).
 *   Un rôle non autorisé ne doit jamais voir le forum exister (404 partout : liste, détail, image,
 *   commentaires) — jamais un 403 qui révélerait son existence.
 * - Une charte de bonne conduite, unique et globale (pas de versionnage), doit être acceptée avant
 *   de publier un commentaire — pas avant de lire.
 * - Suppression d'un commentaire réservée au RP.
 */

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
  level: string | null
  difficulty: string | null
  theme: string | null
  competences: string | null
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
  createdAt: string
  updatedAt: string
}

export interface CreateForumPayload {
  title: string
  description?: string
  level?: string
  difficulty?: string
  theme?: string
  competences?: string
  tags?: string
  allowedRoles?: ForumRestrictableRole[]
}

export interface ForumComment {
  id: string
  forumId: string
  authorId: string
  authorRole: string
  content: string
  createdAt: string
}

export interface CreateForumCommentPayload {
  content: string
}

/** Réponse paginée de `GET /forums/:id/comments` — du plus ancien au plus récent. */
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

/** Corps structuré distinctif d'un `403` de `POST /forums/:id/comments` faute de charte acceptée —
 * à différencier du `403` d'exclusion, qui ne porte pas de champ `code`. */
export const CHARTER_NOT_ACCEPTED_ERROR_CODE = 'CHARTER_NOT_ACCEPTED'
