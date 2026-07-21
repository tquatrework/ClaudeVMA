import { useCallback, useState } from 'react'
import { registerParent } from '../../api/accounts'
import type { RegisterParentPayload } from '../../types/accounts'
import { getErrorMessage } from '../../utils/apiError'

export interface UseParentRegistrationResult {
  register: (payload: RegisterParentPayload) => Promise<boolean>
  isSubmitting: boolean
  error: string | null
}

/**
 * useParentRegistration — action d'inscription d'un compte parent / financeur.
 * Retourne `true` en cas de succès (la page décide alors de la navigation),
 * `false` en cas d'échec avec `error` renseigné pour affichage.
 */
export function useParentRegistration(): UseParentRegistrationResult {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const register = useCallback(async (payload: RegisterParentPayload) => {
    setError(null)
    setIsSubmitting(true)
    try {
      await registerParent(payload)
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
