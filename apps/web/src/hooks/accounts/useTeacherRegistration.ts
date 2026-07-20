import { useCallback, useState } from 'react'
import { registerTeacher } from '../../api/accounts'
import type { RegisterTeacherPayload } from '../../types/accounts'
import { getErrorMessage } from '../../utils/apiError'

export interface UseTeacherRegistrationResult {
  register: (payload: RegisterTeacherPayload) => Promise<boolean>
  isSubmitting: boolean
  error: string | null
}

/**
 * useTeacherRegistration — action d'inscription (candidature) d'un compte formateur.
 * Retourne `true` en cas de succès (la page décide alors de la navigation),
 * `false` en cas d'échec avec `error` renseigné pour affichage.
 */
export function useTeacherRegistration(): UseTeacherRegistrationResult {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const register = useCallback(async (payload: RegisterTeacherPayload) => {
    setError(null)
    setIsSubmitting(true)
    try {
      await registerTeacher(payload)
      return true
    } catch (caughtError) {
      setError(getErrorMessage(caughtError, 'Erreur lors de la création du compte'))
      return false
    } finally {
      setIsSubmitting(false)
    }
  }, [])

  return { register, isSubmitting, error }
}
