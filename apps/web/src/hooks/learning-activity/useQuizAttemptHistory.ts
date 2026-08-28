/**
 * useQuizAttemptHistory — historique personnel des tentatives de Quizz, enrichi du titre.
 *
 * `GET /quiz-attempts/history` (learning-activity-service) ne renvoie que `quizId` — jamais un
 * titre, propriété de `content-catalog-service`. Règle du projet : aucun UUID affiché à
 * l'utilisateur final, donc le titre est résolu ici via `GET /quizzes/:id`, une fois par quizz
 * distinct de l'historique plutôt qu'un appel par ligne.
 */

import { useEffect, useRef, useState } from 'react'
import { fetchQuizAttemptHistory } from '../../api/quizAttempts'
import { fetchQuiz } from '../../api/quizzes'
import { getErrorMessage } from '../../utils/apiError'
import type { QuizAttempt } from '../../types/quiz'

export interface QuizAttemptHistoryEntry extends QuizAttempt {
  /** Titre résolu, ou repli explicite si le quizz est devenu inaccessible entre-temps. */
  quizTitle: string
}

const UNRESOLVED_TITLE_FALLBACK = 'Quizz introuvable'

export function useQuizAttemptHistory() {
  const [entries, setEntries] = useState<QuizAttemptHistoryEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refetchToken, setRefetchToken] = useState(0)
  const isIgnoredRef = useRef(false)

  useEffect(() => {
    isIgnoredRef.current = false
    setIsLoading(true)
    setError(null)

    async function load() {
      try {
        const attempts = await fetchQuizAttemptHistory()
        const uniqueQuizIds = Array.from(new Set(attempts.map((a) => a.quizId)))

        const titleByQuizId = new Map<string, string>()
        await Promise.all(
          uniqueQuizIds.map(async (id) => {
            try {
              const quiz = await fetchQuiz(id)
              titleByQuizId.set(id, quiz.title)
            } catch {
              titleByQuizId.set(id, UNRESOLVED_TITLE_FALLBACK)
            }
          }),
        )

        if (isIgnoredRef.current) return
        setEntries(
          attempts.map((attempt) => ({
            ...attempt,
            quizTitle: titleByQuizId.get(attempt.quizId) ?? UNRESOLVED_TITLE_FALLBACK,
          })),
        )
      } catch (caughtError: unknown) {
        if (isIgnoredRef.current) return
        setError(getErrorMessage(caughtError, "Impossible de charger l'historique des quizz."))
      } finally {
        if (!isIgnoredRef.current) setIsLoading(false)
      }
    }

    load()

    return () => {
      isIgnoredRef.current = true
    }
  }, [refetchToken])

  return {
    entries,
    isLoading,
    error,
    refetch: () => setRefetchToken((previous) => previous + 1),
  }
}
