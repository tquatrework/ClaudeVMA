/**
 * Module API — Quizz, volet content-catalog-service.
 * Création, définition, recherche, lecture, édition et validation d'un quizz.
 * Toutes les requêtes passent par apiClient (base /api/v1).
 *
 * Voir `docs/routes.md` > content-catalog-service > « Quizz » pour le contrat documenté, et
 * `src/types/quiz.ts` pour les formes vérifiées contre la pile réelle.
 *
 * Contrat d'édition/mine/validation **vérifié en HTTP direct contre la pile réelle le
 * 2026-08-28** (PR #164 `content-catalog-service` déjà déployée sur le conteneur en service,
 * bien qu'encore ouverte au moment de cette vérification) :
 * - `GET /quizzes?mine=true` fonctionne tel quel (nom de paramètre confirmé).
 * - `PUT /quizzes/:id` fonctionne tel quel (même DTO que `POST /quizzes`), et fait bien repasser
 *   un Quizz `validated` en `pending_validation` quand l'auteur formateur l'édite.
 * - **Aucune route ne renvoie la solution à l'auteur**, y compris `GET /quizzes/:id/edit`
 *   (`404`) et `GET /quizzes/:id?includeSolution=true` (paramètre ignoré) : l'édition ne peut
 *   donc PAS pré-remplir les bonnes réponses/mots-clés — l'auteur doit les ressaisir à chaque
 *   édition (voir `buildEditableStateForEdit` dans `quizPayload.ts`).
 * - `POST /validations/quiz/:id/decision` attend `decision: 'validated' | 'rejected'`, **pas**
 *   `'approve' | 'reject'` — bug réel corrigé ici (présent depuis la PR #157, jamais fonctionnel
 *   en production jusqu'à ce correctif : tout appel avec l'ancien vocabulaire échouait `400`).
 * - `GET /validations/quiz/:id/history` existe et fonctionne pour RP, mais renvoie `403` à
 *   l'auteur formateur — impossible pour l'auteur de lire le motif de son propre refus par
 *   cette voie. Blocage réel, signalé au rapport de session.
 */

import apiClient from './client'
import type {
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
 * Détail avec questions et choix — jamais la solution, **y compris pour l'auteur** (vérifié le
 * 2026-08-28 : ni `?includeSolution=true` ni une route `/edit` dédiée ne la renvoient). `404` si
 * absent ou non visible pour l'appelant (masquage classique du projet, pas de distinction avec
 * un id inexistant). Sert aussi de source pour pré-remplir le formulaire d'édition — sans la
 * solution, qui doit être ressaisie (voir `buildEditableStateForEdit`).
 */
export async function fetchQuiz(quizId: string): Promise<PublicQuizDetail> {
  const { data } = await apiClient.get<PublicQuizDetail>(`/quizzes/${quizId}`)
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
 * Historique chronologique des décisions de validation d'un quizz. **Existe et fonctionne pour
 * RP/AP** (vérifié le 2026-08-28), mais renvoie `403` à l'auteur formateur — l'auteur ne peut
 * donc pas l'utiliser pour retrouver le motif de son propre refus. `useMyQuizzes` appelle quand
 * même cette route (au cas où l'appelant serait aussi RP/AP) et tolère l'échec dans le cas
 * contraire, sans jamais bloquer l'affichage de la liste.
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
