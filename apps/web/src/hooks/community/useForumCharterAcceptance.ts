/**
 * useForumCharterAcceptance — statut d'acceptation de la charte de bonne conduite pour l'appelant
 * courant (`GET /forums/charter/acceptance`), global et valable pour tous les forums.
 *
 * Chargé au montage du composant qui l'utilise (l'écran de détail d'un forum), pas de
 * relecture automatique ailleurs — règle de chargement du 2026-08-10.
 */

import { useEffect, useState } from 'react'
import { acceptForumCharter, fetchForumCharterAcceptance } from '../../api/communityPath'
import { getErrorMessage } from '../../utils/apiError'

export interface UseForumCharterAcceptanceResult {
  isLoadingAcceptance: boolean
  hasAcceptedCharter: boolean
  acceptedAt: string | null
  loadError: string | null
  isAccepting: boolean
  acceptError: string | null
  acceptCharter: () => Promise<void>
}

export function useForumCharterAcceptance(): UseForumCharterAcceptanceResult {
  const [isLoadingAcceptance, setIsLoadingAcceptance] = useState(true)
  const [hasAcceptedCharter, setHasAcceptedCharter] = useState(false)
  const [acceptedAt, setAcceptedAt] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [isAccepting, setIsAccepting] = useState(false)
  const [acceptError, setAcceptError] = useState<string | null>(null)

  useEffect(() => {
    let isCancelled = false
    setIsLoadingAcceptance(true)

    fetchForumCharterAcceptance()
      .then((acceptance) => {
        if (isCancelled) return
        setHasAcceptedCharter(acceptance.accepted)
        setAcceptedAt(acceptance.acceptedAt)
      })
      .catch((caughtError: unknown) => {
        if (isCancelled) return
        setLoadError(getErrorMessage(caughtError, 'Impossible de lire votre statut d’acceptation.'))
      })
      .finally(() => {
        if (!isCancelled) setIsLoadingAcceptance(false)
      })

    return () => {
      isCancelled = true
    }
  }, [])

  const acceptCharter = async (): Promise<void> => {
    setIsAccepting(true)
    setAcceptError(null)

    try {
      const acceptance = await acceptForumCharter()
      setHasAcceptedCharter(acceptance.accepted)
      setAcceptedAt(acceptance.acceptedAt)
    } catch (caughtError: unknown) {
      setAcceptError(getErrorMessage(caughtError, "Impossible d'accepter la charte."))
    } finally {
      setIsAccepting(false)
    }
  }

  return {
    isLoadingAcceptance,
    hasAcceptedCharter,
    acceptedAt,
    loadError,
    isAccepting,
    acceptError,
    acceptCharter,
  }
}
