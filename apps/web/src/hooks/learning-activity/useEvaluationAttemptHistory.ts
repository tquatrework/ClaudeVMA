/**
 * useEvaluationAttemptHistory — historique personnel des tentatives d'Évaluation, enrichi du
 * titre. `GET /evaluation-attempts/history` (learning-activity-service) ne renvoie que
 * `evaluationId` — jamais un titre, propriété de `content-catalog-service`. Règle du projet :
 * aucun UUID affiché à l'utilisateur final, donc le titre est résolu ici via
 * `GET /evaluations/:id`, une fois par évaluation distincte de l'historique. Même patron que
 * `useExerciseAttemptHistory`/`useQuizAttemptHistory`.
 */

import { useEffect, useRef, useState } from 'react'
import { fetchEvaluationAttemptHistory } from '../../api/evaluationAttempts'
import { fetchEvaluation } from '../../api/evaluations'
import { getErrorMessage } from '../../utils/apiError'
import { getEvaluationDisplayTitle } from '../../utils/evaluationLabels'
import type { EvaluationAttemptView } from '../../types/evaluationAttempt'

export interface EvaluationAttemptHistoryEntry extends EvaluationAttemptView {
  /** Titre résolu, ou repli explicite si l'évaluation est devenue inaccessible entre-temps. */
  evaluationTitle: string
}

const UNRESOLVED_TITLE_FALLBACK = 'Évaluation introuvable'

export function useEvaluationAttemptHistory() {
  const [entries, setEntries] = useState<EvaluationAttemptHistoryEntry[]>([])
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
        const attempts = await fetchEvaluationAttemptHistory()
        const uniqueEvaluationIds = Array.from(new Set(attempts.map((a) => a.evaluationId)))

        const titleByEvaluationId = new Map<string, string>()
        await Promise.all(
          uniqueEvaluationIds.map(async (id) => {
            try {
              const evaluation = await fetchEvaluation(id)
              titleByEvaluationId.set(id, getEvaluationDisplayTitle(evaluation.title))
            } catch {
              titleByEvaluationId.set(id, UNRESOLVED_TITLE_FALLBACK)
            }
          }),
        )

        if (isIgnoredRef.current) return
        setEntries(
          attempts.map((attempt) => ({
            ...attempt,
            evaluationTitle:
              titleByEvaluationId.get(attempt.evaluationId) ?? UNRESOLVED_TITLE_FALLBACK,
          })),
        )
      } catch (caughtError: unknown) {
        if (isIgnoredRef.current) return
        setError(getErrorMessage(caughtError, "Impossible de charger l'historique des évaluations."))
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
