/**
 * useMemoItemImageUrl — télécharge les octets d'un item image de mémo et
 * construit un object URL affichable dans un `<img>`.
 *
 * La route `GET /memos/chapters/:chapterId/items/:itemId/image` est
 * authentifiée par le JWT de l'en-tête `Authorization`, qu'une balise
 * `<img src>` brute n'envoie pas — même contrainte que la photo de profil et
 * les pièces jointes du cahier de texte. L'object URL est révoqué au
 * démontage pour ne pas fuir de mémoire.
 */

import { useEffect, useState } from 'react'
import { fetchMemoItemImageBlob } from '../../api/pedagogicalLogMemos'

export interface UseMemoItemImageUrlResult {
  imageUrl: string | null
  isLoading: boolean
  error: string | null
}

export function useMemoItemImageUrl(chapterId: string, itemId: string): UseMemoItemImageUrlResult {
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isCancelled = false
    let objectUrl: string | null = null
    setIsLoading(true)
    setError(null)

    fetchMemoItemImageBlob(chapterId, itemId)
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
  }, [chapterId, itemId])

  return { imageUrl, isLoading, error }
}
