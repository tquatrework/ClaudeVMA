import { useCallback, useState } from 'react'
import {
  fetchTeacherValidationStatus,
  updateTeacherValidationStatus,
} from '../../api/teacherRequests'
import type { TeacherValidationStatus } from '../../types/profile'
import { useAsyncData } from '../useAsyncData'
import { getErrorMessage } from '../../utils/apiError'

function pendingForever<T>(): Promise<T> {
  return new Promise<T>(() => {})
}

/**
 * Reproduit le comportement préexistant de TeacherValidationPanel : si l'utilisateur
 * n'est pas autorisé (`enabled` = false), l'appel n'est jamais déclenché — le composant
 * renvoie de toute façon `null` dans ce cas, donc l'état de chargement n'est jamais
 * observé. Un échec de chargement reste non-bloquant (le statut reste `null`, aucune
 * erreur affichée), à l'image du `.catch(() => {})` d'origine.
 */
async function loadValidationStatus(
  teacherId: string,
  enabled: boolean,
): Promise<TeacherValidationStatus | null> {
  if (!enabled) return pendingForever<TeacherValidationStatus | null>()
  try {
    return await fetchTeacherValidationStatus(teacherId)
  } catch {
    return null
  }
}

export interface UseTeacherValidationResult {
  validationStatus: TeacherValidationStatus | null
  isLoadingStatus: boolean

  /** PATCH .../validation — passe en `in_review`. */
  takeCharge: () => Promise<boolean>
  isTakingCharge: boolean

  /** PATCH .../validation — passe en `validated`. */
  approve: () => Promise<boolean>

  /** PATCH .../validation — passe en `rejected` avec motif. */
  reject: (rejectionReason: string) => Promise<boolean>

  isSaving: boolean
  actionError: string | null
}

/**
 * useTeacherValidation — charge le statut de validation d'un formateur (RP/TI
 * uniquement) et expose les trois transitions de TeacherValidationPanel : prise en
 * charge, validation et rejet.
 */
export function useTeacherValidation(
  teacherId: string,
  canValidate: boolean,
): UseTeacherValidationResult {
  const { data, isLoading: isLoadingStatus } = useAsyncData(
    () => loadValidationStatus(teacherId, canValidate),
    [teacherId, canValidate],
  )

  const [statusOverride, setStatusOverride] = useState<TeacherValidationStatus | null>(null)

  const [isTakingCharge, setIsTakingCharge] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const takeCharge = useCallback(async (): Promise<boolean> => {
    setIsTakingCharge(true)
    setActionError(null)
    try {
      const updated = await updateTeacherValidationStatus(teacherId, {
        validationStatus: 'in_review',
      })
      setStatusOverride(updated)
      return true
    } catch (caughtError) {
      setActionError(getErrorMessage(caughtError, 'Erreur lors de la prise en charge'))
      return false
    } finally {
      setIsTakingCharge(false)
    }
  }, [teacherId])

  const approve = useCallback(async (): Promise<boolean> => {
    setIsSaving(true)
    setActionError(null)
    try {
      const updated = await updateTeacherValidationStatus(teacherId, {
        validationStatus: 'validated',
      })
      setStatusOverride(updated)
      return true
    } catch (caughtError) {
      setActionError(getErrorMessage(caughtError, 'Erreur lors de la validation'))
      return false
    } finally {
      setIsSaving(false)
    }
  }, [teacherId])

  const reject = useCallback(
    async (rejectionReason: string): Promise<boolean> => {
      setIsSaving(true)
      setActionError(null)
      try {
        const updated = await updateTeacherValidationStatus(teacherId, {
          validationStatus: 'rejected',
          rejectionReason,
        })
        setStatusOverride(updated)
        return true
      } catch (caughtError) {
        setActionError(getErrorMessage(caughtError, 'Erreur lors du rejet'))
        return false
      } finally {
        setIsSaving(false)
      }
    },
    [teacherId],
  )

  return {
    validationStatus: statusOverride ?? data ?? null,
    isLoadingStatus,
    takeCharge,
    isTakingCharge,
    approve,
    reject,
    isSaving,
    actionError,
  }
}
