/**
 * useExerciseAttemptImageUrl — télécharge les octets d'une image de solution déjà révélée sur
 * une tentative d'exercice, et construit un object URL affichable. Même pattern que
 * `useExercisePartImageUrl`/`useMemoItemImageUrl`, côté learning-activity-service.
 */

import { useEffect, useState } from 'react'
import { fetchExerciseAttemptImageBlob } from '../../api/exerciseAttempts'

export interface UseExerciseAttemptImageUrlResult {
  imageUrl: string | null
  isLoading: boolean
  error: string | null
}

export function useExerciseAttemptImageUrl(
  attemptId: string,
  itemId: string,
): UseExerciseAttemptImageUrlResult {
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isCancelled = false
    let objectUrl: string | null = null
    setIsLoading(true)
    setError(null)

    fetchExerciseAttemptImageBlob(attemptId, itemId)
      .then((blob) => {
        if (isCancelled) return
        objectUrl = URL.createObjectURL(blob)
        setImageUrl(objectUrl)
      })
      .catch(() => {
        if (!isCancelled) setError("Cette image n'a pas pu être affichée.")
      })
      .finally(() => {
        if (!isCancelled) setIsLoading(false)
      })

    return () => {
      isCancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [attemptId, itemId])

  return { imageUrl, isLoading, error }
}
