import { useCallback, useState } from 'react'
import { requestPasswordReset } from '../../api/auth'
import { getErrorMessage } from '../../utils/apiError'

export interface UsePasswordResetResult {
  requestReset: (loginIdentifier: string) => Promise<boolean>
  isSubmitting: boolean
  error: string | null
}

/**
 * usePasswordReset — action de demande de réinitialisation de mot de passe.
 * Retourne `true` en cas de succès (la page affiche alors la confirmation),
 * `false` en cas d'échec avec `error` renseigné pour affichage.
 */
export function usePasswordReset(): UsePasswordResetResult {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const requestReset = useCallback(async (loginIdentifier: string) => {
    setError(null)
    setIsSubmitting(true)
    try {
      await requestPasswordReset(loginIdentifier)
      return true
    } catch (caughtError) {
      setError(getErrorMessage(caughtError, 'Erreur lors de la demande de réinitialisation'))
      return false
    } finally {
      setIsSubmitting(false)
    }
  }, [])

  return { requestReset, isSubmitting, error }
}
