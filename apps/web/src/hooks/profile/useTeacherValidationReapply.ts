/**
 * useTeacherValidationReapply — relance en self-service d'une candidature
 * formateur refusée, via `POST /profiles/:teacherId/validation/reapply`
 * (arbitrage du 2026-08-13, `docs/architecture.md` > « Reprise de candidature
 * après un refus formateur »).
 *
 * Même forme que `useTeacherValidationActions` : l'enregistrement renvoyé par
 * le serveur remonte à l'appelant via `onReapplied`, jamais rechargé par une
 * seconde requête (règle du 2026-08-10).
 */

import { useCallback, useState } from 'react'
import { reapplyTeacherValidation } from '../../api/profile'
import type { TeacherValidationRecord } from '../../types/profile'
import { getErrorMessage } from '../../utils/apiError'

export interface UseTeacherValidationReapplyResult {
  reapply: () => Promise<boolean>
  isReapplying: boolean
  /** Message du serveur, déjà en français — jamais remplacé par un générique. */
  reapplyError: string | null
  clearReapplyError: () => void
}

export function useTeacherValidationReapply(
  teacherId: string | undefined,
  onReapplied?: (record: TeacherValidationRecord) => void,
): UseTeacherValidationReapplyResult {
  const [isReapplying, setIsReapplying] = useState(false)
  const [reapplyError, setReapplyError] = useState<string | null>(null)

  const clearReapplyError = useCallback(() => setReapplyError(null), [])

  const reapply = useCallback(async (): Promise<boolean> => {
    if (!teacherId) return false
    setIsReapplying(true)
    setReapplyError(null)
    try {
      const updated = await reapplyTeacherValidation(teacherId)
      onReapplied?.(updated)
      return true
    } catch (caughtError) {
      setReapplyError(getErrorMessage(caughtError, 'Erreur lors de la relance de candidature'))
      return false
    } finally {
      setIsReapplying(false)
    }
  }, [teacherId, onReapplied])

  return { reapply, isReapplying, reapplyError, clearReapplyError }
}
