/**
 * useForumImage — photo d'illustration d'un forum, en lecture seule (`GET /forums/:id/image`).
 *
 * Même patron que `useReadOnlyAvatar` : la route est authentifiée par le JWT porté dans l'en-tête
 * `Authorization`, que le navigateur n'envoie jamais sur une balise `<img>` — on récupère les
 * octets, puis on en fait un object URL.
 *
 * N'appelle la route que si `hasImage` est vrai (`forum.imageFilename` non nul) : épargne un
 * aller-retour systématique à `404` pour tous les forums sans image.
 *
 * Toute erreur (404 — pas d'image ou forum masqué pour ce lecteur — comme un échec inattendu)
 * dégrade silencieusement vers l'absence d'image ; seul un échec inattendu est journalisé.
 */

import { useEffect, useState } from 'react'
import { fetchForumImageBlob } from '../../api/communityPath'
import { getErrorStatus } from '../../utils/apiError'

export interface UseForumImageResult {
  imageObjectUrl: string | null
  isLoadingImage: boolean
}

export function useForumImage(forumId: string | undefined, hasImage: boolean): UseForumImageResult {
  const [imageObjectUrl, setImageObjectUrl] = useState<string | null>(null)
  const [isLoadingImage, setIsLoadingImage] = useState(false)

  useEffect(() => {
    if (!forumId || !hasImage) {
      setImageObjectUrl(null)
      setIsLoadingImage(false)
      return
    }

    let isCancelled = false
    let createdObjectUrl: string | null = null

    setImageObjectUrl(null)
    setIsLoadingImage(true)

    const loadImage = async () => {
      try {
        const imageBlob = await fetchForumImageBlob(forumId)
        if (isCancelled) return
        createdObjectUrl = URL.createObjectURL(imageBlob)
        setImageObjectUrl(createdObjectUrl)
      } catch (caughtError) {
        if (isCancelled) return
        if (getErrorStatus(caughtError) !== 404) {
          console.warn('[forum-image] lecture impossible :', caughtError)
        }
      } finally {
        if (!isCancelled) setIsLoadingImage(false)
      }
    }

    void loadImage()

    return () => {
      isCancelled = true
      if (createdObjectUrl) URL.revokeObjectURL(createdObjectUrl)
    }
  }, [forumId, hasImage])

  return { imageObjectUrl, isLoadingImage }
}
