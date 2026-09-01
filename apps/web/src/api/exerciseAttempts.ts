/**
 * Module API — Exercices, volet learning-activity-service.
 * Inscription (démarrage), passage (réponse facultative, révélation de solution médiée) et
 * historique des tentatives d'exercice (auto-contrôle — jamais de note ni de score).
 * Toutes les requêtes passent par apiClient (base /api/v1).
 *
 * ⚠️ Contrat non documenté dans `docs/routes.md` au moment de l'écriture de ce module (gap
 * signalé au rapport de session) : les chemins et noms de champs ci-dessous sont ceux donnés par
 * la description fonctionnelle de ce chantier (`POST /exercise-attempts`,
 * `POST /exercise-attempts/:id/answers`, `POST /exercise-attempts/:id/reveal`,
 * `GET /exercise-attempts/:id/images/:itemId`, `GET /exercise-attempts/:id`,
 * `GET /exercise-attempts/history`), pas vérifiés en HTTP direct contre la pile réelle. À
 * confirmer/corriger dès qu'une preuve HTTP est disponible.
 */

import apiClient from './client'
import type {
  ExerciseAttempt,
  ExerciseAttemptRevealedSolution,
  PublicContentItem,
} from '../types/exercise'

/**
 * POST /exercise-attempts
 * Démarre une tentative (inscription) sur un exercice.
 */
export async function startExerciseAttempt(exerciseId: string): Promise<ExerciseAttempt> {
  const { data } = await apiClient.post<ExerciseAttempt>('/exercise-attempts', { exerciseId })
  return data
}

/**
 * POST /exercise-attempts/:id/answers
 * Répond (facultativement) à un bloc « question ». Remplace la réponse précédente pour ce
 * `partId` si déjà soumise.
 */
export async function submitExerciseAttemptAnswer(
  attemptId: string,
  partId: string,
  content: string,
): Promise<ExerciseAttempt> {
  const { data } = await apiClient.post<ExerciseAttempt>(
    `/exercise-attempts/${attemptId}/answers`,
    { partId, content },
  )
  return data
}

/**
 * POST /exercise-attempts/:id/reveal
 * Révèle la solution d'un bloc « question » — médié, jamais d'appel direct à
 * content-catalog-service. Renvoie le contenu de la solution dans la réponse.
 */
export async function revealExerciseAttemptSolution(
  attemptId: string,
  partId: string,
): Promise<ExerciseAttemptRevealedSolution> {
  const { data } = await apiClient.post<ExerciseAttemptRevealedSolution>(
    `/exercise-attempts/${attemptId}/reveal`,
    { partId },
  )
  return data
}

/**
 * GET /exercise-attempts/:id/images/:itemId
 * Octets d'une image de solution déjà révélée sur cette tentative (proxy authentifié).
 */
export async function fetchExerciseAttemptImageBlob(
  attemptId: string,
  itemId: string,
): Promise<Blob> {
  const { data } = await apiClient.get<Blob>(
    `/exercise-attempts/${attemptId}/images/${itemId}`,
    { responseType: 'blob' },
  )
  return data
}

/**
 * GET /exercise-attempts/:id
 * État courant d'une tentative : réponses données, solutions révélées, statut
 * (`in_progress`/`done` — fait quand toutes les solutions sont révélées OU toutes les questions
 * ont une réponse).
 */
export async function fetchExerciseAttempt(attemptId: string): Promise<ExerciseAttempt> {
  const { data } = await apiClient.get<ExerciseAttempt>(`/exercise-attempts/${attemptId}`)
  return data
}

/**
 * GET /exercise-attempts/history
 * Historique des tentatives d'exercice de l'utilisateur courant.
 */
export async function fetchExerciseAttemptHistory(): Promise<ExerciseAttempt[]> {
  const { data } = await apiClient.get<ExerciseAttempt[]>('/exercise-attempts/history')
  return data
}

export type { PublicContentItem }
