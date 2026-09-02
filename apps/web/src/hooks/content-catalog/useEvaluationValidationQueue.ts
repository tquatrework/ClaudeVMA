/**
 * useEvaluationValidationQueue — file des Évaluations en attente de validation
 * (`pending_validation`), pour affichage dans l'onglet « Validation » de la page Évaluations.
 * Même patron que `useExerciseValidationQueue`/`useQuizValidationQueue`.
 *
 * `fetchPendingEvaluations` compense l'absence de `GET /evaluations/pending-validation` — voir
 * `api/evaluations.ts`. Le scoping AP par relation `animator_of_teacher` reste appliqué côté
 * serveur au moment de la décision (`POST /validations/evaluation/:id/decision`), pas ici.
 */

import { useEffect, useRef, useState } from 'react'
import { decideEvaluationValidation, fetchPendingEvaluations } from '../../api/evaluations'
import { getErrorMessage } from '../../utils/apiError'
import type { Evaluation, EvaluationValidationDecision } from '../../types/evaluation'

/**
 * @param enabled Si `false`, aucun appel n'est effectué.
 */
export function useEvaluationValidationQueue(enabled: boolean) {
  const [items, setItems] = useState<Evaluation[]>([])
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

    fetchPendingEvaluations()
      .then((pendingItems) => {
        if (isIgnoredRef.current) return
        setItems(pendingItems)
      })
      .catch((caughtError: unknown) => {
        if (isIgnoredRef.current) return
        setError(getErrorMessage(caughtError, 'Impossible de charger les évaluations en attente.'))
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
    evaluationId: string,
    decision: EvaluationValidationDecision,
    comment?: string,
  ) => {
    await decideEvaluationValidation(evaluationId, decision, comment)
    setItems((previous) => previous.filter((evaluation) => evaluation.id !== evaluationId))
  }

  return {
    items,
    isLoading,
    error,
    decide,
    refetch: () => setRefetchToken((previous) => previous + 1),
  }
}
