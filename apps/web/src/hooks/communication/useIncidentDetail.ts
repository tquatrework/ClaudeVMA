import { useCallback, useState } from 'react'
import { fetchIncident, updateIncidentStatus } from '../../api/communication'
import type { Incident, IncidentStatus } from '../../api/communication'
import { useAsyncData } from '../useAsyncData'
import { getErrorStatus } from '../../utils/apiError'

function pendingForever<T>(): Promise<T> {
  return new Promise<T>(() => {})
}

/**
 * Reproduit le mapping historique de IncidentDetailPage : 403 → "Accès refusé", 404 →
 * "Incident introuvable", sinon message générique.
 */
async function loadIncident(incidentId: string | undefined): Promise<Incident> {
  if (!incidentId) return pendingForever<Incident>()

  try {
    return await fetchIncident(incidentId)
  } catch (caughtError) {
    const status = getErrorStatus(caughtError)
    const message =
      status === 403
        ? 'Accès refusé'
        : status === 404
          ? 'Incident introuvable'
          : 'Erreur lors du chargement'
    throw { response: { data: { message } } }
  }
}

export interface UseIncidentDetailResult {
  incident: Incident | null
  isLoading: boolean
  loadError: string | null

  /** PUT /incidents/:id/status */
  updateStatus: (newStatus: IncidentStatus) => Promise<boolean>
  isUpdating: boolean
  updateError: string | null
  successMessage: string | null
}

/**
 * useIncidentDetail — charge le détail d'un incident et expose le changement de statut
 * (TI, RP) pour IncidentDetailPage.
 */
export function useIncidentDetail(incidentId: string | undefined): UseIncidentDetailResult {
  const {
    data,
    isLoading,
    error: loadError,
  } = useAsyncData(() => loadIncident(incidentId), [incidentId], {
    fallbackErrorMessage: 'Erreur lors du chargement',
  })

  const [incidentOverride, setIncidentOverride] = useState<Incident | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)
  const [updateError, setUpdateError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const updateStatus = useCallback(
    async (newStatus: IncidentStatus): Promise<boolean> => {
      if (!incidentId) return false
      setIsUpdating(true)
      setUpdateError(null)
      setSuccessMessage(null)
      try {
        const updated = await updateIncidentStatus(incidentId, { status: newStatus })
        setIncidentOverride(updated)
        setSuccessMessage('Statut mis à jour')
        return true
      } catch (caughtError: unknown) {
        const message =
          (caughtError as { response?: { data?: { message?: string } } })?.response?.data
            ?.message ?? 'Erreur lors de la mise à jour du statut'
        setUpdateError(message)
        return false
      } finally {
        setIsUpdating(false)
      }
    },
    [incidentId],
  )

  return {
    incident: incidentOverride ?? data ?? null,
    isLoading,
    loadError,
    updateStatus,
    isUpdating,
    updateError,
    successMessage,
  }
}
