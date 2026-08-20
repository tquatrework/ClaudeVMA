import { useCallback, useState } from 'react'
import { createOwnerEvent, type CreateOwnerEventPayload } from '../../api/calendar'
import type { CalendarEvent } from '../../components/calendar/calendarTypes'

export interface UseEventCreateResult {
  isSaving: boolean
  errorMessage: string | null
  submit: (payload: CreateOwnerEventPayload) => Promise<CalendarEvent | null>
}

function extractMessage(caughtError: unknown, fallback: string): string {
  return (
    (caughtError as { response?: { data?: { message?: string } } })?.response?.data?.message ??
    fallback
  )
}

/**
 * useEventCreate — soumission de la création d'un événement de calendrier
 * (`POST /calendars/:ownerId/events`). Utilisé par `QuickEventCreatePopover` (chantier calendrier
 * vue unifiée, point 3 — création par clic direct sur la grille, plus jamais par un couple de
 * champs `datetime-local` saisis à la main). Message d'erreur backend brut si disponible, sinon
 * message générique — sans passer par `getErrorMessage`.
 */
export function useEventCreate(ownerId: string): UseEventCreateResult {
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const submit = useCallback(
    async (payload: CreateOwnerEventPayload): Promise<CalendarEvent | null> => {
      setIsSaving(true)
      setErrorMessage(null)
      try {
        return await createOwnerEvent(ownerId, payload)
      } catch (caughtError: unknown) {
        setErrorMessage(extractMessage(caughtError, "Erreur lors de la création de l'événement"))
        return null
      } finally {
        setIsSaving(false)
      }
    },
    [ownerId],
  )

  return { isSaving, errorMessage, submit }
}
