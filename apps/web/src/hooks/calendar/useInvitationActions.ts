import { useCallback, useState } from 'react'
import { acceptEventInvitation, declineEventInvitation } from '../../api/calendar'
import type { InviteeStatus } from '../../components/calendar/calendarTypes'
import { getErrorMessage } from '../../utils/apiError'

export interface UseInvitationActionsResult {
  processingIds: Set<string>
  actionErrors: Record<string, string>
  handleAccept: (eventId: string) => Promise<void>
  handleDecline: (eventId: string) => Promise<void>
}

/**
 * useInvitationActions — orchestration de InvitationBanner : accepter/refuser une invitation.
 * La gestion d'erreur (non bloquante, via `getErrorMessage`) a déjà été corrigée au lot 9 —
 * reproduite ici à l'identique ; seule la couche transport change (passe désormais par
 * src/api/calendar au lieu d'apiClient directement).
 */
export function useInvitationActions(
  userId: string,
  onStatusChange: (eventId: string, newStatus: InviteeStatus) => void,
): UseInvitationActionsResult {
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set())
  const [actionErrors, setActionErrors] = useState<Record<string, string>>({})

  const runAction = useCallback(
    async (
      eventId: string,
      action: (eventId: string, userId: string) => Promise<void>,
      newStatus: InviteeStatus,
      fallbackMessage: string,
    ) => {
      setProcessingIds((prev) => new Set(prev).add(eventId))
      setActionErrors((prev) => {
        const { [eventId]: _removed, ...rest } = prev
        return rest
      })
      try {
        await action(eventId, userId)
        onStatusChange(eventId, newStatus)
      } catch (error: unknown) {
        // Non-bloquant — l'utilisateur peut réessayer, l'échec est juste rendu visible.
        setActionErrors((prev) => ({
          ...prev,
          [eventId]: getErrorMessage(error, fallbackMessage),
        }))
      } finally {
        setProcessingIds((prev) => {
          const updated = new Set(prev)
          updated.delete(eventId)
          return updated
        })
      }
    },
    [userId, onStatusChange],
  )

  const handleAccept = useCallback(
    (eventId: string) =>
      runAction(eventId, acceptEventInvitation, 'accepted', "Impossible d'accepter l'invitation."),
    [runAction],
  )

  const handleDecline = useCallback(
    (eventId: string) =>
      runAction(eventId, declineEventInvitation, 'declined', "Impossible de refuser l'invitation."),
    [runAction],
  )

  return { processingIds, actionErrors, handleAccept, handleDecline }
}
