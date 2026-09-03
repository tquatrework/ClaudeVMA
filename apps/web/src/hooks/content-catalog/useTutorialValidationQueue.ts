/**
 * useTutorialValidationQueue — file des Tutoriels en attente de validation (`pending_validation`),
 * pour affichage directement dans l'onglet « Validation » de la page Tutos/Vidéos elle-même.
 * Même patron que `useExerciseValidationQueue`/`useQuizValidationQueue`.
 *
 * `GET /tutorials/pending-validation` est scopée côté serveur (RP voit tout, AP uniquement les
 * tutoriels des formateurs qu'il anime, relation `animator_of_teacher`) — aucune règle de droit
 * dupliquée ici.
 */

import { useEffect, useRef, useState } from 'react'
import { decideTutorialValidation, fetchPendingTutorials } from '../../api/tutorials'
import { getErrorMessage } from '../../utils/apiError'
import type { TutorialSummary, TutorialValidationDecision } from '../../types/tutorial'

const PENDING_TUTORIALS_PAGE_LIMIT = 100

/**
 * @param enabled Si `false`, aucun appel n'est effectué — pour ne pas interroger
 *   `GET /tutorials/pending-validation` (réservée RP/AP) depuis un rôle qui ne verra jamais cet
 *   onglet à l'écran.
 */
export function useTutorialValidationQueue(enabled: boolean) {
  const [items, setItems] = useState<TutorialSummary[]>([])
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

    fetchPendingTutorials({ limit: PENDING_TUTORIALS_PAGE_LIMIT })
      .then((result) => {
        if (isIgnoredRef.current) return
        setItems(result.items)
      })
      .catch((caughtError: unknown) => {
        if (isIgnoredRef.current) return
        setError(getErrorMessage(caughtError, 'Impossible de charger les tutoriels en attente.'))
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
    tutorialId: string,
    decision: TutorialValidationDecision,
    comment?: string,
  ) => {
    await decideTutorialValidation(tutorialId, decision, comment)
    setItems((previous) => previous.filter((tutorial) => tutorial.id !== tutorialId))
  }

  return {
    items,
    isLoading,
    error,
    decide,
    refetch: () => setRefetchToken((previous) => previous + 1),
  }
}
