/**
 * useExerciseImageConstraints — plafond de taille d'image pour un bloc image d'Exercice, lu au
 * serveur (`GET /exercises/image-constraints`). Même patron que `useQuizImportConstraints`/
 * `useProfileAvatarConstraints` : lu **avant** d'afficher le bouton d'ajout d'image.
 */

import { useEffect, useState } from 'react'
import { fetchExerciseImageConstraints } from '../../api/exercises'
import {
  FALLBACK_EXERCISE_IMAGE_CONSTRAINTS,
  normalizeExerciseImageConstraints,
} from '../../utils/exerciseImageConstraints'
import type { ExerciseImageConstraints } from '../../types/exercise'

export interface UseExerciseImageConstraintsResult {
  /** Toujours exploitable : valeurs du serveur, ou repli. Jamais `null`. */
  imageConstraints: ExerciseImageConstraints
  isLoadingImageConstraints: boolean
}

export function useExerciseImageConstraints(): UseExerciseImageConstraintsResult {
  const [imageConstraints, setImageConstraints] = useState<ExerciseImageConstraints>(
    FALLBACK_EXERCISE_IMAGE_CONSTRAINTS,
  )
  const [isLoadingImageConstraints, setIsLoadingImageConstraints] = useState(true)

  useEffect(() => {
    let isCancelled = false
    setIsLoadingImageConstraints(true)

    fetchExerciseImageConstraints()
      .then((serverConstraints) => {
        if (isCancelled) return
        setImageConstraints(normalizeExerciseImageConstraints(serverConstraints))
      })
      .catch((caughtError: unknown) => {
        if (!isCancelled) {
          console.warn('[exercise-image] contraintes illisibles :', caughtError)
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
