/**
 * Module API — Quizz, volet content-catalog-service.
 * Création, définition, recherche, lecture, édition et validation d'un quizz.
 * Toutes les requêtes passent par apiClient (base /api/v1).
 *
 * Voir `docs/routes.md` > content-catalog-service > « Quizz » pour le contrat documenté, et
 * `src/types/quiz.ts` pour les formes vérifiées contre la pile réelle.
 *
 * Contrat d'édition/mine/validation **vérifié en HTTP direct contre la pile réelle le
 * 2026-08-28** (PR #164 `content-catalog-service`, mergée et déployée) :
 * - `GET /quizzes?mine=true` fonctionne tel quel (nom de paramètre confirmé).
 * - `PUT /quizzes/:id` fonctionne tel quel (même DTO que `POST /quizzes`), et fait bien repasser
 *   un Quizz `validated` en `pending_validation` quand l'auteur formateur l'édite.
 * - `POST /validations/quiz/:id/decision` attend `decision: 'validated' | 'rejected'`, **pas**
 *   `'approve' | 'reject'` — bug réel corrigé ici (présent depuis la PR #157, jamais fonctionnel
 *   en production jusqu'à ce correctif : tout appel avec l'ancien vocabulaire échouait `400`).
 *
 * Suite directe (PR #167 `content-catalog-service`, mergée et déployée), **vérifiée en HTTP
 * direct contre la pile réelle le 2026-08-28** :
 * - `GET /quizzes/:id/solution` renvoie désormais le quizz complet AVEC solution (`isCorrect`
 *   sur les options, `keywords` sur les questions à texte court), réservée à l'auteur et aux
 *   AP/RP/TI (`403` pour tout autre rôle, `404` si absent/non visible) — l'édition peut
 *   désormais pré-remplir réellement les bonnes réponses/mots-clés (voir
 *   `buildEditableStateForEdit` dans `quizPayload.ts`).
 * - `GET /validations/quiz/:id/history` est désormais ouverte à l'auteur du contenu concerné,
 *   en plus de RP/AP — un professeur peut relire le motif de son propre refus.
 */

import apiClient from './client'
import type {
  AuthorQuizDetail,
  CreateQuizPayload,
  PublicQuizDetail,
  QuizSummary,
  QuizValidationDecision,
  QuizValidationHistoryEntry,
} from '../types/quiz'

export type { QuizValidationDecision }

export interface QuizSearchResult {
  items: QuizSummary[]
  total: number
}

export interface SearchQuizzesParams {
  tag?: string
  keyword?: string
  page?: number
  limit?: number
  /**
   * Filtre "mes Quizz" (retour post-production du 2026-08-28, `docs/architecture.md` >
   * « Edition d'un Quizz par son auteur »). Renvoie tous les Quizz de l'appelant, tous statuts
   * confondus (y compris `rejected`). **Confirmé** contre la pile réelle le 2026-08-28.
   */
  mine?: boolean
}

const DEFAULT_PAGE = 1
const DEFAULT_LIMIT = 20

/**
 * GET /quizzes
 * Recherche paginée, filtrable par tag et mot-clé (titre). Un quizz non validé reste invisible
 * sauf à son auteur et aux AP/RP/TI. `mine=true` renvoie tous les quizz de l'appelant.
 */
export async function searchQuizzes(params: SearchQuizzesParams = {}): Promise<QuizSearchResult> {
  const { data } = await apiClient.get<QuizSearchResult>('/quizzes', {
    params: {
      page: params.page ?? DEFAULT_PAGE,
      limit: params.limit ?? DEFAULT_LIMIT,
      ...(params.tag ? { tag: params.tag } : {}),
      ...(params.keyword ? { keyword: params.keyword } : {}),
      ...(params.mine ? { mine: true } : {}),
    },
  })
  return data
}

/**
 * GET /quizzes/pending-validation
 * Liste des quizz créés par un professeur, en attente de validation AP/RP.
 *
 * `page`/`limit` sont **toujours envoyés explicitement** : constaté contre la pile réelle le
 * 2026-08-28, cette route lève une erreur serveur (500) si ces paramètres sont omis (le service
 * calcule `skip` sans valeur par défaut) — contournement côté front en attendant le correctif
 * backend, plutôt que de reproduire l'échec observé.
 */
export async function fetchPendingQuizzes(
  params: { page?: number; limit?: number } = {},
): Promise<QuizSearchResult> {
  const { data } = await apiClient.get<QuizSearchResult>('/quizzes/pending-validation', {
    params: {
      page: params.page ?? DEFAULT_PAGE,
      limit: params.limit ?? DEFAULT_LIMIT,
    },
  })
  return data
}

/**
 * GET /quizzes/:id
 * Détail avec questions et choix — jamais la solution, quel que soit l'appelant (route
 * publique de lecture/passage, inchangée par PR #167). `404` si absent ou non visible pour
 * l'appelant (masquage classique du projet, pas de distinction avec un id inexistant). Pour
 * pré-remplir le formulaire d'édition avec la solution, voir `fetchQuizSolution` ci-dessous.
 */
export async function fetchQuiz(quizId: string): Promise<PublicQuizDetail> {
  const { data } = await apiClient.get<PublicQuizDetail>(`/quizzes/${quizId}`)
  return data
}

/**
 * GET /quizzes/:id/solution
 * Détail complet AVEC solution (`isCorrect` sur les options, `keywords` sur les questions à
 * texte court) — réservée à l'auteur du quizz et aux AP/RP/TI. `403` pour tout autre rôle, `404`
 * si le quizz est absent ou non visible pour l'appelant. Source pour pré-remplir réellement le
 * formulaire d'édition (`buildEditableStateForEdit`), à la différence de `fetchQuiz` qui ne
 * renvoie jamais la solution.
 */
export async function fetchQuizSolution(quizId: string): Promise<AuthorQuizDetail> {
  const { data } = await apiClient.get<AuthorQuizDetail>(`/quizzes/${quizId}/solution`)
  return data
}

/**
 * POST /quizzes
 * Crée un quizz avec ses questions. Statut initial `pending_validation` (professeur) ou
 * `validated` (AP/RP, auto-validé).
 */
export async function createQuiz(payload: CreateQuizPayload): Promise<PublicQuizDetail> {
  const { data } = await apiClient.post<PublicQuizDetail>('/quizzes', payload)
  return data
}

/**
 * PUT /quizzes/:id
 * Modifie un quizz existant — réservé à son auteur (`docs/architecture.md` > « Edition d'un
 * Quizz par son auteur »). **Vérifié contre la pile réelle le 2026-08-28** : un formateur
 * éditant un Quizz déjà `validated` le fait effectivement repasser en `pending_validation` ;
 * AP/RP éditant leur propre Quizz ne changent pas son statut. Même DTO que `POST /quizzes` —
 * l'appelant doit donc renvoyer la **totalité** du quizz, solution comprise (ressaisie par
 * l'auteur, puisqu'elle ne peut pas être relue avant édition).
 */
export async function updateQuiz(
  quizId: string,
  payload: CreateQuizPayload,
): Promise<PublicQuizDetail> {
  const { data } = await apiClient.put<PublicQuizDetail>(`/quizzes/${quizId}`, payload)
  return data
}

/**
 * GET /validations/quiz/:id/history
 * Historique chronologique des décisions de validation d'un quizz. Ouverte à RP/AP et,
 * depuis PR #167, à l'auteur du quizz — un professeur peut donc retrouver le motif de son propre
 * refus. `useMyQuizzes` tolère malgré tout un échec sans jamais bloquer l'affichage de la liste
 * (repli `rejectionCommentStatus: 'unavailable'`), par prudence face à un cas non prévu.
 */
export async function fetchQuizValidationHistory(
  quizId: string,
): Promise<QuizValidationHistoryEntry[]> {
  const { data } = await apiClient.get<QuizValidationHistoryEntry[]>(
    `/validations/quiz/${quizId}/history`,
  )
  return data
}

/**
 * POST /validations/quiz/:id/decision
 * Réutilise le flux de validation générique déjà existant (`ContentType.QUIZ`). Commentaire
 * obligatoire en cas de rejet.
 *
 * **Bug réel corrigé le 2026-08-28** : ce module envoyait `decision: 'approve' | 'reject'`
 * depuis la PR #157 initiale — vocabulaire jamais accepté par le serveur, qui exige
 * `'validated' | 'rejected'` (`400 Bad Request` sur toute tentative avec l'ancien vocabulaire,
 * constaté en HTTP direct). La procédure de validation Quizz n'a donc **jamais fonctionné en
 * production** avant ce correctif, quel que soit l'état du reste de l'écran.
 */
export async function decideQuizValidation(
  quizId: string,
  decision: QuizValidationDecision,
  comment?: string,
): Promise<void> {
  await apiClient.post(`/validations/quiz/${quizId}/decision`, { decision, comment })
}

/**
 * POST /validations/quiz/:id/request
 * Resoumission d'un quizz `rejected` à validation.
 */
export async function requestQuizValidation(quizId: string): Promise<void> {
  await apiClient.post(`/validations/quiz/${quizId}/request`, {})
}
