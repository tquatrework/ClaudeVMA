import { useCallback, useState } from 'react'
import { requestCollaborationStop } from '../../api/teacherRequests'
import type { StopCollaborationPayload } from '../../types/teacherRequests'

export interface UseStopCollaborationRequestResult {
  isSubmitting: boolean
  errorMessage: string | null
  clearError: () => void
  submit: (payload: StopCollaborationPayload) => Promise<boolean>
}

function extractMessage(caughtError: unknown, fallback: string): string {
  return (
    (caughtError as { response?: { data?: { message?: string } } })?.response?.data?.message ??
    fallback
  )
}

/**
 * useStopCollaborationRequest — orchestration de StopCollaborationRequestForm :
 * soumission d'une demande d'arrêt de collaboration avec préavis. Reproduit le
 * comportement préexistant (extraction brute du message d'erreur backend).
 */
export function useStopCollaborationRequest(
  collaborationId: string,
): UseStopCollaborationRequestResult {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const submit = useCallback(
    async (payload: StopCollaborationPayload): Promise<boolean> => {
      setIsSubmitting(true)
      setErrorMessage(null)
      try {
        await requestCollaborationStop(collaborationId, payload)
        return true
      } catch (caughtError: unknown) {
        setErrorMessage(
          extractMessage(caughtError, "Erreur lors de la soumission de la demande d'arrêt"),
        )
        return false
      } finally {
        setIsSubmitting(false)
      }
    },
    [collaborationId],
  )

  const clearError = useCallback(() => setErrorMessage(null), [])

  return { isSubmitting, errorMessage, clearError, submit }
}
