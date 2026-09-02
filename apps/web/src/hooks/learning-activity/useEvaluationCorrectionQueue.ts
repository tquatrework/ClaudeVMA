/**
 * useEvaluationCorrectionQueue — file des demandes de correction d'Évaluation en attente
 * (`GET /evaluation-corrections/pending`), pour le professeur (demandes où il est lié à l'élève et
 * n'a pas encore refusé) et pour le RP (toutes les demandes `pending` + `all_declined`, état
 * actionnable d'escalade — arbitrage du 2026-09-01).
 */

import { useEffect, useRef, useState } from 'react'
import {
  acceptEvaluationCorrection,
  declineEvaluationCorrection,
  fetchPendingEvaluationCorrections,
} from '../../api/evaluationCorrections'
import { getErrorMessage } from '../../utils/apiError'
import type { EvaluationCorrectionRequest } from '../../types/evaluationAttempt'

/** @param enabled Si `false`, aucun appel n'est effectué — réservé formateur/RP. */
export function useEvaluationCorrectionQueue(enabled: boolean) {
  const [items, setItems] = useState<EvaluationCorrectionRequest[]>([])
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

    fetchPendingEvaluationCorrections()
      .then((pendingItems) => {
        if (isIgnoredRef.current) return
        setItems(pendingItems)
      })
      .catch((caughtError: unknown) => {
        if (isIgnoredRef.current) return
        setError(getErrorMessage(caughtError, 'Impossible de charger les demandes de correction.'))
      })
      .finally(() => {
        if (isIgnoredRef.current) return
        setIsLoading(false)
      })

    return () => {
      isIgnoredRef.current = true
    }
  }, [enabled, refetchToken])

  const accept = async (correctionRequestId: string) => {
    await acceptEvaluationCorrection(correctionRequestId)
    setItems((previous) => previous.filter((item) => item.id !== correctionRequestId))
  }

  const decline = async (correctionRequestId: string) => {
    // Une fois refusée par ce professeur, la demande sort de sa propre file — `GET
    // /evaluation-corrections/pending` ne renvoie que les demandes « pas encore refusées » par
    // l'appelant (docs/routes.md). Retrait local plutôt qu'une mise à jour en place.
    await declineEvaluationCorrection(correctionRequestId)
    setItems((previous) => previous.filter((item) => item.id !== correctionRequestId))
  }

  return {
    items,
    isLoading,
    error,
    accept,
    decline,
    refetch: () => setRefetchToken((previous) => previous + 1),
  }
}
