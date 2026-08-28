/**
 * Module API — Quizz, volet learning-activity-service.
 * Inscription (démarrage), passage (soumission notée) et historique des tentatives.
 * Toutes les requêtes passent par apiClient (base /api/v1).
 *
 * Voir `docs/routes.md` > learning-activity-service > « Quizz » et `src/types/quiz.ts`.
 */

import apiClient from './client'
import type { QuizAnswerPayload, QuizAttempt } from '../types/quiz'

/**
 * POST /quiz-attempts
 * Démarre une tentative (inscription). Rôles autorisés : élève, formateur, RP, AP.
 */
export async function startQuizAttempt(quizId: string): Promise<QuizAttempt> {
  const { data } = await apiClient.post<QuizAttempt>('/quiz-attempts', { quizId })
  return data
}

/**
 * POST /quiz-attempts/:id/submit
 * Soumet les réponses, déclenche la notation côté serveur (`content-catalog-service`, jamais
 * la solution en clair) et renvoie le résultat noté.
 */
export async function submitQuizAttempt(
  attemptId: string,
  answers: QuizAnswerPayload[],
): Promise<QuizAttempt> {
  const { data } = await apiClient.post<QuizAttempt>(`/quiz-attempts/${attemptId}/submit`, {
    answers,
  })
  return data
}

/**
 * GET /quiz-attempts/history
 * Historique des tentatives notées de l'utilisateur courant.
 */
export async function fetchQuizAttemptHistory(): Promise<QuizAttempt[]> {
  const { data } = await apiClient.get<QuizAttempt[]>('/quiz-attempts/history')
  return data
}
