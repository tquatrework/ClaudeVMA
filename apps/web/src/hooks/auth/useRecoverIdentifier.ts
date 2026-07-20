import { useCallback, useState } from 'react'
import { recoverIdentifier } from '../../api/auth'
import { getErrorMessage } from '../../utils/apiError'

export interface UseRecoverIdentifierResult {
  requestRecovery: (email: string) => Promise<boolean>
  isSubmitting: boolean
  error: string | null
}

/**
 * useRecoverIdentifier — action de demande de récupération d'identifiant de connexion.
 * Retourne `true` en cas de succès (la page affiche alors la confirmation),
 * `false` en cas d'échec avec `error` renseigné pour affichage.
 */
export function useRecoverIdentifier(): UseRecoverIdentifierResult {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const requestRecovery = useCallback(async (email: string) => {
    setError(null)
    setIsSubmitting(true)
    try {
      await recoverIdentifier(email)
      return true
    } catch (caughtError) {
      setError(getErrorMessage(caughtError, 'Erreur lors de la demande de récupération'))
      return false
    } finally {
      setIsSubmitting(false)
    }
  }, [])

  return { requestRecovery, isSubmitting, error }
}
