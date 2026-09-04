/**
 * Module API — community-path-service (Phase 14)
 * Forums, modération, charte, parcours, inscriptions, progression et certificats.
 * Toutes les requêtes passent par apiClient (base /api/v1).
 *
 * Forums — refonte du 2026-09-04 (`docs/routes.md` > « community-path-service »). Les types
 * `Forum`/`ForumComment`/`ForumExclusion`/etc. vivent désormais dans `src/types/forum.ts`, réutilisé
 * par les hooks et composants — ce module ne fait plus que le transport HTTP typé.
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

// ─── Types — Parcours ─────────────────────────────────────────────────────────

export type PathStatus = 'draft' | 'pending_validation' | 'published' | 'archived'

export interface LearningPath {
  id: string
  title: string
  description: string
  authorId: string
  status: PathStatus
  stepCount?: number
  createdAt: string
  updatedAt?: string
}

export interface CreatePathPayload {
  title: string
  description: string
}

export interface PathValidationPayload {
  approved: boolean
  comment?: string
}

// ─── Types — Inscriptions et progression ─────────────────────────────────────

export type EnrollmentStatus = 'active' | 'completed' | 'cancelled'

export interface PathEnrollment {
  id: string
  pathId: string
  studentId: string
  status: EnrollmentStatus
  progressPercent: number
  enrolledAt: string
  completedAt?: string
  certificateUrl?: string
}

export interface CreateEnrollmentPayload {
  studentId?: string
}

export interface UpdateProgressPayload {
  progressPercent: number
}

// ─── Liste paginée ────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[]
  meta: {
    total: number
    page: number
    pageSize: number
  }
}

// ─── API Forums ───────────────────────────────────────────────────────────────

/**
 * GET /forums
 * Liste les forums accessibles à l'appelant. Un forum restreint à des rôles n'incluant pas celui
 * de l'appelant (et qui n'est pas administratif) est simplement absent de la réponse — jamais un
 * item masqué, jamais un 403.
 *
 * `tags` : filtre optionnel, chaîne séparée par virgules, correspondance partielle `OR`.
 */
export async function fetchForums(params?: { tags?: string }): Promise<Forum[]> {
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

// ─── API Parcours ─────────────────────────────────────────────────────────────

/**
 * GET /paths
 * Liste les parcours disponibles.
 */
export async function fetchPaths(params?: {
  status?: PathStatus
}): Promise<LearningPath[]> {
  const { data } = await apiClient.get<LearningPath[] | PaginatedResponse<LearningPath>>(
    '/paths',
    { params },
  )
  if (Array.isArray(data)) return data
  return (data as PaginatedResponse<LearningPath>).data ?? []
}

/**
 * POST /paths
 * Crée un parcours (AP, RP).
 */
export async function createPath(payload: CreatePathPayload): Promise<LearningPath> {
  const { data } = await apiClient.post<LearningPath>('/paths', payload)
  return data
}

/**
 * POST /paths/:id/validate
 * Le RP valide ou rejette un parcours AP.
 */
export async function validatePath(
  pathId: string,
  payload: PathValidationPayload,
): Promise<LearningPath> {
  const { data } = await apiClient.post<LearningPath>(`/paths/${pathId}/validate`, payload)
  return data
}

// ─── API Inscriptions ─────────────────────────────────────────────────────────

/**
 * POST /paths/:id/enrollments
 * Inscrit l'élève courant à un parcours.
 */
export async function enrollInPath(
  pathId: string,
  payload: CreateEnrollmentPayload = {},
): Promise<PathEnrollment> {
  const { data } = await apiClient.post<PathEnrollment>(`/paths/${pathId}/enrollments`, payload)
  return data
}

/**
 * PATCH /path-enrollments/:id/progress
 * Met à jour la progression d'une inscription.
 */
export async function updateEnrollmentProgress(
  enrollmentId: string,
  payload: UpdateProgressPayload,
): Promise<PathEnrollment> {
  const { data } = await apiClient.patch<PathEnrollment>(
    `/path-enrollments/${enrollmentId}/progress`,
    payload,
  )
  return data
}
