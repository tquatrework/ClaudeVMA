import { useCallback, useState } from 'react'
import { fetchTeacherValidationStatus } from '../../api/profile'
import type { TeacherValidationRecord } from '../../types/profile'
import { useAsyncData } from '../useAsyncData'
import { useTeacherValidationActions } from './useTeacherValidationActions'

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
): Promise<TeacherValidationRecord | null> {
  if (!enabled) return pendingForever<TeacherValidationRecord | null>()
  try {
    return await fetchTeacherValidationStatus(teacherId)
  } catch {
    return null
  }
}

export interface UseTeacherValidationResult {
  validationRecord: TeacherValidationRecord | null
  isLoadingStatus: boolean

  /** PATCH .../validation — passe en `in_review`. */
  takeCharge: () => Promise<boolean>
  isTakingCharge: boolean

  /** PATCH .../validation — passe en `validated`. */
  approve: (comment?: string) => Promise<boolean>

  /** PATCH .../validation — passe en `rejected` avec motif. */
  reject: (comment?: string) => Promise<boolean>

  isSaving: boolean
  actionError: string | null
}

/**
 * useTeacherValidation — charge l'enregistrement de validation d'un formateur
 * (RP/TI uniquement) et expose les trois transitions de TeacherValidationPanel :
 * prise en charge, validation et refus.
 *
 * Les transitions elles-mêmes vivent dans `useTeacherValidationActions`, partagé
 * avec la file de validation du RP : deux écrans décident, un seul code de
 * décision.
 */
export function useTeacherValidation(
  teacherId: string,
  canValidate: boolean,
): UseTeacherValidationResult {
  const { data, isLoading: isLoadingStatus } = useAsyncData(
    () => loadValidationStatus(teacherId, canValidate),
    [teacherId, canValidate],
  )

  const [recordOverride, setRecordOverride] = useState<TeacherValidationRecord | null>(null)

  const handleUpdated = useCallback((updated: TeacherValidationRecord) => {
    setRecordOverride(updated)
  }, [])

  const { takeCharge, isTakingCharge, approve, reject, isSaving, actionError } =
    useTeacherValidationActions(teacherId, handleUpdated)

  return {
    validationRecord: recordOverride ?? data ?? null,
    isLoadingStatus,
    takeCharge,
    isTakingCharge,
    approve,
    reject,
    isSaving,
    actionError,
  }
}
