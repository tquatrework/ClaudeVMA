import { useCallback, useState } from 'react'
import { createActivity } from '../../api/calendar'
import type { CreateActivityPayload, ScheduledActivity } from '../../types/calendar'
import { getErrorMessage } from '../../utils/apiError'

export interface UseProposeCourseSlotResult {
  isSubmitting: boolean
  errorMessage: string | null
  clearError: () => void
  /** `POST /activities` — retourne l'activité créée (`status: "proposed"`), ou `null` en échec. */
  submit: (payload: CreateActivityPayload) => Promise<ScheduledActivity | null>
}

const FALLBACK_ERROR_MESSAGE = "Impossible d'envoyer cette proposition de créneau."

/**
 * useProposeCourseSlot — orchestration de `ProposeCourseSlotDialog` : soumission de
 * `POST /activities`. Un `403` signifie qu'aucun lien réel n'ouvre ce destinataire
 * (`TEACHER_OF_STUDENT`/`ANIMATOR_OF_TEACHER`, vérifié côté serveur) — traduit en français
 * générique par `getErrorMessage`, jamais affiché en jargon technique.
 */
export function useProposeCourseSlot(): UseProposeCourseSlotResult {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const submit = useCallback(
    async (payload: CreateActivityPayload): Promise<ScheduledActivity | null> => {
      setIsSubmitting(true)
      setErrorMessage(null)
      try {
        return await createActivity(payload)
      } catch (caughtError: unknown) {
        setErrorMessage(getErrorMessage(caughtError, FALLBACK_ERROR_MESSAGE))
        return null
      } finally {
        setIsSubmitting(false)
      }
    },
    [],
  )

  return {
    isSubmitting,
    errorMessage,
    clearError: useCallback(() => setErrorMessage(null), []),
    submit,
  }
}
