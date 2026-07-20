import { useCallback, useState } from 'react'
import { fetchRoomInfo, joinRoom } from '../../api/video'
import type { VideoRoomInfo } from '../../types/video'
import { useAsyncData } from '../useAsyncData'
import { getErrorMessage, getErrorStatus } from '../../utils/apiError'

function pendingForever<T>(): Promise<T> {
  return new Promise<T>(() => {})
}

async function loadRoom(roomId: string | undefined, skip: boolean): Promise<VideoRoomInfo> {
  if (!roomId || skip) return pendingForever<VideoRoomInfo>()

  try {
    return await fetchRoomInfo(roomId)
  } catch (caughtError) {
    const status = getErrorStatus(caughtError)
    const message =
      status === 403
        ? "Vous n'êtes pas autorisé à accéder à cette salle"
        : status === 404
          ? 'Salle introuvable'
          : 'Erreur lors du chargement de la salle'
    throw { response: { data: { message } } }
  }
}

export interface UseVideoJoinResult {
  room: VideoRoomInfo | null
  isLoading: boolean
  loadError: string | null

  /** GET /video/rooms/:id/join — retourne l'URL à ouvrir en cas de succès, `null` sinon. */
  join: () => Promise<string | null>
  isJoining: boolean
  joinError: string | null
}

/**
 * useVideoJoin — charge une salle vidéo et expose l'action de rejointe simple utilisée par
 * VideoJoinPage (sans enregistrement de présence, contrairement à useVideoRoom/VideoPage).
 *
 * `skip` reproduit le comportement préexistant pour parent_financeur (VID-FB-001) : aucun appel
 * réseau n'est déclenché — le chargement reste indéfiniment en attente (la page court-circuite
 * l'affichage avant que cet état ne soit visible).
 */
export function useVideoJoin(roomId: string | undefined, skip: boolean): UseVideoJoinResult {
  const { data, isLoading, error: loadError } = useAsyncData(
    () => loadRoom(roomId, skip),
    [roomId, skip],
  )

  const [isJoining, setIsJoining] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)

  const join = useCallback(async (): Promise<string | null> => {
    if (!roomId) return null
    setIsJoining(true)
    setJoinError(null)
    try {
      const { joinUrl } = await joinRoom(roomId)
      return joinUrl
    } catch (caughtError) {
      setJoinError(getErrorMessage(caughtError, 'Impossible de rejoindre la salle'))
      return null
    } finally {
      setIsJoining(false)
    }
  }, [roomId])

  return { room: data ?? null, isLoading, loadError, join, isJoining, joinError }
}
