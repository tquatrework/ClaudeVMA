import { useCallback, useState } from 'react'
import { createDelegation, fetchDelegations } from '../../api/communication'
import type { CreateDelegationPayload, Delegation } from '../../api/communication'
import { useAsyncData } from '../useAsyncData'

/**
 * Écart signalé (voir src/api/communication.ts) : /delegations n'est documenté dans
 * aucune section de docs/routes.md — comportement runtime préservé tel quel.
 *
 * Le chargement historique affiche toujours le même message d'erreur, quel que soit le
 * statut HTTP — enveloppé pour que `useAsyncData` restitue ce message tel quel.
 */
async function loadDelegations(): Promise<Delegation[]> {
  try {
    const result = await fetchDelegations()
    return Array.isArray(result) ? result : result.data
  } catch {
    throw { response: { data: { message: 'Impossible de charger les délégations' } } }
  }
}

export interface UseDelegationsResult {
  delegations: Delegation[]
  isLoading: boolean
  error: string | null

  /** POST /delegations */
  createDelegation: (payload: CreateDelegationPayload) => Promise<boolean>
  isCreating: boolean
  createError: string | null
  createSuccessMessage: string | null
  /** Efface message de succès/erreur de création (ex. à la réouverture du formulaire). */
  resetCreateFeedback: () => void
}

/**
 * useDelegations — liste des délégations et création d'une demande de délégation, pour
 * DelegationsPage.
 */
export function useDelegations(): UseDelegationsResult {
  const { data, isLoading, error, refetch } = useAsyncData(loadDelegations, [], {
    fallbackErrorMessage: 'Impossible de charger les délégations',
  })

  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [createSuccessMessage, setCreateSuccessMessage] = useState<string | null>(null)

  const create = useCallback(
    async (payload: CreateDelegationPayload): Promise<boolean> => {
      setIsCreating(true)
      setCreateError(null)
      setCreateSuccessMessage(null)
      try {
        await createDelegation(payload)
        setCreateSuccessMessage('Demande de délégation créée avec succès.')
        refetch()
        return true
      } catch (caughtError: unknown) {
        const message =
          (caughtError as { response?: { data?: { message?: string } } })?.response?.data
            ?.message ?? 'Erreur lors de la création de la délégation'
        setCreateError(message)
        return false
      } finally {
        setIsCreating(false)
      }
    },
    [refetch],
  )

  const resetCreateFeedback = useCallback(() => {
    setCreateError(null)
    setCreateSuccessMessage(null)
  }, [])

  return {
    delegations: data ?? [],
    isLoading,
    error,
    createDelegation: create,
    isCreating,
    createError,
    createSuccessMessage,
    resetCreateFeedback,
  }
}
