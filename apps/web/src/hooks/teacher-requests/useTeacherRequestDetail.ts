import { useCallback, useEffect, useState } from 'react'
import {
  deleteTeacherRequest,
  fetchTeacherRequest,
  updateTeacherRequestStatus,
} from '../../api/teacherRequests'
import type { TeacherRequestDetail } from '../../types/teacherRequests'
import type { TeacherCandidate } from '../../components/teacher-requests/TeacherCandidatesView'
import { useAsyncData } from '../useAsyncData'
import { getErrorMessage, getErrorStatus } from '../../utils/apiError'

function pendingForever<T>(): Promise<T> {
  return new Promise<T>(() => {})
}

async function loadTeacherRequestDetail(
  requestId: string | undefined,
): Promise<TeacherRequestDetail> {
  if (!requestId) return pendingForever<TeacherRequestDetail>()

  try {
    return await fetchTeacherRequest(requestId)
  } catch (caughtError) {
    const status = getErrorStatus(caughtError)
    const message =
      status === 403
        ? 'Accès refusé'
        : status === 404
          ? 'Demande introuvable'
          : 'Erreur lors du chargement'
    // Forme reconnue en priorité par getErrorMessage (response.data.message), pour reproduire
    // exactement les messages historiques de TeacherRequestDetailPage selon le statut HTTP.
    throw { response: { data: { message } } }
  }
}

export interface UseTeacherRequestDetailResult {
  request: TeacherRequestDetail | null
  isLoading: boolean
  loadError: string | null

  /** Candidats affichés par TeacherCandidatesView — initialisés depuis le chargement puis
   * remplacés localement par ce composant via `setCandidates` (pas de rechargement réseau). */
  candidates: TeacherCandidate[]
  setCandidates: (candidates: TeacherCandidate[]) => void

  /** PATCH /teacher-requests/:id/status — remplace intégralement la demande affichée. */
  updateStatus: (newStatus: string) => Promise<TeacherRequestDetail | null>
  isUpdatingStatus: boolean
  statusError: string | null

  /** Reflète localement un changement de statut décidé par TeacherCandidatesView (sélection
   * d'un candidat par le client), sans appel réseau ni rechargement — reproduit l'ancien
   * `setRequest((previous) => previous ? { ...previous, status: newStatus } : previous)`. */
  overrideStatus: (newStatus: string) => void

  /** DELETE /teacher-requests/:id */
  deleteRequest: () => Promise<boolean>
  deleteError: string | null
}

/**
 * useTeacherRequestDetail — charge le détail d'une demande professeur et expose le
 * changement de statut (RP, annulation client) et la suppression pour
 * TeacherRequestDetailPage.
 *
 * `updateStatus` remplace intégralement la demande affichée par la réponse serveur
 * (comme le faisait l'ancien `setRequest(data)`), sans jamais réinitialiser
 * `candidates` — ce tableau reste sous le contrôle exclusif de TeacherCandidatesView
 * (composant hors périmètre de cette migration, toujours branché sur `apiClient`),
 * à l'image du comportement préexistant.
 */
export function useTeacherRequestDetail(
  requestId: string | undefined,
): UseTeacherRequestDetailResult {
  const { data, isLoading, error: loadError } = useAsyncData(
    () => loadTeacherRequestDetail(requestId),
    [requestId],
  )

  const [detailOverride, setDetailOverride] = useState<TeacherRequestDetail | null>(null)
  const [candidatesOverride, setCandidatesOverride] = useState<TeacherCandidate[] | null>(null)

  useEffect(() => {
    setDetailOverride(null)
    setCandidatesOverride(null)
  }, [requestId])

  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)
  const [statusError, setStatusError] = useState<string | null>(null)

  const updateStatus = useCallback(
    async (newStatus: string): Promise<TeacherRequestDetail | null> => {
      if (!requestId) return null
      setIsUpdatingStatus(true)
      setStatusError(null)
      try {
        const updated = await updateTeacherRequestStatus(requestId, { status: newStatus })
        setDetailOverride(updated)
        return updated
      } catch (caughtError) {
        setStatusError(getErrorMessage(caughtError, 'Erreur lors de la mise à jour'))
        return null
      } finally {
        setIsUpdatingStatus(false)
      }
    },
    [requestId],
  )

  const overrideStatus = useCallback(
    (newStatus: string) => {
      setDetailOverride((previous) => {
        const base = previous ?? data
        return base ? { ...base, status: newStatus } : previous
      })
    },
    [data],
  )

  const [deleteError, setDeleteError] = useState<string | null>(null)

  const deleteRequest = useCallback(async (): Promise<boolean> => {
    if (!requestId) return false
    try {
      await deleteTeacherRequest(requestId)
      return true
    } catch (caughtError) {
      setDeleteError(getErrorMessage(caughtError, 'Erreur lors de la suppression'))
      return false
    }
  }, [requestId])

  const request = data ? (detailOverride ?? data) : null
  const candidates = candidatesOverride ?? data?.candidates ?? []

  return {
    request,
    isLoading,
    loadError,
    candidates,
    setCandidates: setCandidatesOverride,
    updateStatus,
    isUpdatingStatus,
    statusError,
    overrideStatus,
    deleteRequest,
    deleteError,
  }
}
