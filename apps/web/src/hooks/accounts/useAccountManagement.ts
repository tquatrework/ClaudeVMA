import { useCallback, useState } from 'react'
import { changeAccountStatus, regenerateAccountAccess } from '../../api/accounts'
import type { AccountStatus } from '../../types/accounts'
import { getErrorMessage } from '../../utils/apiError'

export interface UseAccountManagementResult {
  changeStatus: (accountId: string, status: AccountStatus, reason: string) => Promise<boolean>
  isChangingStatus: boolean
  statusError: string | null
  regenerateAccess: (accountId: string, reason: string) => Promise<boolean>
  isRegeneratingAccess: boolean
  regenerateError: string | null
}

/**
 * useAccountManagement — actions réservées à la gestion administrative des comptes
 * (changement de statut, réactivation d'accès TI). Les deux actions sont
 * indépendantes (formulaires distincts sur AccountManagementPage) et exposent
 * chacune leur propre état loading/error.
 */
export function useAccountManagement(): UseAccountManagementResult {
  const [isChangingStatus, setIsChangingStatus] = useState(false)
  const [statusError, setStatusError] = useState<string | null>(null)
  const [isRegeneratingAccess, setIsRegeneratingAccess] = useState(false)
  const [regenerateError, setRegenerateError] = useState<string | null>(null)

  const changeStatus = useCallback(
    async (accountId: string, status: AccountStatus, reason: string) => {
      setStatusError(null)
      setIsChangingStatus(true)
      try {
        await changeAccountStatus(accountId, { status, reason })
        return true
      } catch (caughtError) {
        setStatusError(getErrorMessage(caughtError, 'Erreur lors du changement de statut'))
        return false
      } finally {
        setIsChangingStatus(false)
      }
    },
    [],
  )

  const regenerateAccess = useCallback(async (accountId: string, reason: string) => {
    setRegenerateError(null)
    setIsRegeneratingAccess(true)
    try {
      await regenerateAccountAccess(accountId, { reason })
      return true
    } catch (caughtError) {
      setRegenerateError(getErrorMessage(caughtError, "Erreur lors de la régénération de l'accès"))
      return false
    } finally {
      setIsRegeneratingAccess(false)
    }
  }, [])

  return {
    changeStatus,
    isChangingStatus,
    statusError,
    regenerateAccess,
    isRegeneratingAccess,
    regenerateError,
  }
}
