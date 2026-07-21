import { useCallback, useEffect, useState } from 'react'
import {
  deleteActivity,
  fetchActivity,
  updateActivity,
  type UpdateActivityPayload,
} from '../../api/calendar'
import { fetchSessionLogs } from '../../api/pedagogicalLog'
import type { PedagogicalLogPage } from '../../api/pedagogicalLog'
import { createRoom } from '../../api/video'
import type { VideoRoomInfo } from '../../types/video'
import type { ActivitySession } from '../../types/calendar'
import { getErrorStatus } from '../../utils/apiError'

export interface UseActivityDetailResult {
  activity: ActivitySession | null
  sessionLogs: PedagogicalLogPage[]
  isLoading: boolean
  error: string | null
  dismissError: () => void
  successMessage: string | null
  dismissSuccess: () => void

  saveEdit: (payload: UpdateActivityPayload) => Promise<boolean>
  isSaving: boolean

  remove: () => Promise<boolean>

  createVideoRoom: () => Promise<VideoRoomInfo | null>
  isCreatingRoom: boolean
}

function extractMessage(caughtError: unknown, fallback: string): string {
  return (
    (caughtError as { response?: { data?: { message?: string } } })?.response?.data?.message ??
    fallback
  )
}

/**
 * useActivityDetail — orchestration de ActivityDetailPage : chargement de l'activité et des
 * logs de séance associés (non bloquant), édition (titre/statut), suppression et création de
 * salle de visio. Les messages d'erreur reproduisent exactement le comportement préexistant
 * (mapping par statut HTTP propre à la page, distinct de `getErrorMessage`).
 */
export function useActivityDetail(activityId: string | undefined): UseActivityDetailResult {
  const [activity, setActivity] = useState<ActivitySession | null>(null)
  const [sessionLogs, setSessionLogs] = useState<PedagogicalLogPage[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isCreatingRoom, setIsCreatingRoom] = useState(false)

  useEffect(() => {
    if (!activityId) return
    let isIgnored = false

    setIsLoading(true)
    setError(null)

    fetchActivity(activityId)
      .then((data) => {
        if (isIgnored) return
        setActivity(data)

        return fetchSessionLogs(activityId)
          .then((logData) => {
            if (isIgnored) return
            setSessionLogs(logData)
          })
          .catch(() => {
            /* non-blocking */
          })
      })
      .catch((caughtError: unknown) => {
        if (isIgnored) return
        const status = getErrorStatus(caughtError)
        if (status === 403) setError('Accès refusé')
        else if (status === 404) setError('Activité introuvable')
        else setError('Erreur lors du chargement')
      })
      .finally(() => {
        if (isIgnored) return
        setIsLoading(false)
      })

    return () => {
      isIgnored = true
    }
  }, [activityId])

  const saveEdit = useCallback(
    async (payload: UpdateActivityPayload): Promise<boolean> => {
      if (!activityId) return false
      setIsSaving(true)
      setError(null)
      try {
        const updated = await updateActivity(activityId, payload)
        setActivity(updated)
        setSuccessMessage('Activité mise à jour')
        return true
      } catch (caughtError: unknown) {
        setError(extractMessage(caughtError, 'Erreur lors de la modification'))
        return false
      } finally {
        setIsSaving(false)
      }
    },
    [activityId],
  )

  const remove = useCallback(async (): Promise<boolean> => {
    if (!activityId) return false
    try {
      await deleteActivity(activityId)
      return true
    } catch (caughtError: unknown) {
      setError(extractMessage(caughtError, 'Erreur lors de la suppression'))
      return false
    }
  }, [activityId])

  const createVideoRoom = useCallback(async (): Promise<VideoRoomInfo | null> => {
    if (!activityId) return null
    setIsCreatingRoom(true)
    setError(null)
    try {
      const room = await createRoom({ activityId })
      setActivity((previous) => (previous ? { ...previous, videoRoomId: room.id } : previous))
      setSuccessMessage('Salle de visio créée')
      return room
    } catch (caughtError: unknown) {
      setError(extractMessage(caughtError, 'Erreur lors de la création de la salle'))
      return null
    } finally {
      setIsCreatingRoom(false)
    }
  }, [activityId])

  return {
    activity,
    sessionLogs,
    isLoading,
    error,
    dismissError: () => setError(null),
    successMessage,
    dismissSuccess: () => setSuccessMessage(null),
    saveEdit,
    isSaving,
    remove,
    createVideoRoom,
    isCreatingRoom,
  }
}
