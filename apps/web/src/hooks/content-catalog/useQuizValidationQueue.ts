/**
 * useQuizValidationQueue — file des Quizz en attente de validation (`pending_validation`),
 * pour affichage directement dans l'onglet « Validation » de la page Quizz elle-même.
 *
 * Réutilise exactement les mêmes appels que l'écran générique « Contenus à valider »
 * (`ContentValidationQueuePage.tsx`) : `GET /quizzes/pending-validation` (scopée côté serveur —
 * RP voit tout, AP uniquement les Quizz des formateurs qu'il anime, relation
 * `animator_of_teacher`) et `POST /validations/quiz/:id/decision` (`decision:
 * 'validated' | 'rejected'`). Aucune règle de droit n'est dupliquée côté front : le serveur
 * renvoie déjà la liste correctement scopée.
 */

import { useEffect, useRef, useState } from 'react'
import { decideQuizValidation, fetchPendingQuizzes } from '../../api/quizzes'
import { getErrorMessage } from '../../utils/apiError'
import type { QuizSummary, QuizValidationDecision } from '../../types/quiz'

const PENDING_QUIZZES_PAGE_LIMIT = 100

/**
 * @param enabled Si `false`, aucun appel n'est effectué — pour ne pas interroger
 *   `GET /quizzes/pending-validation` (réservée RP/AP, `403` sinon) depuis un rôle qui ne verra de
 *   toute façon jamais cet onglet à l'écran.
 */
export function useQuizValidationQueue(enabled: boolean) {
  const [items, setItems] = useState<QuizSummary[]>([])
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

    fetchPendingQuizzes({ limit: PENDING_QUIZZES_PAGE_LIMIT })
      .then((result) => {
        if (isIgnoredRef.current) return
        setItems(result.items)
      })
      .catch((caughtError: unknown) => {
        if (isIgnoredRef.current) return
        setError(getErrorMessage(caughtError, 'Impossible de charger les quizz en attente.'))
      })
      .finally(() => {
        if (isIgnoredRef.current) return
        setIsLoading(false)
      })

    return () => {
      isIgnoredRef.current = true
    }
  }, [enabled, refetchToken])

  const decide = async (quizId: string, decision: QuizValidationDecision, comment?: string) => {
    await decideQuizValidation(quizId, decision, comment)
    setItems((previous) => previous.filter((quiz) => quiz.id !== quizId))
  }

  return {
    items,
    isLoading,
    error,
    decide,
    refetch: () => setRefetchToken((previous) => previous + 1),
  }
}
