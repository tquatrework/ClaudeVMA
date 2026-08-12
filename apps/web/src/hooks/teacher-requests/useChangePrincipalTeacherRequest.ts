import { useCallback, useState } from 'react'
import { createPpChangeRequest } from '../../api/teacherRequests'
import type { PpChangeRequestPayload } from '../../types/teacherRequests'
import { getErrorMessage } from '../../utils/apiError'

export interface UseChangePrincipalTeacherRequestResult {
  isSubmitting: boolean
  errorMessage: string | null
  clearError: () => void
  submit: (payload: PpChangeRequestPayload) => Promise<boolean>
}

/**
 * useChangePrincipalTeacherRequest — `POST /teacher-requests/pp-change`.
 *
 * Le corps est celui du serveur : `{studentId, currentPpTeacherId?, description}`. Le
 * `studentId` est choisi dans le formulaire (le parent peut avoir plusieurs élèves), il
 * n'est plus figé à l'identifiant du compte connecté — un parent n'est pas un élève.
 */
export function useChangePrincipalTeacherRequest(): UseChangePrincipalTeacherRequestResult {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const submit = useCallback(async (payload: PpChangeRequestPayload): Promise<boolean> => {
    setIsSubmitting(true)
    setErrorMessage(null)
    try {
      await createPpChangeRequest(payload)
      return true
    } catch (caughtError) {
      setErrorMessage(
        getErrorMessage(caughtError, "La demande n'a pas pu être transmise. Veuillez réessayer."),
      )
      return false
    } finally {
      setIsSubmitting(false)
    }
  }, [])

  const clearError = useCallback(() => setErrorMessage(null), [])

  return { isSubmitting, errorMessage, clearError, submit }
}
