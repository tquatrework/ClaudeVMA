/**
 * useTutorialImageConstraints — plafond de taille d'image pour un bloc de Tutoriel, lu au serveur
 * (`GET /tutorials/image-constraints`). Même patron que `useExerciseImageConstraints` : lu
 * **avant** d'afficher le bouton d'ajout d'image.
 */

import { useEffect, useState } from 'react'
import { fetchTutorialImageConstraints } from '../../api/tutorials'
import {
  FALLBACK_TUTORIAL_IMAGE_CONSTRAINTS,
  normalizeTutorialImageConstraints,
} from '../../utils/tutorialImageConstraints'
import type { TutorialImageConstraints } from '../../types/tutorial'

export interface UseTutorialImageConstraintsResult {
  /** Toujours exploitable : valeurs du serveur, ou repli. Jamais `null`. */
  imageConstraints: TutorialImageConstraints
  isLoadingImageConstraints: boolean
}

export function useTutorialImageConstraints(): UseTutorialImageConstraintsResult {
  const [imageConstraints, setImageConstraints] = useState<TutorialImageConstraints>(
    FALLBACK_TUTORIAL_IMAGE_CONSTRAINTS,
  )
  const [isLoadingImageConstraints, setIsLoadingImageConstraints] = useState(true)

  useEffect(() => {
    let isCancelled = false
    setIsLoadingImageConstraints(true)

    fetchTutorialImageConstraints()
      .then((serverConstraints) => {
        if (isCancelled) return
        setImageConstraints(normalizeTutorialImageConstraints(serverConstraints))
      })
      .catch((caughtError: unknown) => {
        if (!isCancelled) {
          console.warn('[tutorial-image] contraintes illisibles :', caughtError)
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
