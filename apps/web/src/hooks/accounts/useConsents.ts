import { useCallback, useMemo, useState } from 'react'
import { fetchConsents, signConsent } from '../../api/accounts'
import type { ConsentType } from '../../types/accounts'
import { useAsyncData } from '../useAsyncData'
import { getErrorMessage } from '../../utils/apiError'

export interface UseConsentsResult {
  signedTypes: string[]
  isLoading: boolean
  loadError: string | null
  sign: (consentType: ConsentType) => Promise<boolean>
  isSaving: boolean
  signError: string | null
}

/**
 * useConsents — charge les consentements déjà signés par l'utilisateur connecté
 * et expose une action de signature.
 *
 * La signature met à jour `signedTypes` de façon optimiste (ajout immédiat du type
 * signé) plutôt que de recharger la liste complète, pour reproduire le comportement
 * préexistant de la page (retour instantané sans aller-retour réseau supplémentaire).
 */
export function useConsents(): UseConsentsResult {
  const {
    data,
    isLoading,
    error: loadError,
  } = useAsyncData(fetchConsents, [], {
    fallbackErrorMessage: 'Impossible de charger les consentements.',
  })

  const [signedOverride, setSignedOverride] = useState<string[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [signError, setSignError] = useState<string | null>(null)

  const signedTypes = useMemo(() => {
    const fetchedTypes = data?.map((consent) => consent.consentType) ?? []
    return Array.from(new Set([...fetchedTypes, ...signedOverride]))
  }, [data, signedOverride])

  const sign = useCallback(async (consentType: ConsentType) => {
    setSignError(null)
    setIsSaving(true)
    try {
      await signConsent(consentType)
      setSignedOverride((previous) => [...previous, consentType])
      return true
    } catch (caughtError) {
      setSignError(getErrorMessage(caughtError, 'Erreur lors de la signature'))
      return false
    } finally {
      setIsSaving(false)
    }
  }, [])

  return { signedTypes, isLoading, loadError, sign, isSaving, signError }
}
