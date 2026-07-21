import { useCallback, useState } from 'react'
import { fetchTeacherRequests } from '../../api/teacherRequests'
import type { TeacherRequestSummary } from '../../types/teacherRequests'
import { useAsyncData } from '../useAsyncData'
import { getErrorStatus } from '../../utils/apiError'

/**
 * Normalise la réponse `GET /teacher-requests`, qui peut arriver soit comme un tableau
 * brut, soit enveloppée dans `{ data: [...] }` — reproduit exactement la normalisation
 * préexistante de TeacherRequestPage.
 */
async function loadTeacherRequestSummaries(): Promise<TeacherRequestSummary[]> {
  try {
    const data = await fetchTeacherRequests()
    return Array.isArray(data)
      ? data
      : (data as { data: TeacherRequestSummary[] }).data ?? []
  } catch (caughtError) {
    const message = getErrorStatus(caughtError) === 403 ? 'Accès refusé' : 'Impossible de charger les demandes'
    // Forme reconnue en priorité par getErrorMessage (response.data.message), pour reproduire
    // exactement les messages historiques de TeacherRequestPage selon le statut HTTP.
    throw { response: { data: { message } } }
  }
}

export interface UseTeacherRequestSummariesResult {
  requests: TeacherRequestSummary[]
  isLoading: boolean
  loadError: string | null
  /** Préfixe la liste avec une demande créée ailleurs (ex. SpecificTeacherRequestForm). */
  addRequestLocally: (request: TeacherRequestSummary) => void
}

/**
 * useTeacherRequestSummaries — charge la liste des demandes professeur pour
 * TeacherRequestPage. La création elle-même reste portée par les composants enfants
 * (SpecificTeacherRequestForm, ChangePrincipalTeacherDialog), hors périmètre de ce
 * hook ; `addRequestLocally` permet à la page de refléter localement le résultat de
 * ces créations sans recharger le réseau, à l'image du comportement préexistant.
 */
export function useTeacherRequestSummaries(): UseTeacherRequestSummariesResult {
  const { data, isLoading, error: loadError } = useAsyncData(loadTeacherRequestSummaries, [])

  const [addedRequests, setAddedRequests] = useState<TeacherRequestSummary[]>([])

  const requests = [...addedRequests, ...(data ?? [])]

  const addRequestLocally = useCallback((request: TeacherRequestSummary) => {
    setAddedRequests((previous) => [request, ...previous])
  }, [])

  return { requests, isLoading, loadError, addRequestLocally }
}
