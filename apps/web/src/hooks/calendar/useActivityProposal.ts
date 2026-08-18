import { useCallback, useState } from 'react'
import { acceptActivity, declineActivity, fetchScheduledActivity } from '../../api/calendar'
import type { ScheduledActivity } from '../../types/calendar'
import { getErrorMessage } from '../../utils/apiError'
import { useAsyncData } from '../useAsyncData'

export interface UseActivityProposalResult {
  activity: ScheduledActivity | null
  isLoading: boolean
  loadError: string | null
  refetch: () => void

  respond: (action: 'accept' | 'decline') => Promise<void>
  isResponding: boolean
  respondError: string | null
  clearRespondError: () => void
}

const LOAD_FALLBACK_MESSAGE = 'Impossible de charger cette proposition de créneau.'
const RESPOND_FALLBACK_MESSAGE = "Votre réponse n'a pas pu être enregistrée."

/**
 * useActivityProposal — orchestration de `CalendarProposalPage` (`/calendar/proposals/:id`),
 * vue asymétrique proposeur/destinataire d'une même activité (`GET /activities/:activityId`).
 *
 * Jamais d'état optimiste : `respond` réaffiche la réponse du serveur
 * (`POST /activities/:activityId/accept|decline`, corps complet de l'activité mise à jour),
 * elle ne bascule jamais un statut localement avant confirmation.
 */
export function useActivityProposal(activityId: string | undefined): UseActivityProposalResult {
  const { data, isLoading, error: loadError, refetch } = useAsyncData(
    () => (activityId ? fetchScheduledActivity(activityId) : Promise.resolve(null)),
    [activityId],
    { fallbackErrorMessage: LOAD_FALLBACK_MESSAGE },
  )

  const [respondedActivity, setRespondedActivity] = useState<ScheduledActivity | null>(null)
  const [isResponding, setIsResponding] = useState(false)
  const [respondError, setRespondError] = useState<string | null>(null)

  const respond = useCallback(
    async (action: 'accept' | 'decline') => {
      if (!activityId) return
      setIsResponding(true)
      setRespondError(null)
      try {
        const updated =
          action === 'accept' ? await acceptActivity(activityId) : await declineActivity(activityId)
        setRespondedActivity(updated)
      } catch (caughtError: unknown) {
        setRespondError(getErrorMessage(caughtError, RESPOND_FALLBACK_MESSAGE))
      } finally {
        setIsResponding(false)
      }
    },
    [activityId],
  )

  return {
    activity: respondedActivity ?? data ?? null,
    isLoading,
    loadError,
    refetch,
    respond,
    isResponding,
    respondError,
    clearRespondError: useCallback(() => setRespondError(null), []),
  }
}
