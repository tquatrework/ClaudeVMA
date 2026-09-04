/**
 * Module API — Sujets (topics) et commentaires d'un forum (community-path-service)
 *
 * Extrait de `src/api/forums.ts` (2026-09-04, complément « Sujets (topics) des Forums ») : ce
 * dernier dépassait 300 lignes une fois les routes de sujets ajoutées — même principe de
 * découpage déjà suivi dans ce module (`forums.ts`/`forumTopics.ts` plutôt qu'un fichier unique),
 * cohérent avec `tutorials.ts`/`exercises.ts` ailleurs dans le projet.
 *
 * `GET`/`POST`/`DELETE /forums/:id/comments` n'existent plus — un commentaire appartient
 * désormais à un sujet (`ForumTopic`), pas directement à un forum. Voir `docs/routes.md` >
 * « community-path-service » > « Sujets (topics) » pour le contrat complet.
 *
 * Toutes les requêtes passent par apiClient (base /api/v1). Types dans `src/types/forum.ts`.
 */

import apiClient from './client'
import { FORUM_COMMENTS_DEFAULT_LIMIT, FORUM_TOPICS_DEFAULT_LIMIT } from '../types/forum'
import type {
  CreateForumCommentPayload,
  CreateForumTopicPayload,
  CreateForumTopicResponse,
  ForumComment,
  ForumCommentsPage,
  ForumTopic,
  ForumTopicDecisionPayload,
  ForumTopicsPage,
} from '../types/forum'

export type {
  ForumComment,
  CreateForumCommentPayload,
  ForumCommentsPage,
  ForumTopic,
  CreateForumTopicPayload,
  CreateForumTopicResponse,
  ForumTopicsPage,
  ForumTopicDecisionPayload,
} from '../types/forum'

/**
 * POST /forums/:id/topics
 * Crée un sujet (titre + premier message, qui devient le tout premier `ForumComment` du sujet).
 * Réservé aux rôles autorisés sur ce forum, non exclus, ayant accepté la charte de bonne conduite —
 * un `403` porte alors un corps structuré distinctif (`code: "CHARTER_NOT_ACCEPTED"`), voir
 * `CHARTER_NOT_ACCEPTED_ERROR_CODE` dans `src/types/forum.ts`. Le sujet créé part
 * `pending_validation` (sauf s'il s'agit du sujet système, jamais créé par cette route).
 */
export async function createForumTopic(
  forumId: string,
  payload: CreateForumTopicPayload,
): Promise<CreateForumTopicResponse> {
  const { data } = await apiClient.post<CreateForumTopicResponse>(
    `/forums/${forumId}/topics`,
    payload,
  )
  return data
}

/**
 * GET /forums/:id/topics
 * Liste les sujets visibles par l'appelant : validés + les siens propres (tous statuts) + tout ce
 * que voit un administrateur (RP/AF/TI, tous statuts). Le sujet système « Sujet général » apparaît
 * toujours en premier. Paginé (`limit` max 100, refusé explicitement au-delà).
 */
export async function fetchForumTopics(
  forumId: string,
  params: { page?: number; limit?: number } = {},
): Promise<ForumTopicsPage> {
  const { data } = await apiClient.get<ForumTopicsPage>(`/forums/${forumId}/topics`, {
    params: {
      page: params.page ?? 1,
      limit: params.limit ?? FORUM_TOPICS_DEFAULT_LIMIT,
    },
  })
  return data
}

/**
 * GET /forums/:id/topics/:topicId
 * Détail d'un sujet. `404` pour un sujet inexistant **ou** non visible à l'appelant (masquage
 * total — sujet en attente/refusé consulté par un tiers non autorisé), volontairement indistincts.
 */
export async function fetchForumTopic(forumId: string, topicId: string): Promise<ForumTopic> {
  const { data } = await apiClient.get<ForumTopic>(`/forums/${forumId}/topics/${topicId}`)
  return data
}

/**
 * POST /forums/:id/topics/:topicId/decision
 * Valide ou refuse un sujet en attente. Réservé au responsable pédagogique (aucun scoping AP ici,
 * à la différence du contenu pédagogique générique de `content-catalog-service`). `400` si le
 * sujet ciblé est le sujet système (`isDefault`), jamais soumis à validation.
 */
export async function decideForumTopic(
  forumId: string,
  topicId: string,
  payload: ForumTopicDecisionPayload,
): Promise<ForumTopic> {
  const { data } = await apiClient.post<ForumTopic>(
    `/forums/${forumId}/topics/${topicId}/decision`,
    payload,
  )
  return data
}

/**
 * GET /forums/:id/topics/:topicId/comments
 * Commentaires d'un sujet, du plus ancien au plus récent, paginés (`limit` max 100, refusé
 * explicitement au-delà). Une page au-delà de la dernière répond `200 {data: []}`, jamais 404.
 */
export async function fetchForumTopicComments(
  forumId: string,
  topicId: string,
  params: { page?: number; limit?: number } = {},
): Promise<ForumCommentsPage> {
  const { data } = await apiClient.get<ForumCommentsPage>(
    `/forums/${forumId}/topics/${topicId}/comments`,
    {
      params: {
        page: params.page ?? 1,
        limit: params.limit ?? FORUM_COMMENTS_DEFAULT_LIMIT,
      },
    },
  )
  return data
}

/**
 * POST /forums/:id/topics/:topicId/comments
 * Publie un commentaire dans un sujet, immédiatement visible (aucune modération a priori).
 * Réservé aux rôles autorisés sur ce forum, non exclus, ayant accepté la charte de bonne conduite,
 * sujet visible à l'appelant — un `403` porte alors un corps structuré distinctif
 * (`code: "CHARTER_NOT_ACCEPTED"`), voir `CHARTER_NOT_ACCEPTED_ERROR_CODE` dans
 * `src/types/forum.ts`.
 */
export async function createForumTopicComment(
  forumId: string,
  topicId: string,
  payload: CreateForumCommentPayload,
): Promise<ForumComment> {
  const { data } = await apiClient.post<ForumComment>(
    `/forums/${forumId}/topics/${topicId}/comments`,
    payload,
  )
  return data
}

/**
 * DELETE /forums/:id/topics/:topicId/comments/:commentId
 * Supprime un commentaire a posteriori. Réservé au responsable pédagogique — ni l'auteur, ni
 * l'AP, ni le TI. Suppression physique et définitive, `204` sans corps.
 */
export async function deleteForumTopicComment(
  forumId: string,
  topicId: string,
  commentId: string,
): Promise<void> {
  await apiClient.delete(`/forums/${forumId}/topics/${topicId}/comments/${commentId}`)
}
