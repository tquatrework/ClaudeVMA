import { useCallback, useState } from 'react'
import { checkEmailAvailability } from '../../api/accounts'
import { getErrorMessage } from '../../utils/apiError'

export interface UseCheckEmailAvailabilityResult {
  alreadyUsed: boolean
  suggestedLoginIdentifier: string | undefined
  isChecking: boolean
  error: string | null
  checkEmail: (email: string) => Promise<void>
}

/**
 * useCheckEmailAvailability — vérifie la disponibilité d'un email (déclenché au blur
 * du champ email), partagé par les pages d'inscription élève, parent et formateur.
 *
 * Un échec de vérification est désormais affiché à l'utilisateur via `error`
 * (auparavant avalé silencieusement) mais ne bloque jamais la suite du parcours :
 * l'utilisateur peut continuer à saisir un identifiant de connexion manuellement.
 */
export function useCheckEmailAvailability(): UseCheckEmailAvailabilityResult {
  const [alreadyUsed, setAlreadyUsed] = useState(false)
  const [suggestedLoginIdentifier, setSuggestedLoginIdentifier] = useState<string | undefined>(
    undefined,
  )
  const [isChecking, setIsChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const checkEmail = useCallback(async (email: string) => {
    if (!email) return
    setIsChecking(true)
    setError(null)
    try {
      const result = await checkEmailAvailability(email)
      setAlreadyUsed(result.alreadyUsed)
      setSuggestedLoginIdentifier(result.suggestedLoginIdentifier)
    } catch (caughtError) {
      setError(getErrorMessage(caughtError, "Impossible de vérifier la disponibilité de l'email."))
    } finally {
      setIsChecking(false)
    }
  }, [])

  return { alreadyUsed, suggestedLoginIdentifier, isChecking, error, checkEmail }
}
