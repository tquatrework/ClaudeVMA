import { fetchProfileStatistics } from '../../api/profile'
import type { ProfileStatisticsResponse, ProfileVisibility } from '../../types/profile'
import { useAsyncData } from '../useAsyncData'

export interface UseProfileStatisticsResult {
  /** Contenu de l'enveloppe — jamais l'enveloppe elle-même. */
  statistics: Record<string, unknown> | null
  /** Bloc `visibility` de la réponse : dit quels champs sont masqués au lecteur. */
  visibility?: ProfileVisibility
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
 * Déballe l'enveloppe `{userId, profileType, statistics, visibility}` renvoyée
 * par la route, pour que l'écran n'ait pas à connaître sa forme.
 *
 * Le composant n'affiche jamais le détail de l'erreur (juste un message générique
 * "non disponible"), d'où l'exposition d'un simple booléen `hasError`.
 */
export function useProfileStatistics(userId: string, canView: boolean): UseProfileStatisticsResult {
  const { data, isLoading, error } = useAsyncData(
    () =>
      canView
        ? fetchProfileStatistics(userId)
        : pendingForever<ProfileStatisticsResponse | null>(),
    [userId, canView],
  )

  return {
    statistics: data?.statistics ?? null,
    visibility: data?.visibility,
    isLoading,
    hasError: error !== null,
  }
}
