import { useCallback, useState } from 'react'
import { createIncident, fetchIncidents } from '../../api/communication'
import type { CreateIncidentPayload, Incident } from '../../api/communication'
import { useAsyncData } from '../useAsyncData'
import { getErrorStatus } from '../../utils/apiError'

/**
 * Reproduit le mapping historique de IncidentsPage : 403 → "Accès refusé", sinon message
 * générique — enveloppé pour que `useAsyncData`/`getErrorMessage` restitue ce message
 * précis quel que soit le statut par ailleurs.
 */
async function loadIncidents(): Promise<Incident[]> {
  try {
    return await fetchIncidents()
  } catch (caughtError) {
    const status = getErrorStatus(caughtError)
    const message = status === 403 ? 'Accès refusé' : 'Impossible de charger les incidents'
    throw { response: { data: { message } } }
  }
}

export interface UseIncidentsResult {
  incidents: Incident[]
  isLoading: boolean
  error: string | null

  createIncident: (payload: CreateIncidentPayload) => Promise<Incident | null>
  isSaving: boolean
  createError: string | null
}

/**
 * useIncidents — liste des incidents (filtrée côté serveur par rôle) et déclaration
 * d'un nouvel incident, pour IncidentsPage.
 */
export function useIncidents(): UseIncidentsResult {
  const { data, isLoading, error } = useAsyncData(loadIncidents, [], {
    fallbackErrorMessage: 'Impossible de charger les incidents',
  })

  const [incidentsOverride, setIncidentsOverride] = useState<Incident[] | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const create = useCallback(
    async (payload: CreateIncidentPayload): Promise<Incident | null> => {
      setIsSaving(true)
      setCreateError(null)
      try {
        const created = await createIncident(payload)
        setIncidentsOverride((previous) => [created, ...(previous ?? data ?? [])])
        return created
      } catch (caughtError: unknown) {
        const message =
          (caughtError as { response?: { data?: { message?: string } } })?.response?.data
            ?.message ?? "Erreur lors de la création de l'incident"
        setCreateError(message)
        return null
      } finally {
        setIsSaving(false)
      }
    },
    [data],
  )

  return {
    incidents: incidentsOverride ?? data ?? [],
    isLoading,
    error,
    createIncident: create,
    isSaving,
    createError,
  }
}
