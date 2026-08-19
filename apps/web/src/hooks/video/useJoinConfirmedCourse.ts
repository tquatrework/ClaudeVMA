import { useCallback, useState } from 'react'
import { fetchRoomByActivity } from '../../api/video'
import { getErrorMessage, getErrorStatus } from '../../utils/apiError'

export interface UseJoinConfirmedCourseResult {
  /** GET /video/rooms/by-activity/:activityId — résout l'id de salle à partir d'une activité
   * `cours` confirmée. Retourne `null` en cas d'échec (voir `resolveError`), navigation laissée
   * à l'appelant. */
  resolveRoomId: (activityId: string) => Promise<string | null>
  isResolving: boolean
  resolveError: string | null
  clearResolveError: () => void
}

/**
 * useJoinConfirmedCourse — résout la salle vidéo créée automatiquement pour un cours confirmé
 * (chantier calendrier-visio-livekit, point 2), depuis un bloc de la grille de calendrier
 * (`ActivityGridBlockOverlay`). N'affiche jamais l'`activityId` ni l'id de salle bruts : seul un
 * message d'état est exposé à l'appelant.
 */
export function useJoinConfirmedCourse(): UseJoinConfirmedCourseResult {
  const [isResolving, setIsResolving] = useState(false)
  const [resolveError, setResolveError] = useState<string | null>(null)

  const resolveRoomId = useCallback(async (activityId: string): Promise<string | null> => {
    setIsResolving(true)
    setResolveError(null)
    try {
      const room = await fetchRoomByActivity(activityId)
      return room.id
    } catch (caughtError) {
      const status = getErrorStatus(caughtError)
      setResolveError(
        status === 404
          ? "La salle de ce cours n'est pas encore disponible. Réessayez un peu plus tard."
          : getErrorMessage(caughtError, 'Impossible de rejoindre ce cours pour le moment.'),
      )
      return null
    } finally {
      setIsResolving(false)
    }
  }, [])

  const clearResolveError = useCallback(() => setResolveError(null), [])

  return { resolveRoomId, isResolving, resolveError, clearResolveError }
}
