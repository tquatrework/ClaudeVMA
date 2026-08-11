import { fetchProfileStatistics } from '../../api/profile'
import type { ProfileStatisticsResponse, ProfileVisibility } from '../../types/profile'
import { getErrorStatus } from '../../utils/apiError'
import { useAsyncData } from '../useAsyncData'

export interface UseProfileStatisticsResult {
  /** Contenu de l'enveloppe — jamais l'enveloppe elle-même. */
  statistics: Record<string, unknown> | null
  /** Bloc `visibility` de la réponse : dit quels champs sont masqués au lecteur. */
  visibility?: ProfileVisibility
  isLoading: boolean
  /** Vrai seulement pour un échec technique — un `404` est un état vide, pas une erreur. */
  hasError: boolean
}

/**
 * useProfileStatistics — statistiques pédagogiques d'une personne.
 *
 * **Aucun garde de rôle côté client** (retiré le 2026-08-11). Le droit d'accès est
 * piloté par la relation métier et contrôlé par `profile-service` : un élève lit les
 * statistiques de SON formateur, un AP celles des formateurs qu'il anime. Un garde
 * fondé sur une liste de rôles empêchait justement ces lectures — il masquait le
 * panneau à l'élève avant même la requête. Une règle de droit portée côté client
 * n'est pas une règle de droit ; ici elle était en plus fausse.
 *
 * Un accès refusé répond `404`, avec le même message qu'une absence de statistiques :
 * les deux cas sont volontairement indiscernables et se rendent tous deux en état
 * vide. Les autres échecs restent de vraies erreurs.
 */
async function loadStatisticsFor(userId: string): Promise<ProfileStatisticsResponse | null> {
  if (!userId) return null

  try {
    return await fetchProfileStatistics(userId)
  } catch (caughtError: unknown) {
    if (getErrorStatus(caughtError) === 404) return null
    throw caughtError
  }
}

export function useProfileStatistics(userId: string): UseProfileStatisticsResult {
  const { data, isLoading, error } = useAsyncData(() => loadStatisticsFor(userId), [userId])

  return {
    statistics: data?.statistics ?? null,
    visibility: data?.visibility,
    isLoading,
    hasError: error !== null,
  }
}
