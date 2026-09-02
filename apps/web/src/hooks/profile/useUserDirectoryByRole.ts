/**
 * useUserDirectoryByRole — annuaire par rôle (`GET /profiles/directory/by-role`),
 * pour l'onglet correspondant de l'écran « Visualisation » du rail RP.
 *
 * Même mécanique que `useSelectableTeachers` (parcourt les pages jusqu'à `totalPages`,
 * garde-fou `MAX_DIRECTORY_PAGES` pour ne jamais boucler sans fin sur un `totalPages`
 * aberrant) — factorisée ici pour les 4 rôles couverts par l'écran, au lieu de dupliquer
 * la boucle de pagination une fois par rôle.
 *
 * **Recherche par nom (`searchQuery`), complément du 2026-09-02** : transmise telle
 * quelle à `fetchUserDirectoryByRole`, qui la relaie au paramètre serveur `q`
 * (`docs/routes.md`, PR #210) — filtre appliqué **côté serveur avant la pagination**,
 * jamais un filtrage local sur les entrées déjà chargées. `searchQuery` fait partie des
 * dépendances de rechargement : la changer redemande l'annuaire au serveur, comme un
 * changement de page l'aurait fait.
 */

import { fetchUserDirectoryByRole, USER_DIRECTORY_PAGE_SIZE } from '../../api/profile'
import type { UserDirectoryEntry } from '../../types/profile'
import type { UserRole } from '../../types/user'
import { useAsyncData } from '../useAsyncData'

/** Même garde-fou que `useSelectableTeachers` : 20 pages × 100 = 2 000 personnes. */
export const MAX_USER_DIRECTORY_PAGES = 20

export interface UserDirectoryResult {
  entries: UserDirectoryEntry[]
  isTruncated: boolean
}

/** Ne se résout jamais : l'appel n'a pas lieu d'être, et rien ne doit s'afficher. */
function pendingForever<T>(): Promise<T> {
  return new Promise<T>(() => {})
}

export async function loadUserDirectoryByRole(
  role: UserRole,
  searchQuery?: string,
): Promise<UserDirectoryResult> {
  const collectedEntries: UserDirectoryEntry[] = []
  let currentPage = 1
  let totalPages = 1

  while (currentPage <= totalPages && currentPage <= MAX_USER_DIRECTORY_PAGES) {
    const response = await fetchUserDirectoryByRole(
      role,
      currentPage,
      USER_DIRECTORY_PAGE_SIZE,
      searchQuery,
    )
    collectedEntries.push(...response.data)
    totalPages = Number.isFinite(response.totalPages) ? response.totalPages : currentPage
    currentPage += 1
  }

  return {
    entries: collectedEntries,
    isTruncated: totalPages > MAX_USER_DIRECTORY_PAGES,
  }
}

export interface UseUserDirectoryByRoleResult {
  entries: UserDirectoryEntry[]
  isLoading: boolean
  loadError: string | null
  isTruncated: boolean
}

/**
 * @param role Rôle de l'annuaire à charger (`eleve`, `parent_financeur`, `formateur`,
 *   `animateur_pedagogique`).
 * @param isEnabled `true` seulement quand l'onglet correspondant a été activé — évite
 *   de charger les 4 annuaires au premier affichage de l'écran (règle du 2026-08-10).
 * @param searchQuery Recherche par nom, optionnelle — combinée à `role` côté serveur.
 */
export function useUserDirectoryByRole(
  role: UserRole,
  isEnabled: boolean,
  searchQuery?: string,
): UseUserDirectoryByRoleResult {
  const { data, isLoading, error } = useAsyncData(
    () =>
      isEnabled
        ? loadUserDirectoryByRole(role, searchQuery)
        : pendingForever<UserDirectoryResult>(),
    [role, isEnabled, searchQuery],
    { fallbackErrorMessage: "Impossible de charger l'annuaire." },
  )

  return {
    entries: data?.entries ?? [],
    isLoading,
    loadError: error,
    isTruncated: data?.isTruncated ?? false,
  }
}
