/**
 * Module API — Tutoriels/Vidéos, volet content-catalog-service.
 * Recherche, création, édition, lecture et validation d'un tutoriel — un bloc image est embarqué
 * inline (base64) dans les payloads de création/édition, même contrat que le bloc image de
 * premier niveau de l'Exercice, aucun appel dédié.
 *
 * Toutes les requêtes passent par apiClient (base /api/v1).
 * Voir `docs/routes.md` > content-catalog-service > « Tutoriels — refonte du 2026-09-03 » pour le
 * contrat documenté, et `src/types/tutorial.ts` pour les formes.
 */

import apiClient from './client'
import type {
  CreateTutorialPayload,
  DefaultTutorialTitle,
  PublicTutorialDetail,
  TutorialImageConstraints,
  TutorialSummary,
  TutorialValidationDecision,
  TutorialValidationHistoryEntry,
} from '../types/tutorial'

export type { TutorialValidationDecision }

export interface TutorialSearchResult {
  items: TutorialSummary[]
  total: number
}

export interface SearchTutorialsParams {
  format?: 'video' | 'post'
  level?: string
  difficulty?: string
  theme?: string
  authorId?: string
  tag?: string
  keyword?: string
  page?: number
  limit?: number
}

const DEFAULT_PAGE = 1
const DEFAULT_LIMIT = 20

/**
 * GET /tutorials
 * Recherche paginée, filtrable par format/niveau/difficulté/thème/auteur/tag/mot-clé (titre). Un
 * tutoriel non validé reste invisible sauf à son auteur, au RP (illimité) et à l'AP (scopé
 * `animator_of_teacher`).
 */
export async function searchTutorials(
  params: SearchTutorialsParams = {},
): Promise<TutorialSearchResult> {
  const { data } = await apiClient.get<TutorialSearchResult>('/tutorials', {
    params: {
      page: params.page ?? DEFAULT_PAGE,
      limit: params.limit ?? DEFAULT_LIMIT,
      ...(params.format ? { format: params.format } : {}),
      ...(params.level ? { level: params.level } : {}),
      ...(params.difficulty ? { difficulty: params.difficulty } : {}),
      ...(params.theme ? { theme: params.theme } : {}),
      ...(params.authorId ? { authorId: params.authorId } : {}),
      ...(params.tag ? { tag: params.tag } : {}),
      ...(params.keyword ? { keyword: params.keyword } : {}),
    },
  })
  return data
}

/**
 * GET /tutorials/pending-validation
 * Liste des tutoriels créés par un professeur, en attente de validation AP/RP. Un AP ne voit que
 * les tutoriels des formateurs qu'il anime, le RP voit tout.
 */
export async function fetchPendingTutorials(
  params: { page?: number; limit?: number } = {},
): Promise<TutorialSearchResult> {
  const { data } = await apiClient.get<TutorialSearchResult>('/tutorials/pending-validation', {
    params: {
      page: params.page ?? DEFAULT_PAGE,
      limit: params.limit ?? DEFAULT_LIMIT,
    },
  })
  return data
}

/**
 * GET /tutorials/:id
 * Détail complet — métadonnées + contenu (`videoUrl` ou séquence de `blocks`). `404` (jamais
 * `403`) si absent ou non visible pour l'appelant.
 */
export async function fetchTutorial(tutorialId: string): Promise<PublicTutorialDetail> {
  const { data } = await apiClient.get<PublicTutorialDetail>(`/tutorials/${tutorialId}`)
  return data
}

/**
 * GET /tutorials/default-title
 * Suggestion de titre par défaut ("Tutoriel (N)") à lire à l'ouverture du formulaire de création,
 * pour pré-remplir le champ — l'utilisateur reste libre de le modifier.
 */
export async function fetchTutorialDefaultTitle(): Promise<DefaultTutorialTitle> {
  const { data } = await apiClient.get<DefaultTutorialTitle>('/tutorials/default-title')
  return data
}

/**
 * POST /tutorials
 * Crée un tutoriel. Statut initial `pending_validation` (professeur) ou `validated` (AP/RP,
 * auto-validé). Collision de titre avec un autre tutoriel du même auteur : disambiguation
 * automatique par suffixe `"(N)"` côté serveur, jamais de `400` sur ce cas précis.
 */
export async function createTutorial(
  payload: CreateTutorialPayload,
): Promise<PublicTutorialDetail> {
  const { data } = await apiClient.post<PublicTutorialDetail>('/tutorials', payload)
  return data
}

/**
 * PUT /tutorials/:id
 * Remplace intégralement un tutoriel — réservé à son auteur. **Supprime les blocs image
 * précédemment envoyés à chaque édition** (remplacement intégral, pas de diff par identifiant
 * stable) : à réintroduire explicitement en base64 dans ce même appel pour les conserver — voir
 * `utils/tutorialImageResolution.ts`.
 */
export async function updateTutorial(
  tutorialId: string,
  payload: CreateTutorialPayload,
): Promise<PublicTutorialDetail> {
  const { data } = await apiClient.put<PublicTutorialDetail>(`/tutorials/${tutorialId}`, payload)
  return data
}

/**
 * GET /tutorials/image-constraints
 * Plafonds d'image à lire par le front **avant** d'afficher le bouton d'ajout d'image, jamais
 * codés en dur.
 */
export async function fetchTutorialImageConstraints(): Promise<TutorialImageConstraints> {
  const { data } = await apiClient.get<TutorialImageConstraints>('/tutorials/image-constraints')
  return data
}

/** DELETE /tutorials/:id — retire un tutoriel (statut `REMOVED`). RP ou TI. */
export async function deleteTutorial(tutorialId: string): Promise<void> {
  await apiClient.delete(`/tutorials/${tutorialId}`)
}

/**
 * GET /tutorials/:tutorialId/images/:blockId
 * Octets d'une image de bloc — revérifie la visibilité du tutoriel parent à chaque téléchargement.
 */
export async function fetchTutorialBlockImageBlob(
  tutorialId: string,
  blockId: string,
): Promise<Blob> {
  const { data } = await apiClient.get<Blob>(`/tutorials/${tutorialId}/images/${blockId}`, {
    responseType: 'blob',
  })
  return data
}

// ─── Validation — flux générique partagé avec Quizz/Exercice/Évaluation ───────────────────────

/**
 * GET /validations/tutorial/:id/history
 * Historique chronologique des décisions de validation d'un tutoriel — ouvert à RP/AP et à
 * l'auteur du contenu (même mécanisme générique que pour les trois autres types).
 */
export async function fetchTutorialValidationHistory(
  tutorialId: string,
): Promise<TutorialValidationHistoryEntry[]> {
  const { data } = await apiClient.get<TutorialValidationHistoryEntry[]>(
    `/validations/tutorial/${tutorialId}/history`,
  )
  return data
}

/**
 * POST /validations/tutorial/:id/decision
 * Réutilise le flux de validation générique. Commentaire obligatoire en cas de rejet. AP scopé
 * par la relation `animator_of_teacher`, RP sans restriction.
 */
export async function decideTutorialValidation(
  tutorialId: string,
  decision: TutorialValidationDecision,
  comment?: string,
): Promise<void> {
  await apiClient.post(`/validations/tutorial/${tutorialId}/decision`, { decision, comment })
}

/**
 * POST /validations/tutorial/:id/request
 * Resoumission d'un tutoriel `rejected` à validation.
 */
export async function requestTutorialValidation(tutorialId: string): Promise<void> {
  await apiClient.post(`/validations/tutorial/${tutorialId}/request`, {})
}
