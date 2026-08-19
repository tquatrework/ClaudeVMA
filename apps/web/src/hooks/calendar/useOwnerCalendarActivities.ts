import { useCallback, useState } from 'react'
import { acceptActivity, declineActivity, fetchOwnerCalendarActivities } from '../../api/calendar'
import type { CalendarActivityEntry } from '../../types/calendar'
import { useAsyncData } from '../useAsyncData'
import { getErrorMessage, getErrorStatus } from '../../utils/apiError'

export interface UseOwnerCalendarActivitiesResult {
  activities: CalendarActivityEntry[]
  isLoading: boolean
  loadError: string | null
  refetch: () => void

  /** `activityId` de l'activité en cours de traitement, ou `null`. Désactive ses boutons. */
  respondingActivityId: string | null
  respondError: string | null
  clearRespondError: () => void
  respondToActivity: (activityId: string, action: 'accept' | 'decline') => Promise<void>
}

const LOAD_FALLBACK_MESSAGE = 'Impossible de charger les activités du calendrier.'
const RESPOND_FALLBACK_MESSAGE = "Votre réponse n'a pas pu être enregistrée."
const CONFLICT_MESSAGE =
  'Cette proposition a déjà été traitée (par vous ou depuis un autre appareil). La liste a été actualisée.'

/**
 * useOwnerCalendarActivities — hook d'orchestration par page pour l'affichage inline des
 * propositions/confirmations de créneau de cours dans `AvailabilityGrid` (chantier calendrier de
 * disponibilités, point 3, `GET /calendars/:ownerId` → champ `activities`).
 *
 * Après une réponse réussie, l'état local est mis à jour à partir de la **réponse réelle du
 * serveur** (jamais un état optimiste) : `accept` fait passer le statut local à `confirmed`
 * (rendu par `AvailabilityGrid` en bloc `CONFIRMED`, sans action) ; `decline` retire l'activité de
 * la liste (le serveur ne renvoie plus une activité `cancelled` dans `activities` — même filtre
 * que côté serveur).
 *
 * `409` (déjà traitée par un autre onglet/session) : message explicite, puis rafraîchissement
 * complet de la liste plutôt qu'une correction locale supposée.
 */
export function useOwnerCalendarActivities(
  ownerId: string | undefined,
): UseOwnerCalendarActivitiesResult {
  const { data, isLoading, error: loadError, refetch } = useAsyncData(
    () => (ownerId ? fetchOwnerCalendarActivities(ownerId) : Promise.resolve([])),
    [ownerId],
    { fallbackErrorMessage: LOAD_FALLBACK_MESSAGE },
  )

  const [activitiesOverride, setActivitiesOverride] = useState<CalendarActivityEntry[] | null>(
    null,
  )
  const [respondingActivityId, setRespondingActivityId] = useState<string | null>(null)
  const [respondError, setRespondError] = useState<string | null>(null)

  const currentActivities = activitiesOverride ?? data ?? []

  const respondToActivity = useCallback(
    async (activityId: string, action: 'accept' | 'decline') => {
      setRespondingActivityId(activityId)
      setRespondError(null)
      try {
        if (action === 'accept') {
          await acceptActivity(activityId)
          setActivitiesOverride((previous) =>
            (previous ?? data ?? []).map((entry) =>
              entry.id === activityId ? { ...entry, status: 'confirmed' } : entry,
            ),
          )
        } else {
          await declineActivity(activityId)
          setActivitiesOverride((previous) =>
            (previous ?? data ?? []).filter((entry) => entry.id !== activityId),
          )
        }
      } catch (caughtError: unknown) {
        if (getErrorStatus(caughtError) === 409) {
          setRespondError(CONFLICT_MESSAGE)
          refetch()
        } else {
          setRespondError(getErrorMessage(caughtError, RESPOND_FALLBACK_MESSAGE))
        }
      } finally {
        setRespondingActivityId(null)
      }
    },
    [data, refetch],
  )

  return {
    activities: currentActivities,
    isLoading,
    loadError,
    refetch,
    respondingActivityId,
    respondError,
    clearRespondError: useCallback(() => setRespondError(null), []),
    respondToActivity,
  }
}
