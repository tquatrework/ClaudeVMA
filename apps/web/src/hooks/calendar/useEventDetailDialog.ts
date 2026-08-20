import { useCallback, useState } from 'react'
import type { CalendarEvent } from '../../components/calendar/calendarTypes'

interface UseEventDetailDialogParams {
  respondToEventInvitation: (eventId: string, action: 'accept' | 'decline') => Promise<boolean>
  deleteEvent: (eventId: string) => Promise<boolean>
  clearInvitationRespondError: () => void
  clearDeleteError: () => void
}

export interface UseEventDetailDialogResult {
  selectedEvent: CalendarEvent | null
  openEventDetail: (event: CalendarEvent) => void
  closeEventDetail: () => void
  handleRespondToInvitation: (eventId: string, action: 'accept' | 'decline') => Promise<void>
  handleDeleteEvent: (eventId: string) => Promise<void>
}

/**
 * useEventDetailDialog — orchestration de l'ouverture/fermeture de `EventDetailDialog` depuis
 * `CalendarUnifiedView`, et des deux actions qui doivent la refermer **uniquement en cas de
 * succès** (Accepter/Refuser une invitation, Supprimer l'événement — chantier "invitation
 * d'événement invisible pour l'invité", 2026-08-20 : un invité ne voyait jamais l'événement
 * auquel il était convié). Extrait pour garder `CalendarUnifiedView.tsx` sous la limite de taille
 * de fichier (convention `src/CLAUDE.md`).
 *
 * Ne possède ni `events` ni les appels réseau — reçus depuis `useCalendarEvents`, seul
 * propriétaire de cet état (règle du 2026-08-10 : une donnée de page appartient à la page).
 */
export function useEventDetailDialog({
  respondToEventInvitation,
  deleteEvent,
  clearInvitationRespondError,
  clearDeleteError,
}: UseEventDetailDialogParams): UseEventDetailDialogResult {
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)

  const openEventDetail = useCallback(
    (event: CalendarEvent) => {
      clearInvitationRespondError()
      clearDeleteError()
      setSelectedEvent(event)
    },
    [clearInvitationRespondError, clearDeleteError],
  )

  const closeEventDetail = useCallback(() => setSelectedEvent(null), [])

  const handleRespondToInvitation = useCallback(
    async (eventId: string, action: 'accept' | 'decline') => {
      const isSuccess = await respondToEventInvitation(eventId, action)
      if (isSuccess) setSelectedEvent(null)
    },
    [respondToEventInvitation],
  )

  const handleDeleteEvent = useCallback(
    async (eventId: string) => {
      const isSuccess = await deleteEvent(eventId)
      if (isSuccess) setSelectedEvent(null)
    },
    [deleteEvent],
  )

  return { selectedEvent, openEventDetail, closeEventDetail, handleRespondToInvitation, handleDeleteEvent }
}
