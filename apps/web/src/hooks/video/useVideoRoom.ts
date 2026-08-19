import { useCallback, useEffect, useState } from 'react'
import { closeRoom, fetchRoomInfo, joinRoom, recordAttendance } from '../../api/video'
import type { JoinRoomResult, VideoRoomInfo, VideoRoomStatus } from '../../types/video'
import { useAsyncData } from '../useAsyncData'
import { getErrorMessage, getErrorStatus } from '../../utils/apiError'

function pendingForever<T>(): Promise<T> {
  return new Promise<T>(() => {})
}

async function loadRoom(roomId: string | undefined): Promise<VideoRoomInfo> {
  if (!roomId) return pendingForever<VideoRoomInfo>()

  try {
    return await fetchRoomInfo(roomId)
  } catch (caughtError) {
    const status = getErrorStatus(caughtError)
    const message =
      status === 403
        ? "Vous n'êtes pas autorisé à rejoindre cette salle"
        : status === 404
          ? 'Salle introuvable'
          : 'Erreur lors du chargement de la salle'
    // Forme reconnue en priorité par getErrorMessage (response.data.message), pour reproduire
    // exactement les messages historiques de VideoPage selon le statut HTTP.
    throw { response: { data: { message } } }
  }
}

export interface UseVideoRoomResult {
  room: VideoRoomInfo | null
  isLoading: boolean
  loadError: string | null

  /** GET /video/rooms/:id/join puis enregistrement de présence non-bloquant. Retourne le token
   * LiveKit et l'URL de serveur en cas de succès, `null` sinon — monter l'appel intégré reste à
   * la charge de l'appelant. */
  join: () => Promise<JoinRoomResult | null>
  isJoining: boolean
  joinError: string | null

  attendanceRecorded: boolean
  /** Erreur d'enregistrement de présence — rendue visible (comportement non-bloquant volontaire :
   * elle n'empêche jamais `join` de rediriger, elle est simplement affichée au lieu d'être avalée). */
  attendanceError: string | null
  recordAttendanceNow: () => Promise<boolean>
  isRecordingAttendance: boolean

  close: () => Promise<boolean>
  isClosing: boolean
  closeError: string | null
}

/**
 * useVideoRoom — charge une salle vidéo (video-session-service) et expose les actions de
 * VideoPage : rejoindre (avec enregistrement de présence non-bloquant), enregistrer la présence
 * explicitement, et clôturer la session.
 *
 * `close` met à jour localement le statut de la salle (`ended`) sans recharger depuis le serveur,
 * pour reproduire le comportement optimiste préexistant.
 */
export function useVideoRoom(
  roomId: string | undefined,
  userId: string | undefined,
): UseVideoRoomResult {
  const { data, isLoading, error: loadError } = useAsyncData(() => loadRoom(roomId), [roomId])

  const [statusOverride, setStatusOverride] = useState<VideoRoomStatus | null>(null)

  const [attendanceRecorded, setAttendanceRecorded] = useState(false)
  const [attendanceError, setAttendanceError] = useState<string | null>(null)
  const [isRecordingAttendance, setIsRecordingAttendance] = useState(false)

  const [isJoining, setIsJoining] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)

  const [isClosing, setIsClosing] = useState(false)
  const [closeError, setCloseError] = useState<string | null>(null)

  useEffect(() => {
    setStatusOverride(null)
    setAttendanceRecorded(false)
    setAttendanceError(null)
  }, [roomId])

  const recordAttendanceNow = useCallback(async (): Promise<boolean> => {
    if (!roomId) return false
    setIsRecordingAttendance(true)
    setAttendanceError(null)
    try {
      await recordAttendance(roomId, { userId, joinedAt: new Date().toISOString() })
      setAttendanceRecorded(true)
      return true
    } catch (caughtError) {
      setAttendanceError(
        getErrorMessage(caughtError, "Erreur lors de l'enregistrement de la présence"),
      )
      return false
    } finally {
      setIsRecordingAttendance(false)
    }
  }, [roomId, userId])

  const join = useCallback(async (): Promise<JoinRoomResult | null> => {
    if (!roomId) return null
    setIsJoining(true)
    setJoinError(null)
    try {
      const result = await joinRoom(roomId)

      if (!attendanceRecorded) {
        try {
          await recordAttendance(roomId, { userId, joinedAt: new Date().toISOString() })
          setAttendanceRecorded(true)
        } catch (caughtError) {
          // Comportement non-bloquant volontaire : l'échec de l'enregistrement de présence ne
          // doit jamais empêcher de rejoindre la visio — l'erreur reste néanmoins visible via
          // attendanceError au lieu d'être avalée par un catch vide.
          setAttendanceError(
            getErrorMessage(caughtError, "Erreur lors de l'enregistrement de la présence"),
          )
        }
      }

      return result
    } catch (caughtError) {
      setJoinError(getErrorMessage(caughtError, 'Impossible de rejoindre la salle'))
      return null
    } finally {
      setIsJoining(false)
    }
  }, [roomId, userId, attendanceRecorded])

  const close = useCallback(async (): Promise<boolean> => {
    if (!roomId) return false
    setIsClosing(true)
    setCloseError(null)
    try {
      await closeRoom(roomId)
      setStatusOverride('ended')
      return true
    } catch (caughtError) {
      setCloseError(getErrorMessage(caughtError, 'Erreur lors de la clôture de la session'))
      return false
    } finally {
      setIsClosing(false)
    }
  }, [roomId])

  const room = data ? (statusOverride ? { ...data, status: statusOverride } : data) : null

  return {
    room,
    isLoading,
    loadError,
    join,
    isJoining,
    joinError,
    attendanceRecorded,
    attendanceError,
    recordAttendanceNow,
    isRecordingAttendance,
    close,
    isClosing,
    closeError,
  }
}
