/**
 * useProfileAvatarConstraints — contraintes d'envoi de la photo, lues au serveur.
 *
 * `GET /profiles/avatar/constraints` publie le plafond réellement appliqué et
 * les formats acceptés. Le front les lit **avant** d'ouvrir le sélecteur de
 * fichier, pour deux usages :
 *
 * 1. les **annoncer** à l'utilisateur, avant qu'il ne choisisse une photo ;
 * 2. **refuser localement** un fichier trop lourd, sans le faire transiter.
 *
 * Aucune de ces valeurs n'est codée en dur : le jour où le plafond sera relevé,
 * l'affichage et le contrôle suivront sans toucher au front.
 *
 * Repli : si l'appel échoue, on retient les contraintes par défaut plutôt que de
 * n'annoncer aucune limite. Annoncer une limite plausible et se tromper d'un
 * cran vaut mieux que laisser l'utilisateur découvrir le refus après un envoi.
 */

import { useEffect, useState } from 'react'
import { fetchProfileAvatarConstraints } from '../../api/profile'
import {
  FALLBACK_AVATAR_CONSTRAINTS,
  normalizeAvatarConstraints,
} from '../../utils/profileAvatarConstraints'
import type { ProfileAvatarConstraints } from '../../types/profile'

export interface UseProfileAvatarConstraintsResult {
  /** Toujours exploitable : valeurs du serveur, ou repli. Jamais `null`. */
  avatarConstraints: ProfileAvatarConstraints
  isLoadingAvatarConstraints: boolean
  /** Les valeurs affichées viennent-elles bien du serveur ? */
  hasServerAvatarConstraints: boolean
}

/**
 * @param isEnabled `false` pour un lecteur qui ne peut pas envoyer de photo :
 *   inutile d'appeler le serveur pour une contrainte qu'il ne lira jamais.
 */
export function useProfileAvatarConstraints(isEnabled = true): UseProfileAvatarConstraintsResult {
  const [avatarConstraints, setAvatarConstraints] = useState<ProfileAvatarConstraints>(
    FALLBACK_AVATAR_CONSTRAINTS,
  )
  const [hasServerAvatarConstraints, setHasServerAvatarConstraints] = useState(false)
  const [isLoadingAvatarConstraints, setIsLoadingAvatarConstraints] = useState(isEnabled)

  useEffect(() => {
    if (!isEnabled) {
      setIsLoadingAvatarConstraints(false)
      return
    }

    let isCancelled = false
    setIsLoadingAvatarConstraints(true)

    const loadConstraints = async () => {
      try {
        const serverConstraints = await fetchProfileAvatarConstraints()
        if (isCancelled) return
        setAvatarConstraints(normalizeAvatarConstraints(serverConstraints))
        setHasServerAvatarConstraints(true)
      } catch (caughtError) {
        // Panne à journaliser pour le développeur, jamais un message de plus à
        // l'écran : l'utilisateur voit la limite de repli et peut agir.
        if (!isCancelled) console.warn('[avatar] contraintes d’envoi illisibles :', caughtError)
      } finally {
        if (!isCancelled) setIsLoadingAvatarConstraints(false)
      }
    }

    void loadConstraints()

    return () => {
      isCancelled = true
    }
  }, [isEnabled])

  return { avatarConstraints, isLoadingAvatarConstraints, hasServerAvatarConstraints }
}
