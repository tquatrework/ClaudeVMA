/**
 * navigationFilters — Helper d'accès aux routes par rôle
 *
 * Fournit `canAccess(role, path)` et le hook `useCanAccess(path)`.
 *
 * La table ROUTE_ACCESS_MAP (navigation/routeAccessMap.ts) est déduite directement
 * des `allowedRoles` déclarés dans App.tsx. Toute route absente de cette table est
 * considérée accessible à tout utilisateur authentifié (pas de restriction
 * de rôle supplémentaire côté nav).
 *
 * Règle : si `canAccess` retourne false, le lien/bouton/carte doit être
 * masqué — jamais grisé, jamais redirigé vers /forbidden côté nav.
 */

import { useCallback } from 'react'
import { useAuth } from '../hooks/useAuth'
import type { UserRole } from '../types/user'
import { ROUTE_ACCESS_MAP } from './routeAccessMap'

// ─── Helper principal ───────────────────────────────────────────────────────

/**
 * Retourne true si le rôle donné peut accéder au chemin donné.
 *
 * Logique :
 * 1. Cherche la règle la plus spécifique (préfixe le plus long) qui correspond au path.
 * 2. Si une règle existe → vérifie que le rôle est dans `roles`.
 * 3. Si aucune règle → pas de restriction de rôle → retourne true.
 */
export function canAccess(role: UserRole | undefined, path: string): boolean {
  if (!role) return false

  // Trier par longueur décroissante pour prendre la règle la plus spécifique
  const sortedRules = [...ROUTE_ACCESS_MAP].sort(
    (ruleA, ruleB) => ruleB.prefix.length - ruleA.prefix.length,
  )

  const matchingRule = sortedRules.find((rule) => {
    const normalizedPath = path.split('?')[0] // ignorer les query params
    return normalizedPath === rule.prefix || normalizedPath.startsWith(`${rule.prefix}/`)
  })

  if (!matchingRule) {
    // Pas de restriction déclarée → accessible à tout connecté
    return true
  }

  return matchingRule.roles.includes(role)
}

// ─── Hook React ────────────────────────────────────────────────────────────

/**
 * Hook : retourne une fonction `checkAccess(path)` pour le rôle courant.
 * Usage : const { checkAccess } = useCanAccess()
 *         {checkAccess('/admin/accounts') && <Link to="/admin/accounts">...</Link>}
 */
export function useCanAccess(): { checkAccess: (path: string) => boolean } {
  const { user } = useAuth()

  const checkAccess = useCallback(
    (path: string): boolean => canAccess(user?.role, path),
    [user?.role],
  )

  return { checkAccess }
}
