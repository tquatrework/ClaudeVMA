/**
 * Module API — Exercices, volet content-catalog-service.
 * Recherche, création, édition, lecture et validation d'un exercice — les images de bloc sont
 * embarquées inline (base64) dans les payloads de création/édition, aucun appel dédié.
 * Toutes les requêtes passent par apiClient (base /api/v1).
 *
 * Voir `docs/routes.md` > content-catalog-service > « Exercices — refonte du 2026-08-29, bloc
 * image de premier niveau le 2026-09-01 » pour le contrat documenté, et `src/types/exercise.ts`
 * pour les formes.
 */

import apiClient from './client'
import type {
  AuthorExerciseDetail,
  CreateExercisePayload,
  DefaultExerciseTitle,
  ExerciseImageConstraints,
  ExerciseSummary,
  ExerciseValidationDecision,
  ExerciseValidationHistoryEntry,
  PublicExerciseDetail,
} from '../types/exercise'

export type { ExerciseValidationDecision }

export interface ExerciseSearchResult {
  items: ExerciseSummary[]
  total: number
}

export interface SearchExercisesParams {
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
 * GET /exercises
 * Recherche paginée, filtrable par niveau/difficulté/thème/auteur/tag/mot-clé (titre). Un
 * exercice non validé reste invisible sauf à son auteur et aux AP/RP/TI.
 */
export async function searchExercises(
  params: SearchExercisesParams = {},
): Promise<ExerciseSearchResult> {
  const { data } = await apiClient.get<ExerciseSearchResult>('/exercises', {
    params: {
      page: params.page ?? DEFAULT_PAGE,
      limit: params.limit ?? DEFAULT_LIMIT,
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
 * GET /exercises/pending-validation
 * Liste des exercices créés par un professeur, en attente de validation AP/RP. Un AP ne voit
 * que les formateurs qu'il anime, le RP voit tout.
 */
export async function fetchPendingExercises(
  params: { page?: number; limit?: number } = {},
): Promise<ExerciseSearchResult> {
  const { data } = await apiClient.get<ExerciseSearchResult>('/exercises/pending-validation', {
    params: {
      page: params.page ?? DEFAULT_PAGE,
      limit: params.limit ?? DEFAULT_LIMIT,
    },
  })
  return data
}

/**
 * GET /exercises/:id
 * Détail complet — blocs et items, jamais le contenu d'une solution (`hasSolution: boolean`
 * uniquement sur un bloc `question`). `404` si absent ou non visible pour l'appelant.
 */
export async function fetchExercise(exerciseId: string): Promise<PublicExerciseDetail> {
  const { data } = await apiClient.get<PublicExerciseDetail>(`/exercises/${exerciseId}`)
  return data
}

/**
 * GET /exercises/default-title
 * Suggestion de titre par défaut ("Exercice {n}") à lire à l'ouverture du formulaire de création,
 * pour pré-remplir le champ — l'utilisateur reste libre de le modifier (arbitrage du 2026-09-01,
 * `docs/architecture.md` > « Titre des Exercices et des Quizz »).
 */
export async function fetchExerciseDefaultTitle(): Promise<DefaultExerciseTitle> {
  const { data } = await apiClient.get<DefaultExerciseTitle>('/exercises/default-title')
  return data
}

/**
 * GET /exercises/:id/solutions
 * Détail complet AVEC solutions — réservée à l'auteur et aux AP/RP/TI, sur le modèle de
 * `GET /quizzes/:id/solution` (arbitrage du 2026-09-01, point 6 : bug des solutions non
 * réaffichées à l'édition). Voir `fetchExerciseForEdit` ci-dessous pour l'appel tolérant utilisé
 * par l'écran d'édition, qui retombe sur `fetchExercise` si cette route échoue.
 */
export async function fetchExerciseSolutions(exerciseId: string): Promise<AuthorExerciseDetail> {
  const { data } = await apiClient.get<AuthorExerciseDetail>(`/exercises/${exerciseId}/solutions`)
  return data
}

/**
 * Charge un exercice pour édition, en essayant d'abord de récupérer ses solutions déjà saisies
 * (`fetchExerciseSolutions`). Si cette route échoue — pas encore déployée côté
 * `content-catalog-service`, ou appelant non autorisé à la lire — on retombe sur `fetchExercise`
 * (sans solution) plutôt que de bloquer l'édition : l'auteur ressaisit sa solution comme avant,
 * et `solutionsPrefilled` indique à l'écran s'il doit encore afficher l'avertissement.
 */
export async function fetchExerciseForEdit(
  exerciseId: string,
): Promise<{ exercise: PublicExerciseDetail | AuthorExerciseDetail; solutionsPrefilled: boolean }> {
  try {
    const exercise = await fetchExerciseSolutions(exerciseId)
    return { exercise, solutionsPrefilled: true }
  } catch {
    const exercise = await fetchExercise(exerciseId)
    return { exercise, solutionsPrefilled: false }
  }
}

/**
 * POST /exercises
 * Crée un exercice. Statut initial `pending_validation` (professeur) ou `validated` (AP/RP,
 * auto-validé). Un bloc `category: 'image'` porte son image **inline, en base64**
 * (`items[0].imageData`) — contrat confirmé par `content-catalog-service` (PR #191, 2026-09-01) :
 * un seul appel, pas de route multipart séparée. Voir `utils/exercisePayload.ts`
 * (`resolveExerciseImagePayloadItems`) pour la résolution du fichier avant l'appel.
 */
export async function createExercise(
  payload: CreateExercisePayload,
): Promise<PublicExerciseDetail> {
  const { data } = await apiClient.post<PublicExerciseDetail>('/exercises', payload)
  return data
}

/**
 * PUT /exercises/:id
 * Remplace intégralement la structure d'un exercice — réservé à l'auteur. Repasse en
 * `pending_validation` si l'auteur est formateur et que l'exercice était `validated`.
 * **Supprime les images précédemment envoyées à chaque édition** (remplacement intégral, pas de
 * diff par identifiant stable) — elles doivent être **réintroduites dans ce même appel** si elles
 * doivent être conservées. `resolveExerciseImagePayloadItems` s'en charge : il relit le contenu
 * existant d'un bloc image non modifié (via `fetchExercisePartImageBlob`) avant de construire le
 * payload, pour ne jamais perdre une image silencieusement.
 */
export async function updateExercise(
  exerciseId: string,
  payload: CreateExercisePayload,
): Promise<PublicExerciseDetail> {
  const { data } = await apiClient.put<PublicExerciseDetail>(
    `/exercises/${exerciseId}`,
    payload,
  )
  return data
}

/**
 * GET /exercises/image-constraints
 * Plafonds d'image à lire par le front **avant** d'afficher le bouton d'ajout d'image, jamais
 * codés en dur (ajoutée le 2026-09-01, même discipline que `GET /profiles/avatar/constraints`).
 */
export async function fetchExerciseImageConstraints(): Promise<ExerciseImageConstraints> {
  const { data } = await apiClient.get<ExerciseImageConstraints>('/exercises/image-constraints')
  return data
}

/** DELETE /exercises/:id — retire un exercice (statut `REMOVED`). Auteur, RP ou TI. */
export async function deleteExercise(exerciseId: string): Promise<void> {
  await apiClient.delete(`/exercises/${exerciseId}`)
}

/**
 * GET /exercises/:exerciseId/images/:itemId
 * Octets d'une image de bloc (jamais une image de solution, servie exclusivement via
 * learning-activity-service).
 */
export async function fetchExercisePartImageBlob(
  exerciseId: string,
  itemId: string,
): Promise<Blob> {
  const { data } = await apiClient.get<Blob>(`/exercises/${exerciseId}/images/${itemId}`, {
    responseType: 'blob',
  })
  return data
}

// ⚠️ `uploadExercisePartImage`/`uploadExerciseSolutionImage` (routes multipart post-création) ont
// existé un temps le 2026-09-01, avant que le contrat réel de `content-catalog-service` (PR #191)
// ne soit confirmé : elles sont **retirées côté serveur**
// (`POST /exercises/:id/parts/:partId/images` et `.../solution/images` n'existent plus). L'image
// d'un bloc, comme l'image d'une solution, transite désormais en base64, inline, dans
// `createExercise`/`updateExercise` — voir `utils/exercisePayload.ts`
// (`resolveExerciseImagePayloadItems`/`resolveExerciseSolutionImagePayloadItems`). Confirmé en HTTP
// direct contre la production le 2026-09-01 pour l'écriture d'une image de solution (`AuthorContentItem`,
// `types/exercise.ts`).

// ─── Validation — flux générique partagé avec le Quizz (ContentType.EXERCISE) ─────────────────

/**
 * GET /validations/exercise/:id/history
 * Historique chronologique des décisions de validation d'un exercice — ouvert à RP/AP et à
 * l'auteur du contenu (même mécanisme générique que pour le Quizz).
 */
export async function fetchExerciseValidationHistory(
  exerciseId: string,
): Promise<ExerciseValidationHistoryEntry[]> {
  const { data } = await apiClient.get<ExerciseValidationHistoryEntry[]>(
    `/validations/exercise/${exerciseId}/history`,
  )
  return data
}

/**
 * POST /validations/exercise/:id/decision
 * Réutilise le flux de validation générique déjà existant. Commentaire obligatoire en cas de
 * rejet. Vocabulaire réel attendu par le serveur : `'validated' | 'rejected'` (même contrat que
 * le Quizz — voir `docs/routes.md` § Quizz pour la confirmation historique de ce vocabulaire).
 */
export async function decideExerciseValidation(
  exerciseId: string,
  decision: ExerciseValidationDecision,
  comment?: string,
): Promise<void> {
  await apiClient.post(`/validations/exercise/${exerciseId}/decision`, { decision, comment })
}

/**
 * POST /validations/exercise/:id/request
 * Resoumission d'un exercice `rejected` à validation.
 */
export async function requestExerciseValidation(exerciseId: string): Promise<void> {
  await apiClient.post(`/validations/exercise/${exerciseId}/request`, {})
}
