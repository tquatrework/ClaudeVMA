/**
 * useTeacherValidationActions — les trois transitions de validation d'un
 * formateur, sans aucune lecture.
 *
 * Extrait de `useTeacherValidation` pour être partagé par les deux écrans qui
 * décident : la fiche d'un formateur (`TeacherValidationPanel`) et la file de
 * validation du RP (`TeacherValidationQueuePage`). La file ne peut pas réutiliser
 * `useTeacherValidation` tel quel : celui-ci charge le statut par un `GET`, ce qui
 * ferait un appel par ligne alors que la liste porte déjà l'information.
 *
 * L'enregistrement renvoyé par le serveur **remonte** à l'appelant via
 * `onUpdated` : c'est lui qui détient la donnée, pas ce hook (arbitrage du
 * 2026-08-10). On réaffiche la réponse reçue, jamais le corps envoyé.
 */

import { useCallback, useState } from 'react'
import { updateTeacherValidationStatus } from '../../api/profile'
import type { TeacherValidationRecord } from '../../types/profile'
import { getErrorMessage } from '../../utils/apiError'

export interface UseTeacherValidationActionsResult {
  /** `pending` → `in_review`. Le RP prend le dossier en charge. */
  takeCharge: () => Promise<boolean>
  isTakingCharge: boolean

  /** `in_review` → `validated`, commentaire d'instruction optionnel. */
  approve: (comment?: string) => Promise<boolean>

  /** `in_review` → `rejected`, motif optionnel côté serveur. */
  reject: (comment?: string) => Promise<boolean>

  isSaving: boolean
  /** Message du serveur, déjà en français — jamais remplacé par un générique. */
  actionError: string | null
  clearActionError: () => void
}

export function useTeacherValidationActions(
  teacherId: string,
  onUpdated?: (record: TeacherValidationRecord) => void,
): UseTeacherValidationActionsResult {
  const [isTakingCharge, setIsTakingCharge] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const clearActionError = useCallback(() => setActionError(null), [])

  const runTransition = useCallback(
    async (
      payload: Parameters<typeof updateTeacherValidationStatus>[1],
      fallbackErrorMessage: string,
      setBusy: (isBusy: boolean) => void,
    ): Promise<boolean> => {
      setBusy(true)
      setActionError(null)
      try {
        const updated = await updateTeacherValidationStatus(teacherId, payload)
        onUpdated?.(updated)
        return true
      } catch (caughtError) {
        setActionError(getErrorMessage(caughtError, fallbackErrorMessage))
        return false
      } finally {
        setBusy(false)
      }
    },
    [teacherId, onUpdated],
  )

  const takeCharge = useCallback(
    () =>
      runTransition(
        { status: 'in_review' },
        'Erreur lors de la prise en charge',
        setIsTakingCharge,
      ),
    [runTransition],
  )

  const approve = useCallback(
    (comment?: string) =>
      runTransition(
        { status: 'validated', ...(comment ? { comment } : {}) },
        'Erreur lors de la validation',
        setIsSaving,
      ),
    [runTransition],
  )

  const reject = useCallback(
    (comment?: string) =>
      runTransition(
        { status: 'rejected', ...(comment ? { comment } : {}) },
        'Erreur lors du refus',
        setIsSaving,
      ),
    [runTransition],
  )

  return {
    takeCharge,
    isTakingCharge,
    approve,
    reject,
    isSaving,
    actionError,
    clearActionError,
  }
}
