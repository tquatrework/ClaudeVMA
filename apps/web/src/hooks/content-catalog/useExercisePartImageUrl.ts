/**
 * useExercisePartImageUrl — télécharge les octets d'une image de bloc d'exercice et construit un
 * object URL affichable dans un `<img>`. Même pattern que `useMemoItemImageUrl`.
 *
 * `GET /exercises/:exerciseId/images/:itemId` est authentifiée par le JWT de l'en-tête
 * `Authorization`, qu'une balise `<img src>` brute n'envoie pas.
 */

import { useEffect, useState } from 'react'
import { fetchExercisePartImageBlob } from '../../api/exercises'

export interface UseExercisePartImageUrlResult {
  imageUrl: string | null
  isLoading: boolean
  error: string | null
}

export function useExercisePartImageUrl(
  exerciseId: string,
  itemId: string,
): UseExercisePartImageUrlResult {
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isCancelled = false
    let objectUrl: string | null = null
    setIsLoading(true)
    setError(null)

    fetchExercisePartImageBlob(exerciseId, itemId)
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
  }, [exerciseId, itemId])

  return { imageUrl, isLoading, error }
}
