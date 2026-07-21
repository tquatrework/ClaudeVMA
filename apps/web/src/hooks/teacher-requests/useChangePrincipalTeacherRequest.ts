import { useCallback, useState } from 'react'
import { createPpChangeRequest } from '../../api/teacherRequests'
import type { PpChangeRequestPayload, PpChangeResponse } from '../../types/teacherRequests'

export interface UseChangePrincipalTeacherRequestResult {
  isSubmitting: boolean
  errorMessage: string | null
  clearError: () => void
  submit: (payload: Omit<PpChangeRequestPayload, 'studentId'>) => Promise<PpChangeResponse | null>
}

function extractMessage(caughtError: unknown, fallback: string): string {
  return (
    (caughtError as { response?: { data?: { message?: string } } })?.response?.data?.message ??
    fallback
  )
}

/**
 * useChangePrincipalTeacherRequest — orchestration de ChangePrincipalTeacherDialog :
 * soumission d'une demande de changement de professeur principal. Reproduit le
 * comportement préexistant (extraction brute du message d'erreur backend, sans passer
 * par `getErrorMessage`).
 */
export function useChangePrincipalTeacherRequest(
  studentId: string,
): UseChangePrincipalTeacherRequestResult {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const submit = useCallback(
    async (
      payload: Omit<PpChangeRequestPayload, 'studentId'>,
    ): Promise<PpChangeResponse | null> => {
      setIsSubmitting(true)
      setErrorMessage(null)
      try {
        return await createPpChangeRequest({ studentId, ...payload })
      } catch (caughtError: unknown) {
        setErrorMessage(
          extractMessage(caughtError, 'Erreur lors de la soumission de la demande'),
        )
        return null
      } finally {
        setIsSubmitting(false)
      }
    },
    [studentId],
  )

  const clearError = useCallback(() => setErrorMessage(null), [])

  return { isSubmitting, errorMessage, clearError, submit }
}
