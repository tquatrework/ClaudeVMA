import { useCallback, useState } from 'react'
import { requestEventCancellation } from '../../api/calendar'

export interface UseCancellationRequestResult {
  reason: string
  setReason: (reason: string) => void
  isSaving: boolean
  isPendingApproval: boolean
  errorMessage: string | null
  submit: () => Promise<void>
}

function extractMessage(caughtError: unknown, fallback: string): string {
  return (
    (caughtError as { response?: { data?: { message?: string } } })?.response?.data?.message ??
    fallback
  )
}

/**
 * useCancellationRequest — orchestration de CancellationRequestDialog : soumission d'une
 * demande d'annulation. Si le backend répond `status: pending_approval` (événement < 48h),
 * bascule vers l'état "en attente d'approbation" ; sinon appelle `onCancelled`. Reproduit le
 * comportement préexistant du composant (extraction du message d'erreur backend brute, sans
 * passer par `getErrorMessage`).
 */
export function useCancellationRequest(
  eventId: string,
  onCancelled: () => void,
): UseCancellationRequestResult {
  const [reason, setReason] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isPendingApproval, setIsPendingApproval] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const submit = useCallback(async () => {
    setIsSaving(true)
    setErrorMessage(null)

    try {
      const payload: { reason?: string } = {}
      if (reason.trim()) payload.reason = reason.trim()

      const data = await requestEventCancellation(eventId, payload)

      if (data?.status === 'pending_approval') {
        setIsPendingApproval(true)
      } else {
        onCancelled()
      }
    } catch (caughtError: unknown) {
      setErrorMessage(extractMessage(caughtError, "Erreur lors de la demande d'annulation"))
    } finally {
      setIsSaving(false)
    }
  }, [eventId, onCancelled, reason])

  return { reason, setReason, isSaving, isPendingApproval, errorMessage, submit }
}
