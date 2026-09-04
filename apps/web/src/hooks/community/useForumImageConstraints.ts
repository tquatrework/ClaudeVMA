/**
 * useForumImageConstraints — plafond et formats d'envoi de l'image d'illustration d'un forum, lus
 * au serveur (`GET /forums/image-constraints`). Même patron que `useTutorialImageConstraints` : lu
 * **avant** d'afficher le sélecteur de fichier.
 */

import { useEffect, useState } from 'react'
import { fetchForumImageConstraints } from '../../api/forums'
import {
  FALLBACK_FORUM_IMAGE_CONSTRAINTS,
  normalizeForumImageConstraints,
} from '../../utils/forumImageConstraints'
import type { ForumImageConstraints } from '../../types/forum'

export interface UseForumImageConstraintsResult {
  /** Toujours exploitable : valeurs du serveur, ou repli. Jamais `null`. */
  imageConstraints: ForumImageConstraints
  isLoadingImageConstraints: boolean
}

export function useForumImageConstraints(): UseForumImageConstraintsResult {
  const [imageConstraints, setImageConstraints] = useState<ForumImageConstraints>(
    FALLBACK_FORUM_IMAGE_CONSTRAINTS,
  )
  const [isLoadingImageConstraints, setIsLoadingImageConstraints] = useState(true)

  useEffect(() => {
    let isCancelled = false
    setIsLoadingImageConstraints(true)

    fetchForumImageConstraints()
      .then((serverConstraints) => {
        if (isCancelled) return
        setImageConstraints(normalizeForumImageConstraints(serverConstraints))
      })
      .catch((caughtError: unknown) => {
        if (!isCancelled) {
          console.warn('[forum-image] contraintes illisibles :', caughtError)
        }
      })
      .finally(() => {
        if (!isCancelled) setIsLoadingImageConstraints(false)
      })

    return () => {
      isCancelled = true
    }
  }, [])

  return { imageConstraints, isLoadingImageConstraints }
}
