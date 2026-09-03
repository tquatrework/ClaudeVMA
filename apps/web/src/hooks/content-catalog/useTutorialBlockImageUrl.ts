/**
 * useTutorialBlockImageUrl — télécharge les octets d'une image de bloc de tutoriel et construit
 * un object URL affichable dans un `<img>`. Même pattern que `useExercisePartImageUrl`.
 *
 * `GET /tutorials/:tutorialId/images/:blockId` est authentifiée par le JWT de l'en-tête
 * `Authorization`, qu'une balise `<img src>` brute n'envoie pas.
 */

import { useEffect, useState } from 'react'
import { fetchTutorialBlockImageBlob } from '../../api/tutorials'

export interface UseTutorialBlockImageUrlResult {
  imageUrl: string | null
  isLoading: boolean
  error: string | null
}

export function useTutorialBlockImageUrl(
  tutorialId: string,
  blockId: string,
): UseTutorialBlockImageUrlResult {
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isCancelled = false
    let objectUrl: string | null = null
    setIsLoading(true)
    setError(null)

    fetchTutorialBlockImageBlob(tutorialId, blockId)
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
  }, [tutorialId, blockId])

  return { imageUrl, isLoading, error }
}
