import { useCallback, useState } from 'react'
import { registerStudent } from '../../api/accounts'
import type { RegisterStudentPayload } from '../../types/accounts'
import {
  buildRegistrationErrorContext,
  getRegistrationErrorMessage,
} from '../../utils/registrationError'

export interface UseStudentRegistrationResult {
  register: (payload: RegisterStudentPayload) => Promise<boolean>
  isSubmitting: boolean
  error: string | null
}

/**
 * useStudentRegistration — action d'inscription d'un compte élève.
 * Retourne `true` en cas de succès (la page décide alors de la navigation),
 * `false` en cas d'échec avec `error` renseigné pour affichage.
 */
export function useStudentRegistration(): UseStudentRegistrationResult {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const register = useCallback(async (payload: RegisterStudentPayload) => {
    setError(null)
    setIsSubmitting(true)
    try {
      await registerStudent(payload)
      return true
    } catch (caughtError) {
      setError(
        getRegistrationErrorMessage(
          caughtError,
          buildRegistrationErrorContext('parent', payload),
          'Erreur lors de la création du compte',
        ),
      )
      return false
    } finally {
      setIsSubmitting(false)
    }
  }, [])

  return { register, isSubmitting, error }
}
