/**
 * useExerciseAttemptHistory — historique personnel des tentatives d'Exercice, enrichi du titre.
 *
 * `GET /exercise-attempts/history` (learning-activity-service) ne renvoie que `exerciseId` —
 * jamais un titre, propriété de `content-catalog-service`. Règle du projet : aucun UUID affiché à
 * l'utilisateur final, donc le titre est résolu ici via `GET /exercises/:id`, une fois par
 * exercice distinct de l'historique plutôt qu'un appel par ligne. Même patron que
 * `useQuizAttemptHistory`.
 */

import { useEffect, useRef, useState } from 'react'
import { fetchExerciseAttemptHistory } from '../../api/exerciseAttempts'
import { fetchExercise } from '../../api/exercises'
import { getErrorMessage } from '../../utils/apiError'
import { getExerciseDisplayTitle } from '../../utils/exerciseLabels'
import type { ExerciseAttempt } from '../../types/exercise'

export interface ExerciseAttemptHistoryEntry extends ExerciseAttempt {
  /** Titre résolu, ou repli explicite si l'exercice est devenu inaccessible entre-temps. */
  exerciseTitle: string
}

const UNRESOLVED_TITLE_FALLBACK = 'Exercice introuvable'

export function useExerciseAttemptHistory() {
  const [entries, setEntries] = useState<ExerciseAttemptHistoryEntry[]>([])
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
        const attempts = await fetchExerciseAttemptHistory()
        const uniqueExerciseIds = Array.from(new Set(attempts.map((a) => a.exerciseId)))

        const titleByExerciseId = new Map<string, string>()
        await Promise.all(
          uniqueExerciseIds.map(async (id) => {
            try {
              const exercise = await fetchExercise(id)
              titleByExerciseId.set(id, getExerciseDisplayTitle(exercise.title))
            } catch {
              titleByExerciseId.set(id, UNRESOLVED_TITLE_FALLBACK)
            }
          }),
        )

        if (isIgnoredRef.current) return
        setEntries(
          attempts.map((attempt) => ({
            ...attempt,
            exerciseTitle: titleByExerciseId.get(attempt.exerciseId) ?? UNRESOLVED_TITLE_FALLBACK,
          })),
        )
      } catch (caughtError: unknown) {
        if (isIgnoredRef.current) return
        setError(getErrorMessage(caughtError, "Impossible de charger l'historique des exercices."))
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
