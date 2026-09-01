/**
 * Module API — Exercices, volet learning-activity-service.
 * Inscription (démarrage), passage (réponse facultative, révélation de solution médiée) et
 * historique des tentatives d'exercice (auto-contrôle — jamais de note ni de score).
 * Toutes les requêtes passent par apiClient (base /api/v1).
 *
 * Contrat vérifié par preuve HTTP directe contre `https://claudevma.visioprof.fr` le 2026-09-01
 * (chemins et noms de champs confirmés, y compris les deux écarts avec la première version de ce
 * module : `answers` attend `content` comme un **tableau** d'items `{type, content}`, jamais une
 * chaîne brute ; et `POST .../reveal` renvoie déjà la **tentative complète** à jour, ce qui rend
 * inutile un second appel à `fetchExerciseAttempt` après une révélation). `docs/routes.md` ne
 * documente toujours pas ce volet de `learning-activity-service` — gap de documentation à signaler
 * au sous-agent propriétaire, non corrigé ici (hors périmètre `apps/web`).
 */

import apiClient from './client'
import type {
  ExerciseAttempt,
  ExerciseAttemptAnswerItem,
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
 * Répond (facultativement) à un bloc « question ». `content` est un tableau d'un ou plusieurs
 * items texte/formule (jamais vide — le serveur refuse `content: []` en `400`). Remplace la
 * réponse précédente pour ce `partId` si déjà soumise. Renvoie la tentative complète à jour.
 */
export async function submitExerciseAttemptAnswer(
  attemptId: string,
  partId: string,
  content: ExerciseAttemptAnswerItem[],
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
 * content-catalog-service. Renvoie la **tentative complète** à jour (tous les blocs, pas
 * seulement celui révélé) : inutile de relire l'état par un second appel après coup.
 */
export async function revealExerciseAttemptSolution(
  attemptId: string,
  partId: string,
): Promise<ExerciseAttempt> {
  const { data } = await apiClient.post<ExerciseAttempt>(
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
