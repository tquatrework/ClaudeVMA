/**
 * useMyEvaluationCorrections — demandes de correction acceptées et/ou corrigées par l'appelant
 * (`GET /evaluation-corrections/mine`), pour le professeur ou le RP.
 */

import { useEffect, useRef, useState } from 'react'
import { correctEvaluationCorrection, fetchMyEvaluationCorrections } from '../../api/evaluationCorrections'
import { getErrorMessage } from '../../utils/apiError'
import type { EvaluationCorrectionRequest } from '../../types/evaluationAttempt'

/** @param enabled Si `false`, aucun appel n'est effectué — réservé formateur/RP. */
export function useMyEvaluationCorrections(enabled: boolean) {
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

    fetchMyEvaluationCorrections()
      .then((mineItems) => {
        if (isIgnoredRef.current) return
        setItems(mineItems)
      })
      .catch((caughtError: unknown) => {
        if (isIgnoredRef.current) return
        setError(getErrorMessage(caughtError, 'Impossible de charger vos corrections.'))
      })
      .finally(() => {
        if (isIgnoredRef.current) return
        setIsLoading(false)
      })

    return () => {
      isIgnoredRef.current = true
    }
  }, [enabled, refetchToken])

  const correct = async (
    correctionRequestId: string,
    payload: { score?: number; comment?: string },
  ) => {
    const updated = await correctEvaluationCorrection(correctionRequestId, payload)
    setItems((previous) =>
      previous.map((item) => (item.id === correctionRequestId ? updated : item)),
    )
  }

  return {
    items,
    isLoading,
    error,
    correct,
    refetch: () => setRefetchToken((previous) => previous + 1),
  }
}
