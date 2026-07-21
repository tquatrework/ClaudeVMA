import { useCallback, useState } from 'react'
import { createSpecificTeacherRequest } from '../../api/teacherRequests'
import type {
  SpecificTeacherRequestCreated,
  SpecificTeacherRequestPayload,
} from '../../types/teacherRequests'

export interface UseSpecificTeacherRequestSubmitResult {
  isSubmitting: boolean
  errorMessage: string | null
  clearError: () => void
  submit: (payload: SpecificTeacherRequestPayload) => Promise<SpecificTeacherRequestCreated | null>
}

function extractMessage(caughtError: unknown, fallback: string): string {
  return (
    (caughtError as { response?: { data?: { message?: string } } })?.response?.data?.message ??
    fallback
  )
}

/**
 * useSpecificTeacherRequestSubmit — orchestration de SpecificTeacherRequestForm :
 * soumission d'une demande de professeur spécifique (sujet/niveau/filière). Reproduit
 * le comportement préexistant (extraction brute du message d'erreur backend).
 */
export function useSpecificTeacherRequestSubmit(): UseSpecificTeacherRequestSubmitResult {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const submit = useCallback(
    async (payload: SpecificTeacherRequestPayload): Promise<SpecificTeacherRequestCreated | null> => {
      setIsSubmitting(true)
      setErrorMessage(null)
      try {
        return await createSpecificTeacherRequest(payload)
      } catch (caughtError: unknown) {
        setErrorMessage(extractMessage(caughtError, 'Erreur lors de la création de la demande'))
        return null
      } finally {
        setIsSubmitting(false)
      }
    },
    [],
  )

  const clearError = useCallback(() => setErrorMessage(null), [])

  return { isSubmitting, errorMessage, clearError, submit }
}
