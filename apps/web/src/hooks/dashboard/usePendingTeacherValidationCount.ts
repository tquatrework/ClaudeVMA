import { fetchPendingTeachers } from '../../api/profile'
import { useAsyncData } from '../useAsyncData'

export interface UsePendingTeacherValidationCountResult {
  pendingTeacherCount: number | null
  isLoadingTeacherCount: boolean
}

/**
 * Nombre de formateurs en attente d'examen, pour la carte du tableau de bord RP.
 *
 * On lit le `total` de l'enveloppe, jamais la longueur de `data` : la file est
 * paginée, compter la première page annoncerait « 20 » sur une file de 40.
 *
 * `limit: 1` : seul le compteur nous intéresse ici, la file elle-même s'ouvre
 * sur `/rp/teacher-validations`. En cas d'échec, la carte affiche `0` plutôt
 * qu'un message — c'est un indicateur secondaire, pas l'objet de la page.
 */
async function loadPendingTeacherCount(): Promise<number> {
  try {
    const page = await fetchPendingTeachers(1, 1)
    return page.total
  } catch {
    return 0
  }
}

export function usePendingTeacherValidationCount(): UsePendingTeacherValidationCountResult {
  const { data, isLoading } = useAsyncData(loadPendingTeacherCount, [])

  return {
    pendingTeacherCount: data ?? null,
    isLoadingTeacherCount: isLoading,
  }
}
