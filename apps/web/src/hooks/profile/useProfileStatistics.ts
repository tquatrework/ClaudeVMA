import { fetchProfileStatistics } from '../../api/profile'
import type { PedagogicalStatistics } from '../../types/profile'
import { useAsyncData } from '../useAsyncData'

export interface UseProfileStatisticsResult {
  statistics: PedagogicalStatistics | null
  isLoading: boolean
  hasError: boolean
}

/**
 * Ne résout jamais si `canView` est faux : le composant appelant retourne `null`
 * avant même de regarder `isLoading`/`statistics`, donc aucune mise à jour d'état
 * ne doit se produire (évite un warning React "act" en test et reproduit
 * l'absence totale d'appel réseau du garde initial de ProfileStatisticsPanel).
 */
function pendingForever<T>(): Promise<T> {
  return new Promise<T>(() => {})
}

/**
 * useProfileStatistics — charge les statistiques pédagogiques d'un utilisateur.
 * Ne déclenche aucun appel réseau si `canView` est faux (rôle non autorisé),
 * à l'image du garde initial de ProfileStatisticsPanel.
 *
 * Le composant n'affiche jamais le détail de l'erreur (juste un message générique
 * "non disponible"), d'où l'exposition d'un simple booléen `hasError`.
 */
export function useProfileStatistics(userId: string, canView: boolean): UseProfileStatisticsResult {
  const { data, isLoading, error } = useAsyncData(
    () => (canView ? fetchProfileStatistics(userId) : pendingForever<PedagogicalStatistics | null>()),
    [userId, canView],
  )

  return {
    statistics: data ?? null,
    isLoading,
    hasError: error !== null,
  }
}
