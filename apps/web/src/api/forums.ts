/**
 * Module API — Forums (community-path-service)
 *
 * Refonte du 2026-09-04 (`docs/routes.md` > « community-path-service »). Remplace intégralement
 * l'ancien contrat porté par `src/api/communityPath.ts` (statuts `draft`/`pending_validation`/
 * `published`/`closed`, création AP, pas d'image, pas de charte, pas de restriction par rôle) —
 * ce fichier ne couvrait alors même pas `GET /forums/:id` ni `GET /forums/:id/comments`.
 *
 * Extrait de `communityPath.ts` en un module dédié (2026-09-04, même refonte) : ce dernier
 * dépassait 300 lignes une fois les Forums réécrits, et Forums/Parcours sont deux surfaces
 * indépendantes de `community-path-service` — même principe que `tutorials.ts`/`exercises.ts`,
 * chacun son fichier plutôt qu'un `contentCatalog.ts` fourre-tout.
 *
 * Toutes les requêtes passent par apiClient (base /api/v1). Types dans `src/types/forum.ts`.
 */

import apiClient from './client'
import { FORUM_COMMENTS_DEFAULT_LIMIT } from '../types/forum'
import type {
  CreateForumCommentPayload,
  CreateForumExclusionPayload,
  CreateForumPayload,
  Forum,
  ForumCharter,
  ForumCharterAcceptance,
  ForumComment,
  ForumCommentsPage,
  ForumExclusion,
  ForumImageConstraints,
} from '../types/forum'

export type {
  Forum,
  CreateForumPayload,
  ForumComment,
  CreateForumCommentPayload,
  ForumCommentsPage,
  ForumExclusion,
  CreateForumExclusionPayload,
  ForumCharter,
  ForumCharterAcceptance,
  ForumImageConstraints,
} from '../types/forum'

/**
 * GET /forums
 * Liste les forums accessibles à l'appelant. Un forum restreint à des rôles n'incluant pas celui
 * de l'appelant (et qui n'est pas administratif) est simplement absent de la réponse — jamais un
 * item masqué, jamais un 403. Un forum caché (`isHidden`) est absent de la même façon pour tout le
 * monde sauf le RP.
 *
 * `tags` : filtre optionnel, chaîne séparée par virgules, correspondance partielle `OR`.
 * `mine` : `true` = ne renvoie que les forums créés par l'appelant, tous statuts confondus, y
 * compris ses propres forums cachés — combinable avec `tags` (ajouté le 2026-09-04).
 */
export async function fetchForums(params?: { tags?: string; mine?: boolean }): Promise<Forum[]> {
  const { data } = await apiClient.get<Forum[]>('/forums', { params })
  return data
}

/**
 * GET /forums/:id
 * Détail d'un forum unique. `404` pour un forum inexistant **ou** un rôle non autorisé sur un
 * forum restreint — les deux cas sont volontairement indistincts (masquage total).
 */
export async function fetchForum(forumId: string): Promise<Forum> {
  const { data } = await apiClient.get<Forum>(`/forums/${forumId}`)
  return data
}

/**
 * POST /forums/:id/hide
 * Masque un forum — le retire de la lecture de tout le monde sauf du RP. Réservé au responsable
 * pédagogique. Idempotent : masquer un forum déjà caché renvoie l'entité telle quelle. Aucune
 * route de réouverture n'existe.
 */
export async function hideForum(forumId: string): Promise<Forum> {
  const { data } = await apiClient.post<Forum>(`/forums/${forumId}/hide`)
  return data
}

/**
 * POST /forums
 * Crée un forum, visible immédiatement. Réservé au responsable pédagogique.
 */
export async function createForum(payload: CreateForumPayload): Promise<Forum> {
  const { data } = await apiClient.post<Forum>('/forums', payload)
  return data
}

/**
 * GET /forums/:id/comments
 * Commentaires du forum, du plus ancien au plus récent, paginés (`limit` max 100, refusé
 * explicitement au-delà). Une page au-delà de la dernière répond `200 {data: []}`, jamais 404.
 */
export async function fetchForumComments(
  forumId: string,
  params: { page?: number; limit?: number } = {},
): Promise<ForumCommentsPage> {
  const { data } = await apiClient.get<ForumCommentsPage>(`/forums/${forumId}/comments`, {
    params: {
      page: params.page ?? 1,
      limit: params.limit ?? FORUM_COMMENTS_DEFAULT_LIMIT,
    },
  })
  return data
}

/**
 * POST /forums/:id/comments
 * Publie un commentaire, immédiatement visible (aucune modération a priori). Réservé aux rôles
 * autorisés sur ce forum, non exclus, ayant accepté la charte de bonne conduite — un `403` porte
 * alors un corps structuré distinctif (`code: "CHARTER_NOT_ACCEPTED"`), voir
 * `CHARTER_NOT_ACCEPTED_ERROR_CODE` dans `src/types/forum.ts`.
 */
export async function createForumComment(
  forumId: string,
  payload: CreateForumCommentPayload,
): Promise<ForumComment> {
  const { data } = await apiClient.post<ForumComment>(`/forums/${forumId}/comments`, payload)
  return data
}

/**
 * DELETE /forums/:id/comments/:commentId
 * Supprime un commentaire a posteriori. Réservé au responsable pédagogique — ni l'auteur, ni
 * l'AP, ni le TI. Suppression physique et définitive, `204` sans corps.
 */
export async function deleteForumComment(forumId: string, commentId: string): Promise<void> {
  await apiClient.delete(`/forums/${forumId}/comments/${commentId}`)
}

/**
 * GET /forums/charter
 * Texte courant de la charte de bonne conduite — unique et global, pas de charte par forum, pas
 * de versionnage. Peut être vide (état initial tant qu'aucun RP/TI ne l'a renseigné).
 */
export async function fetchForumCharter(): Promise<ForumCharter> {
  const { data } = await apiClient.get<ForumCharter>('/forums/charter')
  return data
}

/**
 * PATCH /forums/charter
 * Remplace intégralement le texte de la charte. Réservé au responsable pédagogique et au
 * technicien informatique.
 */
export async function updateForumCharter(content: string): Promise<ForumCharter> {
  const { data } = await apiClient.patch<ForumCharter>('/forums/charter', { content })
  return data
}

/**
 * GET /forums/charter/acceptance
 * Statut d'acceptation de la charte pour l'appelant courant — global, valable pour tous les
 * forums, pas besoin de le rappeler par forum.
 */
export async function fetchForumCharterAcceptance(): Promise<ForumCharterAcceptance> {
  const { data } = await apiClient.get<ForumCharterAcceptance>('/forums/charter/acceptance')
  return data
}

/**
 * POST /forums/charter/acceptance
 * Accepte la charte, sans corps. Idempotent : une acceptation déjà enregistrée est renvoyée
 * telle quelle (`200`), pas une erreur.
 */
export async function acceptForumCharter(): Promise<ForumCharterAcceptance> {
  const { data } = await apiClient.post<ForumCharterAcceptance>('/forums/charter/acceptance')
  return data
}

/**
 * GET /forums/image-constraints
 * Contraintes d'envoi de l'image d'illustration — à lire AVANT d'afficher le sélecteur de
 * fichier, jamais codées en dur côté front.
 */
export async function fetchForumImageConstraints(): Promise<ForumImageConstraints> {
  const { data } = await apiClient.get<ForumImageConstraints>('/forums/image-constraints')
  return data
}

/**
 * POST /forums/:id/image
 * Téléverse ou remplace l'image d'illustration. Réservé au responsable pédagogique.
 *
 * Corps `multipart/form-data`, un seul fichier, champ `file`. Le `Content-Type` est neutralisé
 * (`undefined`) pour laisser le navigateur poser lui-même l'en-tête avec son `boundary` — même
 * discipline que `POST /profiles/:userId/avatar` (`src/api/profile.ts`).
 */
export async function uploadForumImage(forumId: string, file: File): Promise<Forum> {
  const formData = new FormData()
  formData.append('file', file)

  const { data } = await apiClient.post<Forum>(`/forums/${forumId}/image`, formData, {
    headers: { 'Content-Type': undefined },
  })
  return data
}

/**
 * GET /forums/:id/image
 * Lit les octets de l'image. `404` pour trois cas volontairement indistincts côté front : forum
 * inexistant, rôle non autorisé (restriction), ou forum accessible mais sans image envoyée.
 */
export async function fetchForumImageBlob(forumId: string): Promise<Blob> {
  const { data } = await apiClient.get<Blob>(`/forums/${forumId}/image`, {
    responseType: 'blob',
  })
  return data
}

/**
 * POST /forums/:id/exclusions
 * Exclut un membre précis d'un forum. Réservé au propriétaire du forum (de fait toujours un RP
 * depuis le 2026-09-04) ou à tout responsable pédagogique.
 */
export async function createForumExclusion(
  forumId: string,
  payload: CreateForumExclusionPayload,
): Promise<ForumExclusion> {
  const { data } = await apiClient.post<ForumExclusion>(`/forums/${forumId}/exclusions`, payload)
  return data
}
