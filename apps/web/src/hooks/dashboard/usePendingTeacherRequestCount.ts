import { fetchTeacherRequests } from '../../api/teacherRequests'
import { useAsyncData } from '../useAsyncData'

export interface UsePendingTeacherRequestCountResult {
  pendingRequestCount: number | null
  isLoadingRequests: boolean
}

/**
 * Nombre de demandes **ouvertes** à instruire, pour la carte du tableau de bord RP.
 *
 * `scope=open` est la portée du flow : les demandes traitées disparaissent des listes
 * ouvertes (étape 8). Le hook interrogeait auparavant `/requests`, second nom de la même
 * ressource que `/teacher-requests` — un seul nom par donnée, l'écart est résorbé.
 *
 * En cas d'échec, la carte affiche `0` plutôt qu'un message : c'est un indicateur
 * secondaire du tableau de bord, pas l'objet de la page.
 */
async function loadOpenRequestCount(): Promise<number> {
  try {
    const requests = await fetchTeacherRequests('open')
    return requests.length
  } catch {
    return 0
  }
}

export function usePendingTeacherRequestCount(): UsePendingTeacherRequestCountResult {
  const { data, isLoading } = useAsyncData(loadOpenRequestCount, [])

  return {
    pendingRequestCount: data ?? null,
    isLoadingRequests: isLoading,
  }
}
