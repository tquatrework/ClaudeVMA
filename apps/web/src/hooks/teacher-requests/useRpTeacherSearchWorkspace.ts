import { fetchTeacherRequests } from '../../api/teacherRequests'
import type { TeacherRequestSummary } from '../../types/teacherRequests'
import { useAsyncData } from '../useAsyncData'
import { getErrorStatus } from '../../utils/apiError'

/**
 * Reproduit la normalisation et le filtrage préexistants de RpTeacherSearchWorkspace :
 * accepte tableau brut ou enveloppe `{ data: [...] }`, ne conserve que les demandes
 * actionnables (`pending` / `candidates_selected`).
 */
async function loadActionableTeacherRequests(): Promise<TeacherRequestSummary[]> {
  try {
    const data = await fetchTeacherRequests()
    const requestList = Array.isArray(data)
      ? data
      : (data as { data: TeacherRequestSummary[] }).data ?? []
    return requestList.filter(
      (request) => request.status === 'pending' || request.status === 'candidates_selected',
    )
  } catch (caughtError) {
    const message = getErrorStatus(caughtError) === 403 ? 'Accès refusé' : 'Impossible de charger les demandes'
    // Forme reconnue en priorité par getErrorMessage (response.data.message), pour reproduire
    // exactement les messages historiques de RpTeacherSearchWorkspace selon le statut HTTP.
    throw { response: { data: { message } } }
  }
}

export interface UseRpTeacherSearchWorkspaceResult {
  pendingRequests: TeacherRequestSummary[]
  isLoading: boolean
  errorMessage: string | null
}

/**
 * useRpTeacherSearchWorkspace — charge les demandes actionnables (pending /
 * candidates_selected) pour l'espace de travail RP.
 */
export function useRpTeacherSearchWorkspace(): UseRpTeacherSearchWorkspaceResult {
  const { data, isLoading, error: errorMessage } = useAsyncData(loadActionableTeacherRequests, [])

  return { pendingRequests: data ?? [], isLoading, errorMessage }
}
