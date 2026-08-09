/**
 * usePersonDisplayName — résout un `userId` en nom humain (« Prénom Nom »).
 *
 * L'API ne renvoie parfois qu'un identifiant technique : `filledBy` de la
 * prescription en est le cas type. La règle UX du projet interdit d'afficher un
 * UUID comme libellé métier ; le front enrichit donc par `GET /profiles/:id`.
 *
 * Quand la lecture échoue — un élève n'a pas forcément le droit de lire le profil
 * du responsable pédagogique qui l'a suivi — on affiche le libellé générique du
 * rôle plutôt qu'un identifiant brut ou une erreur inutile à l'utilisateur.
 */

import { useEffect, useState } from 'react'
import { fetchProfile } from '../../api/profile'
import { formatPersonDisplayName } from '../../utils/nameFormat'

export interface UsePersonDisplayNameResult {
  /** Libellé prêt à afficher, jamais un UUID. `null` tant qu'on ne sait rien. */
  displayName: string | null
  isLoading: boolean
}

export function usePersonDisplayName(
  userId: string | null | undefined,
  genericRoleLabel: string,
): UsePersonDisplayNameResult {
  const [displayName, setDisplayName] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!userId) {
      setDisplayName(null)
      setIsLoading(false)
      return
    }

    let isCurrentRequest = true
    setIsLoading(true)
    // Repli immédiat : même si la lecture échoue, l'écran affiche un libellé humain.
    setDisplayName(genericRoleLabel)

    fetchProfile(userId)
      .then((profile) => {
        if (!isCurrentRequest) return
        const administrative = (profile.administrative ?? {}) as Record<string, unknown>
        const firstName =
          typeof administrative.firstName === 'string' ? administrative.firstName : undefined
        const lastName =
          typeof administrative.lastName === 'string' ? administrative.lastName : undefined
        setDisplayName(formatPersonDisplayName(firstName, lastName, undefined, genericRoleLabel))
      })
      .catch(() => {
        // Droit de lecture refusé ou profil indisponible : on garde le libellé
        // générique déjà posé. Ce n'est pas une erreur à remonter à l'utilisateur.
        if (isCurrentRequest) setDisplayName(genericRoleLabel)
      })
      .finally(() => {
        if (isCurrentRequest) setIsLoading(false)
      })

    return () => {
      isCurrentRequest = false
    }
  }, [userId, genericRoleLabel])

  return { displayName, isLoading }
}
