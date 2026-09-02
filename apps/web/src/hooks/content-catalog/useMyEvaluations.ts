/**
 * useMyEvaluations — "Mes Évaluations" : toutes les évaluations créées par l'utilisateur courant,
 * tous statuts confondus (`pending_validation`, `validated`, `rejected`).
 *
 * `fetchMyEvaluations` compense l'absence de filtre `authorId`/`mine` documenté pour
 * `GET /evaluations` — voir `api/evaluations.ts`. Tente d'enrichir chaque évaluation `rejected`
 * du commentaire de refus via `GET /validations/evaluation/:id/history` — même prudence que
 * `useMyExercises`/`useMyQuizzes` : l'échec ne bloque jamais l'affichage de la liste (repli
 * `rejectionCommentStatus: 'unavailable'`).
 */

import { useEffect, useRef, useState } from 'react'
import { fetchEvaluationValidationHistory, fetchMyEvaluations } from '../../api/evaluations'
import { getErrorMessage } from '../../utils/apiError'
import { useAuth } from '../useAuth'
import type { Evaluation } from '../../types/evaluation'

export interface MyEvaluationListItem extends Evaluation {
  rejectionComment?: string | null
  rejectionCommentStatus: 'loaded' | 'loading' | 'unavailable' | 'not_applicable'
}

export function useMyEvaluations() {
  const { user } = useAuth()
  const [items, setItems] = useState<MyEvaluationListItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refetchToken, setRefetchToken] = useState(0)
  const isIgnoredRef = useRef(false)

  useEffect(() => {
    if (!user) {
      setIsLoading(false)
      return
    }

    isIgnoredRef.current = false
    setIsLoading(true)
    setError(null)

    async function load() {
      try {
        const evaluations = await fetchMyEvaluations(user!.id)
        if (isIgnoredRef.current) return

        const initialItems: MyEvaluationListItem[] = evaluations.map((evaluation) => ({
          ...evaluation,
          rejectionCommentStatus: evaluation.status === 'rejected' ? 'loading' : 'not_applicable',
        }))
        setItems(initialItems)
        setIsLoading(false)

        await Promise.all(
          initialItems
            .filter((evaluation) => evaluation.status === 'rejected')
            .map(async (evaluation) => {
              try {
                const history = await fetchEvaluationValidationHistory(evaluation.id)
                const lastRejection = [...history]
                  .reverse()
                  .find((entry) => entry.decision === 'rejected')
                if (isIgnoredRef.current) return
                setItems((previous) =>
                  previous.map((item) =>
                    item.id === evaluation.id
                      ? {
                          ...item,
                          rejectionComment: lastRejection?.comment ?? null,
                          rejectionCommentStatus: 'loaded',
                        }
                      : item,
                  ),
                )
              } catch {
                if (isIgnoredRef.current) return
                setItems((previous) =>
                  previous.map((item) =>
                    item.id === evaluation.id ? { ...item, rejectionCommentStatus: 'unavailable' } : item,
                  ),
                )
              }
            }),
        )
      } catch (caughtError: unknown) {
        if (isIgnoredRef.current) return
        setError(getErrorMessage(caughtError, 'Impossible de charger vos évaluations.'))
        setIsLoading(false)
      }
    }

    load()

    return () => {
      isIgnoredRef.current = true
    }
  }, [refetchToken, user])

  return {
    items,
    isLoading,
    error,
    refetch: () => setRefetchToken((previous) => previous + 1),
  }
}
