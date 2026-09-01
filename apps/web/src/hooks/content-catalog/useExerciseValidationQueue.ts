/**
 * useExerciseValidationQueue — file des Exercices en attente de validation
 * (`pending_validation`), pour affichage directement dans l'onglet « Validation » de la page
 * Exercices elle-même. Même patron que `useQuizValidationQueue`.
 *
 * `GET /exercises/pending-validation` est scopée côté serveur (RP voit tout, AP uniquement les
 * exercices des formateurs qu'il anime, relation `animator_of_teacher`) — aucune règle de droit
 * dupliquée ici.
 */

import { useEffect, useRef, useState } from 'react'
import { decideExerciseValidation, fetchPendingExercises } from '../../api/exercises'
import { getErrorMessage } from '../../utils/apiError'
import type { ExerciseSummary, ExerciseValidationDecision } from '../../types/exercise'

const PENDING_EXERCISES_PAGE_LIMIT = 100

/**
 * @param enabled Si `false`, aucun appel n'est effectué — pour ne pas interroger
 *   `GET /exercises/pending-validation` (réservée RP/AP) depuis un rôle qui ne verra jamais cet
 *   onglet à l'écran.
 */
export function useExerciseValidationQueue(enabled: boolean) {
  const [items, setItems] = useState<ExerciseSummary[]>([])
  const [isLoading, setIsLoading] = useState(enabled)
  const [error, setError] = useState<string | null>(null)
  const [refetchToken, setRefetchToken] = useState(0)
  const isIgnoredRef = useRef(false)

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false)
      return
    }

    isIgnoredRef.current = false
    setIsLoading(true)
    setError(null)

    fetchPendingExercises({ limit: PENDING_EXERCISES_PAGE_LIMIT })
      .then((result) => {
        if (isIgnoredRef.current) return
        setItems(result.items)
      })
      .catch((caughtError: unknown) => {
        if (isIgnoredRef.current) return
        setError(getErrorMessage(caughtError, 'Impossible de charger les exercices en attente.'))
      })
      .finally(() => {
        if (isIgnoredRef.current) return
        setIsLoading(false)
      })

    return () => {
      isIgnoredRef.current = true
    }
  }, [enabled, refetchToken])

  const decide = async (
    exerciseId: string,
    decision: ExerciseValidationDecision,
    comment?: string,
  ) => {
    await decideExerciseValidation(exerciseId, decision, comment)
    setItems((previous) => previous.filter((exercise) => exercise.id !== exerciseId))
  }

  return {
    items,
    isLoading,
    error,
    decide,
    refetch: () => setRefetchToken((previous) => previous + 1),
  }
}
