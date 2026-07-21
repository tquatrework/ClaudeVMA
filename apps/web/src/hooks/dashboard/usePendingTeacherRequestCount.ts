import { fetchTeacherRequestsForDashboard } from '../../api/teacherRequests'
import { normalizeListResponse } from '../../utils/dashboardFormat'
import { useAsyncData } from '../useAsyncData'

export interface UsePendingTeacherRequestCountResult {
  pendingRequestCount: number | null
  isLoadingRequests: boolean
}

/**
 * En cas d'échec, RpDashboardPage affichait historiquement un compteur à 0 (jamais de
 * message d'erreur) — reproduit ici en absorbant l'erreur au niveau du chargement plutôt
 * qu'en la laissant remonter comme `error` non affiché.
 */
async function loadPendingCount(): Promise<number> {
  try {
    const requests = await fetchTeacherRequestsForDashboard()
    return normalizeListResponse(requests).filter((request) => request.status === 'pending').length
  } catch {
    return 0
  }
}

/**
 * usePendingTeacherRequestCount — compte les demandes professeur en attente pour
 * RpDashboardPage (carte "Demandes ouvertes").
 */
export function usePendingTeacherRequestCount(): UsePendingTeacherRequestCountResult {
  const { data, isLoading } = useAsyncData(loadPendingCount, [])

  return {
    pendingRequestCount: data ?? null,
    isLoadingRequests: isLoading,
  }
}
